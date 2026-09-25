import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  type User,
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import {
  appleSignInSupported,
  reauthenticateWithApple,
  signInWithApple as appleSignIn,
} from "@/lib/apple-signin";
import { forgetCachedBodyweight } from "@/lib/bodyweight-cache";
import {
  closeCloudSession,
  forgetCloudData,
  offlineDiagnostics,
  openCloudSession,
  pendingChangeCount,
  whenCloudSynced,
} from "@/lib/cloud-cache";
import { auth } from "@/lib/firebase";
import { deleteAllUserData } from "@/lib/firestore";
import {
  GUEST_USER_ID,
  clearGuestData,
  hasContent,
  readGuestActive,
  readGuestData,
  writeGuestActive,
} from "@/lib/local-store";
import { migrateGuestDataTo } from "@/lib/migrate-guest-data";
import {
  forgetRememberedUser,
  isProvisional,
  readRememberedUser,
  rememberUser,
} from "@/lib/remembered-account";
import {
  googleSignInAvailable,
  reauthenticateWithGoogle,
  signInWithGoogle as googleSignIn,
} from "@/lib/google-signin";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /** Using the app without an account, with everything stored on this device. */
  isGuest: boolean;
  /**
   * Whose data to read and write: the signed-in uid, GUEST_USER_ID while in
   * guest mode, or null when neither. Screens pass this to `@/lib/data`, which
   * routes to the cloud or the device store based on it.
   */
  dataUserId: string | null;
  /** Enters guest mode — no account, no network, data stays on this phone. */
  continueAsGuest: () => Promise<void>;
  /** True while guest data is being uploaded into a freshly signed-in account. */
  migrating: boolean;
  /** Wipes on-device guest data and leaves guest mode. */
  discardGuestData: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Native Google flow. Resolves false if the user dismissed the picker. */
  signInWithGoogle: () => Promise<boolean>;
  /** False in Expo Go, where the native Google module doesn't exist. */
  canUseGoogle: boolean;
  /** Native Sign in with Apple flow. Resolves false if the user dismissed the sheet. */
  signInWithApple: () => Promise<boolean>;
  /** False outside real iOS builds (Android, Expo Go). */
  canUseApple: boolean;
  signOut: () => Promise<void>;
  /** Changes on this phone the server hasn't acked, which signing out would lose. */
  unsyncedChangeCount: () => number;
  /** What the offline copy is doing, for the diagnostics behind Profile's version line. */
  offlineDiagnostics: () => Promise<string>;
  /** Emails a password reset link. Never reveals whether the account exists. */
  resetPassword: (email: string) => Promise<void>;
  /** Re-sends the verification email for the signed-in account. */
  resendVerificationEmail: () => Promise<void>;
  /** Re-checks the account with the server (e.g. to pick up email verification). */
  refreshUser: () => Promise<void>;
  /** Updates the profile display name and refreshes it in the UI immediately. */
  updateDisplayName: (name: string) => Promise<void>;
  /**
   * Permanently removes the user's data and auth account. Password users must
   * pass their password; Apple/Google users re-run their native sign-in sheet
   * instead. Resolves false if they dismissed that sheet (nothing deleted).
   */
  deleteAccount: (password?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  dataUserId: null,
  continueAsGuest: async () => {},
  migrating: false,
  discardGuestData: async () => {},
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => false,
  canUseGoogle: false,
  signInWithApple: async () => false,
  canUseApple: false,
  signOut: async () => {},
  unsyncedChangeCount: () => 0,
  offlineDiagnostics: async () => "",
  resetPassword: async () => {},
  resendVerificationEmail: async () => {},
  refreshUser: async () => {},
  updateDisplayName: async () => {},
  deleteAccount: async () => false,
});

