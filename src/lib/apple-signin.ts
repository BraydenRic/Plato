import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  OAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  updateProfile,
  type OAuthCredential,
  type User,
  type UserCredential,
} from "firebase/auth";
import { Platform } from "react-native";

import { auth } from "./firebase";
import { isExpoGo } from "./google-signin";

// Apple's module does exist inside Expo Go, but the identity token it returns
// there belongs to Expo Go's bundle ID, which Firebase rejects — so the button
// only appears in real builds, same as Google.
export const appleSignInSupported = Platform.OS === "ios" && !isExpoGo;

/** Resolves true on iOS 13+ devices where Sign in with Apple can run. */
export async function appleSignInAvailable(): Promise<boolean> {
  if (!appleSignInSupported) return false;
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Runs the native Apple sheet and converts the result into a Firebase
 * credential. Resolves to null if the user dismissed the sheet (not an
 * error — callers should just do nothing).
 */
async function getAppleFirebaseCredential(): Promise<{
  firebaseCredential: OAuthCredential;
  fullName: AppleAuthentication.AppleAuthenticationFullName | null;
} | null> {
  // Firebase requires a nonce round-trip to prove the token was minted for
  // this sign-in attempt: Apple gets the SHA-256 hash, Firebase gets the raw
  // value, and Firebase verifies the hash embedded in the token matches.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      return null; // user closed the Apple sheet
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error("Apple returned no identity token. Try again.");
  }

  return {
    firebaseCredential: new OAuthProvider("apple.com").credential({
      idToken: credential.identityToken,
      rawNonce,
    }),
    fullName: credential.fullName,
  };
}

/**
 * Runs the native Sign in with Apple sheet, then exchanges Apple's identity
 * token for a Firebase session. Resolves to null if the user dismissed the
 * sheet (not an error — the caller should just do nothing).
 */
export async function signInWithApple(): Promise<UserCredential | null> {
  const fresh = await getAppleFirebaseCredential();
  if (!fresh) return null;
  const result = await signInWithCredential(auth, fresh.firebaseCredential);

  // Apple only shares the name on the very first authorization, and Firebase
  // doesn't store it automatically — persist it now or it's gone for good.
  const givenName = fresh.fullName?.givenName;
  if (givenName && !result.user.displayName) {
    const fullName = [givenName, fresh.fullName?.familyName].filter(Boolean).join(" ");
    await updateProfile(result.user, { displayName: fullName });
  }

  return result;
}

/**
 * Re-verifies an Apple-signed-in user before a sensitive operation (account
 * deletion) by running the Apple sheet again — these users have no password
 * to type. Resolves false if they dismissed the sheet.
 */
export async function reauthenticateWithApple(user: User): Promise<boolean> {
  const fresh = await getAppleFirebaseCredential();
  if (!fresh) return false;
  await reauthenticateWithCredential(user, fresh.firebaseCredential);
  return true;
}
