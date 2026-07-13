import { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { appleSignInSupported, signInWithApple as appleSignIn } from "@/lib/apple-signin";
import { auth } from "@/lib/firebase";
import { deleteAllUserData } from "@/lib/firestore";
import { googleSignInAvailable, signInWithGoogle as googleSignIn } from "@/lib/google-signin";

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
  /** Permanently removes the user's data and auth account. Needs their password. */
  deleteAccount: (password: string) => Promise<void>;
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
  deleteAccount: async () => {},
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

  async function deleteAccount(password: string) {
    const current = auth.currentUser;
    if (!current?.email) throw new Error("No signed-in account.");
    // Firebase refuses to delete stale sessions; re-verify the password first
    // so the data wipe never runs unless the account deletion can follow.
    await reauthenticateWithCredential(
      current,
      EmailAuthProvider.credential(current.email, password)
    );
    await deleteAllUserData(current.uid);
    await deleteUser(current);
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
        deleteAccount,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
