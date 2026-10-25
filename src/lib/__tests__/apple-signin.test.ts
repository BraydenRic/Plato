import { reauthenticateWithApple, revokeAppleAuthorization } from "../apple-signin";

/**
 * Revoking Sign in with Apple when an account is deleted, which Apple's
 * account-deletion rules ask for. Firebase's JS SDK can only revoke an Apple
 * access token, and the native sheet never hands one over, so the app makes
 * the Identity Toolkit call Firebase's iOS SDK makes with an authorization
 * code. Hand-rolled, so its shape is pinned here.
 */

const mockReauthenticate = jest.fn(async () => ({}));

jest.mock("expo-apple-authentication", () => ({
  signInAsync: async () => ({
    identityToken: "apple-identity-token",
    authorizationCode: "apple-auth-code",
    fullName: null,
  }),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "nonce",
  digestStringAsync: async () => "hashed-nonce",
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
jest.mock("firebase/auth", () => ({
  OAuthProvider: class {
    credential(options: unknown) {
      return options;
    }
  },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticate(...(args as [])),
  signInWithCredential: async () => ({ user: {} }),
  updateProfile: async () => {},
}));
jest.mock("../firebase", () => ({
  auth: { config: { apiKey: "the-api-key", apiHost: "identitytoolkit.googleapis.com", apiScheme: "https" } },
}));
jest.mock("../google-signin", () => ({ isExpoGo: false }));

const user = { getIdToken: async () => "firebase-id-token" } as never;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
  global.fetch = fetchMock as unknown as typeof fetch;
});

it("hands back the sheet's authorization code after re-verifying", async () => {
  expect(await reauthenticateWithApple(user)).toEqual({ authorizationCode: "apple-auth-code" });
  expect(mockReauthenticate).toHaveBeenCalled();
});

it("asks Firebase to revoke that code, as its iOS SDK does", async () => {
  await revokeAppleAuthorization(user, "apple-auth-code");

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=the-api-key");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({
    providerId: "apple.com",
    tokenType: "CODE",
    token: "apple-auth-code",
    idToken: "firebase-id-token",
  });
});

it("fails loudly when Firebase refuses, so the caller can log it", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => "INVALID_IDP_RESPONSE" });

  await expect(revokeAppleAuthorization(user, "apple-auth-code")).rejects.toThrow(/400/);
});
