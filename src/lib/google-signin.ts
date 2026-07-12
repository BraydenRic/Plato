import type { UserCredential } from "firebase/auth";

// Google sign-in is deferred until the app moves to development builds.
// The native package (@react-native-google-signin/google-signin) is fully
// removed for now: even when unused, its presence made EAS auto-link the
// native GoogleSignIn pod, whose AppCheckCore dependency breaks `pod install`
// without the config plugin. v1 ships with email/password only.
//
// To bring it back: `npx expo install @react-native-google-signin/google-signin`,
// re-add its config plugin to app.json with the reversed iOS client ID, set
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and restore this file from git history
// (commit 55f5945 or earlier).
export const googleSignInAvailable = false;

export async function signInWithGoogle(): Promise<UserCredential | null> {
  throw new Error("Google sign-in isn't available in this build.");
}
