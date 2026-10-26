import AsyncStorage from "@react-native-async-storage/async-storage";
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
  revokeAppleAuthorization,
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
import { migrateGuestDataTo, type MigrationResult } from "@/lib/migrate-guest-data";
import {
  clearUnfinishedSignOut,
  forgetRememberedUser,
  isProvisional,
  readRememberedUser,
  readUnfinishedSignOut,
  recordUnfinishedSignOut,
  rememberUser,
} from "@/lib/remembered-account";
import {
  googleSignInAvailable,
  reauthenticateWithGoogle,
  signInWithGoogle as googleSignIn,
} from "@/lib/google-signin";
import { clearWatchTrace } from "@/lib/watch-trace";

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
  /**
   * What moving the guest's data in had to leave behind at the account's
   * limits ("2 custom exercises"), when the move finished behind the app and
   * couldn't say so then. Null when there's nothing to tell.
   */
  leftBehind: string | null;
  /** The note about `leftBehind` has been read. */
  dismissLeftBehind: () => void;
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
  /**
   * Re-checks the account with the server (e.g. to pick up email
   * verification). Resolves whether its email is verified.
   */
  refreshUser: () => Promise<boolean>;
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
  leftBehind: null,
  dismissLeftBehind: () => {},
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
  refreshUser: async () => false,
  updateDisplayName: async () => {},
  deleteAccount: async () => false,
});

/** How long "Moving your workouts" waits on a silent server before letting the app be used. */
const MIGRATION_PATIENCE_MS = 5_000;

/**
 * What a move left behind, per account, when it finished behind the app.
 * Nothing may pop up then, since they may be mid-workout, so it waits here
 * for a quiet note on Profile until that's dismissed.
 */
const leftBehindKey = (uid: string) => `plato.leftBehind.v1:${uid}`;

async function readLeftBehind(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(leftBehindKey(uid));
  } catch {
    return null;
  }
}

/** "2 custom exercises and 1 template", or null when everything came across. */
function describeLeftBehind(result: MigrationResult): string | null {
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
  return missing.length > 0 ? missing.join(" and ") : null;
}

/**
 * Hands a sign-out to Firebase and waits for it to land, then lifts the guard
 * that was ignoring that account meanwhile. Lifted here as well as when
 * Firebase reports no user, because Firebase reports only changes: signing
 * out of a session it had already dropped says nothing, and the guard would
 * otherwise turn away the next sign-in to that account.
 */