/** How long "Moving your workouts" waits for the server before letting the app be used. */
const MIGRATION_PATIENCE_MS = 5_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [guestActive, setGuestActive] = useState(false);
  const [guestChecked, setGuestChecked] = useState(false);
  const [migrating, setMigrating] = useState(false);

  /**
   * An account always outranks the guest flag. The flag can legitimately still
   * be set while an account exists — during migration, and after one that
   * failed and will retry next launch — and screens that branch on it would
   * then show account-less UI over data that hasn't reached the cloud yet,
   * including Profile's "Delete all data" button. Deriving it here means no
   * screen has to remember that rule.
   */
  const isGuest = guestActive && !user;

  /**
   * The uid just signed out of, while Firebase catches up.
   *
   * Signing out can happen before Firebase has finished restoring the session
   * (see remembered-account). Firebase then finishes, reports the user it
   * restored, and only after that signs them out. Without this, that brief
   * report would sign them straight back in.
   */
  const signedOutUid = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /** Firebase has reported in. What it says outranks the remembered account. */
    let confirmed = false;
    readRememberedUser().then((remembered) => {
      if (cancelled || confirmed || !remembered) return;
      // Before setUser: screens subscribe the moment the account appears,
      // and a session signed out of earlier this launch refuses them until
      // it's opened again.
      openCloudSession(remembered.uid);
      setUser(remembered);
      setAuthLoading(false);
    });
    // Restoring the guest flag is part of "is the session ready?" — resolving it
    // alongside Firebase keeps a returning guest from flashing the sign-in screen.
    readGuestActive()
      .then((active) => {
        if (!cancelled) setGuestActive(active);
      })
      .finally(() => {
        if (!cancelled) setGuestChecked(true);
      });
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      confirmed = true;
      if (u && u.uid === signedOutUid.current) return;
      if (!u) {
        signedOutUid.current = null;
        // Firebase has no session, whether from a sign-out or one that expired
        // or was revoked. Either way, don't open on this account next launch.
        // Its offline copy stays, so unsent changes go up if they sign back in.
        forgetRememberedUser();
      } else {
        openCloudSession(u.uid);
      }
      setUser(u);
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // The moment an account exists, anything logged as a guest belongs to it.
  // This runs on every sign-in *and* every launch, so a migration interrupted
  // by a dead connection simply finishes the next time the app opens.
  //
  // Keyed on the uid, not the user object: refreshUser() hands React a new
  // object every few seconds while the verify-email screen polls, and re-running
  // on those would start a second upload of the same workouts. The ref closes
  // the same door for any other path that remounts mid-migration.
  const uid = user?.uid ?? null;

  // One offline copy per account, open while that account is. Opened where
  // the account is set (above) rather than by the first screen that reads, so
  // its Firestore listeners and its replay of unsent changes don't depend on
  // which screen that is. Closed here once no account is left.
  useEffect(() => {
    if (!uid) void closeCloudSession();
  }, [uid]);

  // Remember each confirmed update to the account (name, verified email) for
  // the next launch. Stand-ins are skipped; they are the remembered copy.
  useEffect(() => {
    if (user && !isProvisional(user)) void rememberUser(user);
  }, [user]);

  const migrationRunning = useRef(false);
  useEffect(() => {
    if (!uid || migrationRunning.current) return;
    let cancelled = false;
    migrationRunning.current = true;
    (async () => {
      try {
        const guest = await readGuestData();
        if (!hasContent(guest)) {
          await writeGuestActive(false);
          if (!cancelled) setGuestActive(false);
          return;
        }
        // Moving data needs the server. With no signal every upload would
        // hang, and with it the full-screen "Moving your workouts" that
        // blocks the app. So it waits for the server to answer once. The
        // screen goes up at once as it always has, since that's the usual
        // case right after signing in, which needs a connection anyway. If
        // the server hasn't answered after a few seconds, the screen steps
        // aside and the app stays usable until it does. The guest data is
        // safe on the phone meanwhile.
        if (!cancelled) setMigrating(true);
        const synced = whenCloudSynced(uid);
        const answered = await Promise.race([
          synced.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), MIGRATION_PATIENCE_MS)),
        ]);
        if (!answered) {
          if (!cancelled) setMigrating(false);
          await synced;
          if (cancelled) return;
          setMigrating(true);
        }
        if (cancelled) return;
        const result = await migrateGuestDataTo(uid);
        if (!cancelled) setGuestActive(false);
        // Two things have ceilings a merge can run into: the exercise library is
        // a single document with a hard size limit, and templates are capped so
        // repeated guest sessions can't climb past the per-screen limit. Logged
        // workouts are never affected, which is what the closing line promises.
        // Say so either way — the alternative is someone noticing weeks later.
        if (result) {
          const missing: string[] = [];
          if (result.customExercisesDropped > 0) {
            const n = result.customExercisesDropped;
            missing.push(`${n} custom exercise${n === 1 ? "" : "s"}`);
          }
          if (result.templatesDropped > 0) {
            const n = result.templatesDropped;
            missing.push(`${n} template${n === 1 ? "" : "s"}`);
          }
          if (result.activeWorkoutsDropped > 0) {
            const n = result.activeWorkoutsDropped;
            missing.push(`${n} unfinished workout${n === 1 ? "" : "s"}`);
          }
          if (missing.length > 0) {
            Alert.alert(
              "Your workouts moved over",
              `${missing.join(" and ")} couldn't come with them — your account was already at the limit. Every workout you logged is safe.`
            );
          }
        }
      } catch (e) {
        console.warn("Couldn't move guest data into the account", e);
        Alert.alert(
          "Some workouts are still on this device",
          "We couldn't finish moving them into your account. They're safe here and we'll try again next time you open Plato."
        );
      } finally {
        migrationRunning.current = false;
        if (!cancelled) setMigrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function continueAsGuest() {
    await writeGuestActive(true);
    setGuestActive(true);
  }

  async function discardGuestData() {
    await clearGuestData();
    await writeGuestActive(false);
    setGuestActive(false);
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }

  async function signUp(name: string, email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Fire-and-forget: verification is encouraged, not required, so a failed
    // send must never block a brand-new account from getting into the app.
    sendEmailVerification(cred.user).catch(() => {});
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      // updateProfile doesn't re-emit onAuthStateChanged; refresh local state
      setUser({ ...cred.user, displayName: name.trim() } as User);
    }
  }

  async function signInWithGoogle() {
    const credential = await googleSignIn();
    return credential !== null;
  }

  async function signInWithApple() {
    const credential = await appleSignIn();
    return credential !== null;
  }

  async function signOut() {
    // `user` as well as currentUser: while the app is still showing the
    // remembered account, Firebase hasn't restored its session yet, so
    // currentUser is null even though someone is signed in.
    const signedInUid = auth.currentUser?.uid ?? user?.uid;
    if (signedInUid) {
      // The offline copies belong to a signed-in session, so they end with
      // it. Keyed by uid, they were never readable by the next person to sign
      // in here. But someone's training history and weight shouldn't outstay
      // them on a shared phone either. Signing back in reads them fresh.
      //
      // The offline copy goes first, before the UI lets go of the account.
      // Closing it any later could save it to disk again after the delete.
      signedOutUid.current = signedInUid;
      await forgetCloudData(signedInUid);
      await forgetCachedBodyweight(signedInUid);
      await forgetRememberedUser();
      setUser(null);
      await firebaseSignOut(auth);
      return;
    }
    // A guest has no session to end. Leaving guest mode returns them to the
    // sign-in screen with their device data untouched, so resuming picks up
    // exactly where they left off.
    await writeGuestActive(false);
    setGuestActive(false);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email.trim());
  }

  async function resendVerificationEmail() {
    const current = auth.currentUser;
    if (!current) throw new Error("No signed-in account.");
    await sendEmailVerification(current);
  }

  async function refreshUser() {
    const current = auth.currentUser;
    if (!current) return;
    await current.reload();
    // reload() mutates currentUser in place without re-emitting
    // onAuthStateChanged; hand React a fresh object so the UI updates.
    setUser({ ...current } as User);
  }

  async function updateDisplayName(name: string) {
    const current = auth.currentUser;
    if (!current) throw new Error("No signed-in account.");
    const trimmed = name.trim();
    await updateProfile(current, { displayName: trimmed });
    // updateProfile mutates currentUser but doesn't re-emit onAuthStateChanged,
    // so hand React a fresh object to trigger a re-render (same as signUp).
    setUser({ ...current, displayName: trimmed } as User);
  }

  async function deleteAccount(password?: string) {
    const current = auth.currentUser;
    if (!current) throw new Error("No signed-in account.");
    // Firebase refuses to delete stale sessions; re-verify identity first so
    // the data wipe never runs unless the account deletion can follow. How we
    // re-verify depends on how they signed in — Apple/Google accounts have no
    // password, so they confirm through their native sign-in sheet instead.
    const providers = current.providerData.map((p) => p.providerId);
    if (providers.includes("password")) {
      if (!current.email) throw new Error("No email on this account.");
      await reauthenticateWithCredential(
        current,
        EmailAuthProvider.credential(current.email, password ?? "")
      );
    } else if (providers.includes("apple.com")) {
      if (!(await reauthenticateWithApple(current))) return false;
    } else if (providers.includes("google.com")) {
      if (!(await reauthenticateWithGoogle(current))) return false;
    }
    await deleteAllUserData(current.uid);
    // The device keeps copies for offline starts: the weigh-in log and the
    // offline copy of everything else. They go with the account, the same as
    // they go on sign-out.
    await forgetCloudData(current.uid);
    await forgetCachedBodyweight(current.uid);
    await forgetRememberedUser();
    await deleteUser(current);
    return true;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: authLoading || !guestChecked,
        isGuest,
        dataUserId: user?.uid ?? (guestActive ? GUEST_USER_ID : null),
        continueAsGuest,
        migrating,
        discardGuestData,
        signIn,
        signUp,
        signInWithGoogle,
        canUseGoogle: googleSignInAvailable,
        signInWithApple,
        canUseApple: appleSignInSupported,
        signOut,
        unsyncedChangeCount: () => (user ? pendingChangeCount(user.uid) : 0),
        offlineDiagnostics: () => offlineDiagnostics(user?.uid ?? null),
        resetPassword,
        resendVerificationEmail,
        refreshUser,
        updateDisplayName,
        deleteAccount,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
