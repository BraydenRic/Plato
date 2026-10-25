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

/**
 * Runs the native Apple sheet and converts the result into a Firebase
 * credential. Resolves to null if the user dismissed the sheet (not an
 * error — callers should just do nothing).
 */
async function getAppleFirebaseCredential(): Promise<{
  firebaseCredential: OAuthCredential;
  fullName: AppleAuthentication.AppleAuthenticationFullName | null;
  /** Short-lived and single-use; what revoking the app's authorization takes. */
  authorizationCode: string | null;
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
    authorizationCode: credential.authorizationCode,
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
 * to type. Resolves null if they dismissed the sheet. Otherwise hands back
 * the sheet's authorization code, which deletion uses to revoke Plato's
 * access to their Apple ID.
 */
export async function reauthenticateWithApple(
  user: User
): Promise<{ authorizationCode: string | null } | null> {
  const fresh = await getAppleFirebaseCredential();
  if (!fresh) return null;
  await reauthenticateWithCredential(user, fresh.firebaseCredential);
  return { authorizationCode: fresh.authorizationCode };
}

/**
 * Revokes Plato's Sign in with Apple authorization, as Apple requires when an
 * account is deleted. Without it Plato stays listed under the user's Apple ID
 * and a later sign-up never gets their name again.
 *
 * Firebase's JS SDK can only revoke an Apple access token, which the native
 * sheet never produces, so this makes the same Identity Toolkit call Firebase's
 * iOS SDK makes with an authorization code (revokeToken(withAuthorizationCode:)).
 * Firebase exchanges the code with Apple and revokes the result, using the
 * Apple key set up for the provider in the Firebase console. Must run while
 * the account still exists: it needs the user's ID token.
 */
export async function revokeAppleAuthorization(user: User, authorizationCode: string): Promise<void> {
  const idToken = await user.getIdToken();
  const { apiScheme, apiHost, apiKey } = auth.config;
  const response = await fetch(
    `${apiScheme}://${apiHost}/v2/accounts:revokeToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "apple.com", tokenType: "CODE", token: authorizationCode, idToken }),
    }
  );
  if (!response.ok) {
    throw new Error(`Apple revoke failed (${response.status}): ${await response.text()}`);
  }
}
