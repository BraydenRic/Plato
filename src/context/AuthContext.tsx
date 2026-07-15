import { createContext, useContext, useEffect, useState } from "react";
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
import { auth } from "@/lib/firebase";
import { deleteAllUserData } from "@/lib/firestore";
import {
  googleSignInAvailable,
  reauthenticateWithGoogle,
  signInWithGoogle as googleSignIn,
} from "@/lib/google-signin";

interface AuthContextType {
  user: User | null;
  loading: boolean;
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
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => false,
  canUseGoogle: false,
  signInWithApple: async () => false,
  canUseApple: false,
  signOut: async () => {},
  resetPassword: async () => {},
  resendVerificationEmail: async () => {},
  refreshUser: async () => {},
  updateDisplayName: async () => {},
  deleteAccount: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
    await firebaseSignOut(auth);
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
    await deleteUser(current);
    return true;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        canUseGoogle: googleSignInAvailable,
        signInWithApple,
        canUseApple: appleSignInSupported,
        signOut,
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
