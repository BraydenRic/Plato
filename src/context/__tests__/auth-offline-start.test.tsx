import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthProvider, useAuth } from "../AuthContext";

/**
 * Opening on a bad signal. Firebase checks a saved session with the server
 * before reporting it, and on a connected-but-dead gym signal that check sits
 * out a 60-second timeout, splash screen and all. So the app opens on the
 * account it remembers and lets Firebase confirm it afterwards. These pin
 * that down, along with the ways it must not go wrong: Firebase's answer
 * always wins, and signing out mid-wait stays signed out.
 */

const mockCalls: string[] = [];
let mockEmitAuth: (user: unknown) => void = () => {};
let mockCurrentUser: unknown = null;
let mockSynced: (() => void) | null = null;
const mockMigrate = jest.fn(async (_uid: string) => null);
let mockGuestHasData = false;

jest.mock("@/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    mockEmitAuth = cb;
    return () => {};
  },
  signOut: async () => {
    mockCalls.push("signOut");
  },
  deleteUser: async () => {},
  reauthenticateWithCredential: async () => {},
  EmailAuthProvider: { credential: () => ({}) },
  sendEmailVerification: async () => {},
  sendPasswordResetEmail: async () => {},
  signInWithEmailAndPassword: async () => {},
  createUserWithEmailAndPassword: async () => {},
  updateProfile: async () => {},
}));
jest.mock("@/lib/bodyweight-cache", () => ({ forgetCachedBodyweight: async () => {} }));
jest.mock("@/lib/cloud-cache", () => ({
  openCloudSession: (uid: string) => mockCalls.push(`open:${uid}`),
  closeCloudSession: async () => {},
  whenCloudSynced: () => new Promise<void>((resolve) => (mockSynced = resolve)),
  pendingChangeCount: () => 0,
  forgetCloudData: async (uid: string) => {
    mockCalls.push(`forgetCloud:${uid}`);
  },
}));
jest.mock("@/lib/firestore", () => ({ deleteAllUserData: async () => {} }));
jest.mock("@/lib/local-store", () => ({
  GUEST_USER_ID: "local-guest",
  readGuestActive: async () => mockGuestHasData,
  writeGuestActive: async () => {},
  readGuestData: async () => ({}),
  hasContent: () => mockGuestHasData,
  clearGuestData: async () => {},
}));
jest.mock("@/lib/migrate-guest-data", () => ({ migrateGuestDataTo: (uid: string) => mockMigrate(uid) }));
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

const REMEMBERED = "plato.account.v1";
const realUser = {
  uid: "u1",
  email: "lifter@example.com",
  displayName: "Sam",
  emailVerified: true,
  providerData: [{ providerId: "apple.com" }],
};

let auth: ReturnType<typeof useAuth>;
function Capture() {
  auth = useAuth();
  return <Text>{auth.user?.uid ?? "none"}</Text>;
}

async function mount() {
  render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await act(async () => {});
}

beforeEach(async () => {
  mockCalls.length = 0;
  mockCurrentUser = null;
  mockEmitAuth = () => {};
  mockMigrate.mockClear();
  mockSynced = null;
  mockGuestHasData = false;
  await AsyncStorage.clear();
});

it("opens on the remembered account without waiting for Firebase", async () => {
  await AsyncStorage.setItem(
    REMEMBERED,
    JSON.stringify({ uid: "u1", email: "lifter@example.com", displayName: "Sam", emailVerified: true, providerIds: ["apple.com"] })
  );

  await mount();

  expect(auth.loading).toBe(false);
  expect(auth.dataUserId).toBe("u1");
  expect(auth.user?.displayName).toBe("Sam");
  expect(mockCalls).toContain("open:u1");
});

it("falls back to Firebase's own saved session on the first launch after updating", async () => {
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = "key";
  await AsyncStorage.setItem("firebase:authUser:key:[DEFAULT]", JSON.stringify(realUser));

  await mount();

  expect(auth.dataUserId).toBe("u1");
  expect(auth.user?.providerData.map((p) => p.providerId)).toEqual(["apple.com"]);
});

it("waits for Firebase as before when nothing is remembered", async () => {
  await mount();
  expect(auth.loading).toBe(true);

  await act(async () => mockEmitAuth(null));

  expect(auth.loading).toBe(false);
  expect(auth.user).toBeNull();
});

it("lets Firebase's answer win: a session it no longer has goes to sign-in and is forgotten", async () => {
  await AsyncStorage.setItem(REMEMBERED, JSON.stringify({ uid: "u1", emailVerified: true, providerIds: [] }));
  await mount();
  expect(auth.dataUserId).toBe("u1");

  await act(async () => mockEmitAuth(null));

  expect(auth.user).toBeNull();
  expect(await AsyncStorage.getItem(REMEMBERED)).toBeNull();
});

it("remembers the account Firebase confirms, for the next launch", async () => {
  await mount();

  await act(async () => mockEmitAuth(realUser));

  expect(JSON.parse((await AsyncStorage.getItem(REMEMBERED))!)).toMatchObject({
    uid: "u1",
    displayName: "Sam",
    providerIds: ["apple.com"],
  });
});

it("stays signed out when Firebase finishes restoring after the user signed out", async () => {
  await AsyncStorage.setItem(REMEMBERED, JSON.stringify({ uid: "u1", emailVerified: true, providerIds: [] }));
  await mount();

  // Signed out while Firebase is still restoring, so currentUser is null.
  await act(async () => {
    await auth.signOut();
  });
  expect(auth.user).toBeNull();
  expect(mockCalls).toEqual(expect.arrayContaining(["forgetCloud:u1", "signOut"]));

  // Firebase then finishes and briefly reports the user it restored.
  await act(async () => mockEmitAuth(realUser));
  expect(auth.user).toBeNull();

  // Its sign-out lands; a later sign-in to the same account works normally.
  await act(async () => mockEmitAuth(null));
  await act(async () => mockEmitAuth(realUser));
  expect(auth.user?.uid).toBe("u1");
});

describe("moving guest data into the account", () => {
  afterEach(() => jest.useRealTimers());

  it("shows the moving screen at once, as it always has, and moves once the server answers", async () => {
    mockGuestHasData = true;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await waitFor(() => expect(mockSynced).not.toBeNull());

    expect(auth.migrating).toBe(true);
    expect(mockMigrate).not.toHaveBeenCalled();

    await act(async () => mockSynced!());

    await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith("u1"));
  });

  it("steps aside with no signal instead of blocking the app, and moves once it's back", async () => {
    jest.useFakeTimers();
    mockGuestHasData = true;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    expect(auth.migrating).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    expect(auth.migrating).toBe(false);
    expect(mockMigrate).not.toHaveBeenCalled();

    await act(async () => mockSynced!());
    await act(async () => {});

    expect(mockMigrate).toHaveBeenCalledWith("u1");
  });
});
