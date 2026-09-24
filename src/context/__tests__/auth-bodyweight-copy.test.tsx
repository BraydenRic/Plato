import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../AuthContext";

/**
 * The device keeps copies of a signed-in user's data so the app works with no
 * signal: the weigh-in log, and the offline copy of everything else. The
 * privacy policy says those copies go when the session does — on sign-out and
 * on account deletion — so both are pinned here, along with the order: the
 * copies are dropped before the account is let go of.
 */

const calls: string[] = [];
const mockUser = {
  uid: "u1",
  email: "a@b.co",
  providerData: [{ providerId: "password" }],
};

// A getter, because jest hoists this factory above mockUser's declaration: a
// plain property would capture it before it exists.
jest.mock("@/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return mockUser;
    },
  },
}));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockUser);
    return () => {};
  },
  signOut: async () => {
    calls.push("signOut");
  },
  deleteUser: async () => {
    calls.push("deleteUser");
  },
  reauthenticateWithCredential: async () => {},
  EmailAuthProvider: { credential: () => ({}) },
  sendEmailVerification: async () => {},
  sendPasswordResetEmail: async () => {},
  signInWithEmailAndPassword: async () => {},
  createUserWithEmailAndPassword: async () => {},
  updateProfile: async () => {},
}));
jest.mock("@/lib/bodyweight-cache", () => ({
  forgetCachedBodyweight: async (uid: string) => {
    calls.push(`forget:${uid}`);
  },
}));
jest.mock("@/lib/cloud-cache", () => ({
  openCloudSession: () => {},
  closeCloudSession: async () => {},
  whenCloudSynced: async () => {},
  forgetCloudData: async (uid: string) => {
    calls.push(`forgetCloud:${uid}`);
  },
}));
jest.mock("@/lib/firestore", () => ({
  deleteAllUserData: async () => {
    calls.push("deleteData");
  },
}));
jest.mock("@/lib/migrate-guest-data", () => ({ migrateGuestDataTo: async () => null }));
jest.mock("@/lib/apple-signin", () => ({
  appleSignInSupported: false,
  reauthenticateWithApple: async () => true,
  signInWithApple: async () => null,
}));
jest.mock("@/lib/google-signin", () => ({
  googleSignInAvailable: false,
  reauthenticateWithGoogle: async () => true,
  signInWithGoogle: async () => null,
}));

let auth: ReturnType<typeof useAuth>;
function Capture() {
  auth = useAuth();
  return <Text>{auth.user?.uid ?? "none"}</Text>;
}

beforeEach(() => {
  calls.length = 0;
});

async function mounted() {
  render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  // Let the guest-flag read and the no-op migration settle.
  await act(async () => {});
}

it("drops the device's copies on sign-out, before signing out", async () => {
  await mounted();

  await act(async () => {
    await auth.signOut();
  });

  expect(calls).toEqual(["forgetCloud:u1", "forget:u1", "signOut"]);
});

it("drops it on account deletion too", async () => {
  await mounted();

  await act(async () => {
    await auth.deleteAccount("pw");
  });

  expect(calls).toEqual(["deleteData", "forgetCloud:u1", "forget:u1", "deleteUser"]);
});
