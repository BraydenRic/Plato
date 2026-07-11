import Constants, { ExecutionEnvironment } from "expo-constants";
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from "firebase/auth";
import { auth } from "./firebase";

// Expo Go ships a fixed set of native modules, and Google Sign-In isn't one of
// them — it only exists in development/production builds. Everything here is
// gated on this flag so the sign-in screen can hide the button in Expo Go
// instead of crashing.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const googleSignInAvailable = !isExpoGo;

let configured = false;

// Lazy require: a top-level `import` of this package throws in Expo Go the
// moment the module is evaluated, because it looks up its native module on load.
function nativeModule(): typeof import("@react-native-google-signin/google-signin") {
  return require("@react-native-google-signin/google-signin");
}

/**
 * Runs the native Google sign-in flow, then exchanges the Google ID token for
 * a Firebase session. Resolves to null if the user dismissed the Google sheet
 * (not an error — the caller should just do nothing).
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  if (!googleSignInAvailable) {
    throw new Error("Google sign-in needs a development build — it can't run inside Expo Go.");
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — see README (Google sign-in setup).");
  }

  const { GoogleSignin, isSuccessResponse, statusCodes, isErrorWithCode } = nativeModule();

  if (!configured) {
    // The web (not iOS/Android) client ID is what makes Google include an
    // idToken in the response, which is the credential Firebase accepts.
    GoogleSignin.configure({ webClientId });
    configured = true;
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      return null; // user closed the account picker
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error("Google returned no ID token — check that the web client ID is correct.");
    }

    return await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw e;
  }
}