async function finishSignOut(signedOutUid: { current: string | null }, uid: string): Promise<void> {
  await firebaseSignOut(auth);
  if (signedOutUid.current === uid) signedOutUid.current = null;
  await clearUnfinishedSignOut();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [guestActive, setGuestActive] = useState(false);
  const [guestChecked, setGuestChecked] = useState(false);
  const [migrating, setMigrating] = useState(false);
  /** Tagged with its account, so one can't show while another is signed in. */
  const [leftBehind, setLeftBehind] = useState<{ uid: string; text: string } | null>(null);

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
    // A sign-out the last launch closed before Firebase could finish (see
    // remembered-account). Firebase may be restoring that very session, so
    // its sign-out is queued now, before this launch can queue anything
    // else, and every report below waits for this so none slips in first.
    const unfinishedSignOut = readUnfinishedSignOut().then((uid) => {
      if (!uid || cancelled) return;
      signedOutUid.current ??= uid;
      // Nothing will open on an account this launch: readRememberedUser skips
      // the one signed out of, and Firebase's report of it is turned away
      // below. So finish loading signed out now, rather than on the splash
      // until that queued sign-out lands, up to a minute on a dead signal.
      setAuthLoading(false);
      void finishSignOut(signedOutUid, uid);
    });
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
      void unfinishedSignOut.then(() => {
        if (cancelled) return;
        if (u && u.uid === signedOutUid.current) return;
        if (!u) {
          signedOutUid.current = null;
          // Firebase has no session, whether from a sign-out or one that expired
          // or was revoked. Either way, don't open on this account next launch.
          // Its offline copy stays, so unsent changes go up if they sign back in.
          forgetRememberedUser();
          void clearUnfinishedSignOut();
        } else {
          openCloudSession(u.uid);
        }
        setUser(u);
        setAuthLoading(false);
      });
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
  // Keyed on the uid (and whether it still needs verifying), not the user
  // object: refreshUser() hands React a new object every few seconds while the
  // verify-email screen polls, and re-running on those would start a second
  // upload of the same workouts. A run whose effect has ended writes nothing
  // more (see stillWanted below), so a re-run can start straight away.
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

  // A note left by a move that finished behind the app, maybe last launch.
  useEffect(() => {
    if (!uid) return;
    let current = true;
    void readLeftBehind(uid).then((text) => {
      if (current && text) setLeftBehind({ uid, text });
    });
    return () => {
      current = false;
    };
  }, [uid]);

  // The same rule as the verify-email gate in the root layout.
  const needsVerification =
    !!user &&
    user.providerData.some((p) => p.providerId === "password") &&
    !user.emailVerified;

  /**
   * The guest move under way, if any. Signing out or deleting the account
   * marks it stopped before anything is wiped, and its effect ending lets go
   * of it, so a write hung on a dead signal can't hold up the next sign-in.
   */
  const migrationRun = useRef<{ stopped: boolean } | null>(null);
  useEffect(() => {
    // An address nobody has proven yet could be a typo, or someone else's.
    // Moving the guest's history in now would strand it there, or hand it to
    // whoever owns that inbox. So it stays on the phone, guest flag and all,
    // until the link is tapped, and "Wrong email? Sign out" leaves them in
    // guest mode with everything where it was. Verifying flips this and runs
    // the move.
    if (!uid || needsVerification) return;
    let cancelled = false;
    const run = { stopped: false };
    migrationRun.current = run;
    /**
     * Whether to carry on. Once the moving screen steps aside the move runs
     * behind a usable app, where the account can be signed out of or deleted
     * at any point, so this is asked after every wait, here and inside
     * migrateGuestDataTo. Signing out releases waits before it lets go of
     * the account, hence signedOutUid as well as `cancelled`.
     */
    const stillWanted = () => !cancelled && !run.stopped && signedOutUid.current !== uid;
    /** "Moving your workouts" is up. Once it steps aside it stays down. */
    let blocking = false;
    let patience: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const guest = await readGuestData();
        if (!hasContent(guest)) {
          await writeGuestActive(false);
          if (!cancelled) setGuestActive(false);
          return;
        }
        if (!stillWanted()) return;
        // Moving data needs the server. With no signal every upload would
        // hang, and with it the full-screen "Moving your workouts" that
        // blocks the app. The screen goes up at once as it always has, since
        // that's the usual case right after signing in, which needs a
        // connection anyway. It stays up only while the server keeps
        // answering: if it goes quiet for a few seconds, first waiting for
        // it to answer at all or later between uploads, the screen steps
        // aside and the move carries on behind the app. It never comes back:
        // by then they may be mid-workout, and putting it back would throw
        // them out of the workout screen. The guest data is safe on the
        // phone meanwhile: each workout leaves it only once the server has it.
        blocking = true;
        setMigrating(true);
        const stepAsideIfQuiet = () => {
          clearTimeout(patience);
          if (!blocking) return;
          patience = setTimeout(() => {
            blocking = false;
            if (!cancelled) setMigrating(false);
          }, MIGRATION_PATIENCE_MS);
        };
        stepAsideIfQuiet();
        await whenCloudSynced(uid);
        // Moving into an account on its way out would fail, or half succeed.
        if (!stillWanted()) return;
        stepAsideIfQuiet();
        const result = await migrateGuestDataTo(uid, stepAsideIfQuiet, () => !stillWanted());
        // It finished, so the guest data is gone and the flag is off on disk,
        // whether or not the account is still here.
        setGuestActive(false);
        // Two things have ceilings a merge can run into: the exercise library is
        // a single document with a hard size limit, and templates are capped so
        // repeated guest sessions can't climb past the per-screen limit. Logged
        // workouts are never affected, which is what the closing line promises.
        // Say so — the alternative is someone noticing weeks later. Out loud
        // only to someone still watching the moving screen, who just signed
        // in. Once it has stepped aside they're using the app, perhaps
        // mid-set, and nothing may interrupt a workout, so it's kept for a
        // quiet note on Profile instead.
        const missing = result ? describeLeftBehind(result) : null;
        if (!missing || !stillWanted()) return;
        if (blocking) {
          Alert.alert(
            "Your workouts moved over",
            `${missing} couldn't come with them — your account was already at the limit. Every workout you logged is safe.`
          );
        } else {
          setLeftBehind({ uid, text: missing });
          await AsyncStorage.setItem(leftBehindKey(uid), missing).catch(() => {});
        }
      } catch (e) {
        // Stopped because the account went. Whatever hadn't moved is still
        // on the phone, and there's no one left to tell.
        if (!stillWanted()) return;
        console.warn("Couldn't move guest data into the account", e);
        // Same rule as above. Behind the app, the next launch simply tries
        // again; nothing needs saying.
        if (blocking) {
          Alert.alert(
            "Some workouts are still on this device",
            "We couldn't finish moving them into your account. They're safe here and we'll try again next time you open Plato."
          );
        }
      } finally {
        clearTimeout(patience);
        // Only while it's still the run in charge: a newer one may have the
        // moving screen up by the time a hung write lets this one finish.
        if (migrationRun.current === run) {
          migrationRun.current = null;
          setMigrating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(patience);
      // The account it was moving into is gone. Take the screen down now,
      // not when the upload gives up: one stuck on a refused write would
      // otherwise hold "Moving your workouts" up over the sign-in screen,
      // and keep the next sign-in from moving anything.
      if (migrationRun.current === run) migrationRun.current = null;
      setMigrating(false);
    };
  }, [uid, needsVerification]);

  /** Stops the guest move, if one is under way, before its account is wiped or let go of. */
  function stopMigration() {
    if (migrationRun.current) migrationRun.current.stopped = true;
  }

  function dismissLeftBehind() {
    if (!uid) return;
    setLeftBehind(null);
    AsyncStorage.removeItem(leftBehindKey(uid)).catch(() => {});
  }

  async function continueAsGuest() {
    await writeGuestActive(true);
    setGuestActive(true);
  }

  async function discardGuestData() {
    await clearGuestData();
    // The cardio diagnostics describe the same sessions, so they go too.
    await clearWatchTrace();
    await writeGuestActive(false);
    setGuestActive(false);
  }

  /**
   * Whether `current` is still the one signed in, after an await that a
   * sign-out may have overtaken. Firebase still finishes a reload or profile
   * update for a user it has let go of, and handing that user to React would
   * put the account back on screen.
   */
  function stillSignedIn(current: User): boolean {
    return auth.currentUser === current && signedOutUid.current !== current.uid;
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
      if (stillSignedIn(cred.user)) setUser({ ...cred.user, displayName: name.trim() } as User);
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
      //
      // Ahead of all of it, the sign-out itself is noted on disk, so closing
      // the app anywhere from here on still ends signed out (see
      // remembered-account). The diagnostics trace goes too: its lines are
      // the times and distances of this person's sessions.
      signedOutUid.current = signedInUid;
      stopMigration();
      await recordUnfinishedSignOut(signedInUid);
      await forgetCloudData(signedInUid);
      await forgetCachedBodyweight(signedInUid);
      await clearWatchTrace();
      await forgetRememberedUser();
      setUser(null);
      await finishSignOut(signedOutUid, signedInUid);
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
    if (!current) return false;
    await current.reload();
    // reload() mutates currentUser in place without re-emitting
    // onAuthStateChanged; hand React a fresh object so the UI updates.
    if (stillSignedIn(current)) setUser({ ...current } as User);
    return current.emailVerified;
  }

  async function updateDisplayName(name: string) {
    const current = auth.currentUser;
    if (!current) throw new Error("No signed-in account.");
    const trimmed = name.trim();
    await updateProfile(current, { displayName: trimmed });
    // updateProfile mutates currentUser but doesn't re-emit onAuthStateChanged,
    // so hand React a fresh object to trigger a re-render (same as signUp).
    if (stillSignedIn(current)) setUser({ ...current, displayName: trimmed } as User);
  }

  async function deleteAccount(password?: string) {
    const current = auth.currentUser;
    if (!current) throw new Error("No signed-in account.");
    // Firebase refuses to delete stale sessions; re-verify identity first so
    // the data wipe never runs unless the account deletion can follow. How we
    // re-verify depends on how they signed in — Apple/Google accounts have no
    // password, so they confirm through their native sign-in sheet instead.
    const providers = current.providerData.map((p) => p.providerId);
    let appleAuthorizationCode: string | null = null;
    if (providers.includes("password")) {
      if (!current.email) throw new Error("No email on this account.");
      await reauthenticateWithCredential(
        current,
        EmailAuthProvider.credential(current.email, password ?? "")
      );
    } else if (providers.includes("apple.com")) {
      const apple = await reauthenticateWithApple(current);
      if (!apple) return false;
      appleAuthorizationCode = apple.authorizationCode;
    } else if (providers.includes("google.com")) {
      if (!(await reauthenticateWithGoogle(current))) return false;
    }
    // A guest move still running behind the app would go on writing into the
    // account after the wipe below had looked, leaving data behind under a
    // uid nobody can sign in as. Whatever it already sent is queued ahead of
    // the wipe, so the wipe takes that too.
    stopMigration();
    await deleteAllUserData(current.uid);
    // The device keeps copies for offline starts: the weigh-in log and the
    // offline copy of everything else. They go with the account, the same as
    // they go on sign-out.
    await forgetCloudData(current.uid);
    await forgetCachedBodyweight(current.uid);
    await AsyncStorage.removeItem(leftBehindKey(current.uid)).catch(() => {});
    await clearWatchTrace();
    await forgetRememberedUser();
    // Apple asks apps to revoke Sign in with Apple when the account goes. It
    // needs the account to still exist, so it comes before deleteUser. Best
    // effort: they asked for the account to be deleted, and a revoke that
    // fails (no signal, the provider not set up for it) mustn't stop that.
    if (appleAuthorizationCode) {
      try {
        await revokeAppleAuthorization(current, appleAuthorizationCode);
      } catch (e) {
        console.warn("Couldn't revoke Sign in with Apple", e);
      }
    }
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
        leftBehind: leftBehind?.uid === uid ? leftBehind.text : null,
        dismissLeftBehind,
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
