import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import { Alert, Text } from "react-native";

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
const mockMigrate = jest.fn(
  async (_uid: string, _onProgress?: () => void, _shouldStop?: () => boolean): Promise<unknown> => null
);
let mockGuestHasData = false;
/** Runs as account deletion starts wiping the account's data. */
let mockOnDeleteData: () => void = () => {};
/**
 * Firebase runs its sign-out in a queue, behind a session restore still
 * under way. Set this to hold it there until the test calls mockReleaseSignOut.
 */
let mockHoldSignOut = false;
let mockReleaseSignOut: () => void = () => {};

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
  signOut: () => {
    mockCalls.push("signOut");
    const land = () => {
      mockCurrentUser = null;
    };
    if (!mockHoldSignOut) {
      land();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      mockReleaseSignOut = () => {
        land();
        resolve();
      };
    });
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
    // As the real one does: closing the copy releases anyone waiting on it.
    mockSynced?.();
  },
}));
jest.mock("@/lib/firestore", () => ({ deleteAllUserData: async () => mockOnDeleteData() }));
jest.mock("@/lib/local-store", () => ({
  GUEST_USER_ID: "local-guest",
  readGuestActive: async () => mockGuestHasData,
  writeGuestActive: async (active: boolean) => {
    mockCalls.push(`guestActive:${active}`);
  },
  readGuestData: async () => ({}),
  hasContent: () => mockGuestHasData,
  clearGuestData: async () => {},
}));
jest.mock("@/lib/migrate-guest-data", () => ({
  migrateGuestDataTo: (uid: string, onProgress?: () => void, shouldStop?: () => boolean) =>
    mockMigrate(uid, onProgress, shouldStop),
}));
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
  const view = render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await act(async () => {});
  return view;
}

beforeEach(async () => {
  mockCalls.length = 0;
  mockCurrentUser = null;
  mockEmitAuth = () => {};
  mockMigrate.mockReset();
  mockMigrate.mockResolvedValue(null);
  mockSynced = null;
  mockGuestHasData = false;
  mockOnDeleteData = () => {};
  mockHoldSignOut = false;
  mockReleaseSignOut = () => {};
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
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

  // Signed out while Firebase is still restoring, so currentUser is null, and
  // Firebase's own sign-out waits behind that restore.
  mockHoldSignOut = true;
  act(() => {
    void auth.signOut();
  });
  await waitFor(() => expect(auth.user).toBeNull());
  expect(mockCalls).toEqual(expect.arrayContaining(["forgetCloud:u1", "signOut"]));

  // Firebase then finishes and briefly reports the user it restored.
  await act(async () => mockEmitAuth(realUser));
  expect(auth.user).toBeNull();

  // Its sign-out lands; a later sign-in to the same account works normally.
  await act(async () => {
    mockReleaseSignOut();
    mockEmitAuth(null);
  });
  await act(async () => mockEmitAuth(realUser));
  expect(auth.user?.uid).toBe("u1");
});

describe("a sign-out Firebase hadn't finished when the app closed", () => {
  it("still holds on the next launch", async () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = "key";
    // Firebase's own saved session, which only its sign-out removes.
    await AsyncStorage.setItem("firebase:authUser:key:[DEFAULT]", JSON.stringify(realUser));
    await AsyncStorage.setItem(REMEMBERED, JSON.stringify({ uid: "u1", emailVerified: true, providerIds: ["apple.com"] }));
    const firstLaunch = render(
      <AuthProvider>
        <Capture />
      </AuthProvider>
    );
    await act(async () => {});
    expect(auth.user?.uid).toBe("u1");

    // Signed out on a dead signal, and the app closed before Firebase's
    // sign-out got out of its queue.
    mockHoldSignOut = true;
    act(() => {
      void auth.signOut();
    });
    await waitFor(() => expect(mockCalls).toContain("signOut"));
    firstLaunch.unmount();
    mockCalls.length = 0;

    await mount();

    // Not opened on the account signed out of, though Firebase's copy is
    // still on disk, and Firebase is told again to finish signing out.
    expect(auth.user).toBeNull();
    expect(mockCalls).toContain("signOut");

    // Firebase restores the session it had saved: it doesn't get in.
    await act(async () => mockEmitAuth(realUser));
    expect(auth.user).toBeNull();

    // Once that sign-out lands, signing back in works as normal.
    await act(async () => {
      mockReleaseSignOut();
      mockEmitAuth(null);
    });
    expect(await AsyncStorage.getItem("plato.signedOut.v1")).toBeNull();
    await act(async () => mockEmitAuth(realUser));
    expect(auth.user?.uid).toBe("u1");
  });

  // The account it would have opened on is skipped, so nothing else will
  // end the splash but Firebase, whose restore and the sign-out queued
  // behind it can take a minute on a dead signal.
  it("opens signed out straight away rather than waiting for Firebase", async () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = "key";
    await AsyncStorage.setItem("firebase:authUser:key:[DEFAULT]", JSON.stringify(realUser));
    await AsyncStorage.setItem("plato.signedOut.v1", "u1");
    mockHoldSignOut = true;

    await mount();

    expect(auth.loading).toBe(false);
    expect(auth.user).toBeNull();

    // Firebase gets round to reporting the session it restored. Still out.
    await act(async () => mockEmitAuth(realUser));
    expect(auth.loading).toBe(false);
    expect(auth.user).toBeNull();
  });
});

describe("an account signed out of while a request for it was still out", () => {
  // The verify screen re-checks the account every few seconds. Firebase still
  // finishes a reload for a user it has let go of.
  it("isn't brought back when a re-check lands after the sign-out", async () => {
    let finishReload: () => void = () => {};
    const user = {
      ...realUser,
      emailVerified: false,
      providerData: [{ providerId: "password" }],
      reload: () => new Promise<void>((resolve) => (finishReload = resolve)),
    };
    mockCurrentUser = user;
    await mount();
    await act(async () => mockEmitAuth(user));

    let checking: Promise<boolean> = Promise.resolve(false);
    act(() => {
      checking = auth.refreshUser();
    });
    await act(async () => {
      await auth.signOut();
      mockEmitAuth(null);
    });
    expect(auth.user).toBeNull();

    await act(async () => {
      finishReload();
      await checking;
    });

    expect(auth.user).toBeNull();
    expect(await AsyncStorage.getItem(REMEMBERED)).toBeNull();
    // And signing back in to that account isn't turned away.
    await act(async () => mockEmitAuth(user));
    expect(auth.user?.uid).toBe("u1");
  });

  // Firebase reports only changes. Signing out of a session it had already
  // dropped says nothing, and the next sign-in to it must still get through.
  it("lets the next sign-in through when Firebase had nothing to report", async () => {
    mockCurrentUser = realUser;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    mockCurrentUser = null;

    await act(async () => {
      await auth.signOut();
    });
    expect(auth.user).toBeNull();

    await act(async () => mockEmitAuth(realUser));
    expect(auth.user?.uid).toBe("u1");
  });
});

describe("a new email account that hasn't been verified", () => {
  function unverifiedUser() {
    const user = {
      uid: "u2",
      email: "jon.smith@gmial.com",
      displayName: null,
      emailVerified: false,
      providerData: [{ providerId: "password" }],
      reload: async () => {},
    };
    return user;
  }

  // The address could be a typo, or a stranger's. Moving the guest's history
  // in now would strand it there, or hand it to whoever owns that inbox.
  it("leaves the guest's data, and guest mode, on the phone", async () => {
    mockGuestHasData = true;
    const user = unverifiedUser();
    mockCurrentUser = user;
    await mount();
    await act(async () => mockEmitAuth(user));

    expect(auth.migrating).toBe(false);
    expect(mockSynced).toBeNull();
    expect(mockMigrate).not.toHaveBeenCalled();
    expect(mockCalls).not.toContain("guestActive:false");

    // "Wrong email? Sign out" puts them back in guest mode, data and all.
    await act(async () => {
      await auth.signOut();
    });
    expect(auth.user).toBeNull();
    expect(auth.isGuest).toBe(true);
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it("moves it once the link has been tapped", async () => {
    mockGuestHasData = true;
    const user = unverifiedUser();
    user.reload = async () => {
      user.emailVerified = true;
    };
    mockCurrentUser = user;
    await mount();
    await act(async () => mockEmitAuth(user));
    expect(mockMigrate).not.toHaveBeenCalled();

    let verified = false;
    await act(async () => {
      verified = await auth.refreshUser();
    });
    expect(verified).toBe(true);
    await waitFor(() => expect(mockSynced).not.toBeNull());
    await act(async () => mockSynced!());

    await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith("u2", expect.any(Function), expect.any(Function)));
  });
});

describe("moving guest data into the account", () => {
  afterEach(() => jest.useRealTimers());

  // The watch link waits on this. An op about a guest's workout applied
  // while it's half moved finds the guest's copy, is turned away by the
  // account, and is lost — so it has to cover every render of the move.
  describe("holding the watch's ops for it", () => {
    /** Every render's view of the move, in order. */
    let seen: { uid: string | null; underway: boolean; migrating: boolean }[] = [];
    function Watch() {
      const { user, guestMoveUnderway, migrating } = useAuth();
      seen.push({ uid: user?.uid ?? null, underway: guestMoveUnderway, migrating });
      return null;
    }
    async function mountWatched() {
      seen = [];
      render(
        <AuthProvider>
          <Capture />
          <Watch />
        </AuthProvider>
      );
      await act(async () => {});
    }

    it("holds from the render the account arrives until the move is done, past the moving screen", async () => {
      jest.useFakeTimers();
      mockGuestHasData = true;
      let finish: (result: unknown) => void = () => {};
      mockMigrate.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      await mountWatched();
      await act(async () => mockEmitAuth(realUser));
      await act(async () => {});
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      await act(async () => mockSynced!());
      await act(async () => {});
      expect(mockMigrate).toHaveBeenCalled();

      // Every render with the account in it so far, the first included,
      // which comes before the move has even started.
      const signedIn = seen.filter((s) => s.uid === "u1");
      expect(signedIn[0].migrating).toBe(false);
      expect(signedIn.every((s) => s.underway)).toBe(true);
      // The moving screen has stepped aside; the move hasn't finished.
      expect(auth.migrating).toBe(false);
      expect(auth.guestMoveUnderway).toBe(true);

      await act(async () => finish({ workouts: 1, customExercisesDropped: 0, templatesDropped: 0, activeWorkoutsDropped: 0 }));
      expect(auth.guestMoveUnderway).toBe(false);
    });

    it("lets go once a failed move gives up, rather than holding the watch until the next launch", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
      jest.spyOn(Alert, "alert").mockImplementation(() => {});
      mockGuestHasData = true;
      mockMigrate.mockRejectedValueOnce(new Error("failed-precondition"));
      await mountWatched();
      await act(async () => mockEmitAuth(realUser));
      await waitFor(() => expect(mockSynced).not.toBeNull());
      expect(auth.guestMoveUnderway).toBe(true);

      await act(async () => mockSynced!());

      await waitFor(() => expect(auth.guestMoveUnderway).toBe(false));
    });

    it("holds only for the moment it takes to see there's nothing to move", async () => {
      await mountWatched();
      await act(async () => mockEmitAuth(realUser));
      await act(async () => {});
      expect(auth.guestMoveUnderway).toBe(false);
      expect(mockMigrate).not.toHaveBeenCalled();
    });

    // The guest's data stays the guest's until the link is tapped, and the
    // watch with it (see watch-sync's useWatchUserId), so there's no move to wait on.
    it("doesn't hold for an account still waiting on its verification link", async () => {
      mockGuestHasData = true;
      const user = { ...realUser, emailVerified: false, providerData: [{ providerId: "password" }], reload: async () => {} };
      mockCurrentUser = user;
      await mountWatched();
      await act(async () => mockEmitAuth(user));
      expect(seen.filter((s) => s.uid === "u1").some((s) => s.underway)).toBe(false);
    });

    it("holds again when they sign back in to the same account", async () => {
      mockCurrentUser = realUser;
      await mountWatched();
      await act(async () => mockEmitAuth(realUser));
      await act(async () => {});
      expect(auth.guestMoveUnderway).toBe(false);
      await act(async () => {
        await auth.signOut();
      });

      mockGuestHasData = true;
      seen = [];
      mockCurrentUser = realUser;
      await act(async () => mockEmitAuth(realUser));

      expect(seen.find((s) => s.uid === "u1")?.underway).toBe(true);
      expect(auth.guestMoveUnderway).toBe(true);
    });
  });

  it("shows the moving screen at once, as it always has, and moves once the server answers", async () => {
    mockGuestHasData = true;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await waitFor(() => expect(mockSynced).not.toBeNull());

    expect(auth.migrating).toBe(true);
    expect(mockMigrate).not.toHaveBeenCalled();

    await act(async () => mockSynced!());

    await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith("u1", expect.any(Function), expect.any(Function)));
  });

  // The app's rule: nothing may interrupt a workout. Once the screen has
  // stepped aside they may be mid-set, and taking the app away again would
  // throw them out of the workout screen.
  it("steps aside with no signal, then moves behind the app once it's back, quietly", async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGuestHasData = true;
    mockMigrate.mockResolvedValue({ workouts: 3, customExercisesDropped: 2, templatesDropped: 0, activeWorkoutsDropped: 0 });
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

    expect(mockMigrate).toHaveBeenCalledWith("u1", expect.any(Function), expect.any(Function));
    expect(auth.migrating).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  // A long history uploads one workout at a time, and each upload waits for
  // the server. If the signal drops partway the screen mustn't hang there.
  it("steps aside when the uploads go quiet too, and not while they keep landing", async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGuestHasData = true;
    let progress: () => void = () => {};
    let finish: (result: unknown) => void = () => {};
    mockMigrate.mockImplementationOnce((_uid, onProgress) => {
      progress = onProgress!;
      return new Promise((resolve) => (finish = resolve));
    });
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => mockSynced!());
    await act(async () => {});
    expect(mockMigrate).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(4_000);
      progress();
      jest.advanceTimersByTime(4_000);
    });
    expect(auth.migrating).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(auth.migrating).toBe(false);

    await act(async () => finish({ workouts: 3, customExercisesDropped: 2, templatesDropped: 0, activeWorkoutsDropped: 0 }));
    expect(auth.migrating).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  it("tells someone still watching the moving screen what couldn't come across", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGuestHasData = true;
    mockMigrate.mockResolvedValue({ workouts: 3, customExercisesDropped: 2, templatesDropped: 0, activeWorkoutsDropped: 0 });
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await waitFor(() => expect(mockSynced).not.toBeNull());

    await act(async () => mockSynced!());

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith("Your workouts moved over", expect.stringContaining("2 custom exercises"))
    );
    // Said once is enough: no note on Profile as well.
    expect(auth.leftBehind).toBeNull();
  });

  // Finished behind the app, it can't say so out loud: they may be mid-set.
  // But the exercises are gone from the phone, so it can't go unsaid either.
  it("keeps what couldn't come across for Profile when the move finished behind the app", async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGuestHasData = true;
    mockMigrate.mockResolvedValue({ workouts: 3, customExercisesDropped: 2, templatesDropped: 1, activeWorkoutsDropped: 0 });
    const firstLaunch = await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await act(async () => mockSynced!());
    await act(async () => {});

    expect(alert).not.toHaveBeenCalled();
    expect(auth.leftBehind).toBe("2 custom exercises and 1 template");

    // Still there next launch, until it's dismissed.
    firstLaunch.unmount();
    mockGuestHasData = false;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    expect(auth.leftBehind).toBe("2 custom exercises and 1 template");

    await act(async () => auth.dismissLeftBehind());
    expect(auth.leftBehind).toBeNull();
    expect(await AsyncStorage.getItem("plato.leftBehind.v1:u1")).toBeNull();
  });

  // Signing out releases the wait for the server before it lets go of the
  // account, which used to start the move into the account on its way out
  // and leave "Moving your workouts" up for good.
  it("never starts moving into an account being signed out", async () => {
    jest.useFakeTimers();
    mockGuestHasData = true;
    mockCurrentUser = realUser;
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(auth.migrating).toBe(false);

    await act(async () => {
      await auth.signOut();
    });

    expect(auth.user).toBeNull();
    expect(auth.migrating).toBe(false);
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it("takes the moving screen down if the session ends partway through", async () => {
    jest.useFakeTimers();
    mockGuestHasData = true;
    // An upload the server never answers.
    mockMigrate.mockImplementationOnce(() => new Promise(() => {}));
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => mockSynced!());
    await act(async () => {});
    expect(mockMigrate).toHaveBeenCalled();
    expect(auth.migrating).toBe(true);

    await act(async () => mockEmitAuth(null));

    expect(auth.user).toBeNull();
    expect(auth.migrating).toBe(false);
  });

  // With the screen stepped aside, Sign out is in reach while an upload waits
  // on a dead signal. Firestore keeps that write for the account and sends it
  // when they sign back in, so the old run would wake up then and carry on
  // with what it read before, while it held the door shut on a fresh run.
  it("stops a move stuck on a write when its account signs out, and moves afresh on the next sign-in", async () => {
    jest.useFakeTimers();
    mockGuestHasData = true;
    mockCurrentUser = realUser;
    let shouldStop: () => boolean = () => false;
    mockMigrate.mockImplementationOnce((_uid, _onProgress, stop) => {
      shouldStop = stop!;
      return new Promise(() => {});
    });
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => mockSynced!());
    await act(async () => {});
    expect(shouldStop()).toBe(false);

    await act(async () => {
      await auth.signOut();
    });
    expect(shouldStop()).toBe(true);

    mockCurrentUser = realUser;
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => mockSynced!());
    await act(async () => {});

    expect(mockMigrate).toHaveBeenCalledTimes(2);
    // Signing back in doesn't wake the old one either.
    expect(shouldStop()).toBe(true);
  });

  // Deleting the account wipes what the server holds, from one look at it.
  // A move still writing behind the app would put data back after that look,
  // under a uid nobody can sign in as.
  it("stops the move before the account's data is wiped", async () => {
    jest.useFakeTimers();
    mockGuestHasData = true;
    mockCurrentUser = realUser;
    let shouldStop: () => boolean = () => false;
    mockMigrate.mockImplementationOnce((_uid, _onProgress, stop) => {
      shouldStop = stop!;
      return new Promise(() => {});
    });
    let stoppedBeforeWipe: boolean | null = null;
    mockOnDeleteData = () => {
      stoppedBeforeWipe = shouldStop();
    };
    await mount();
    await act(async () => mockEmitAuth(realUser));
    await act(async () => {});
    await act(async () => mockSynced!());
    await act(async () => {});

    await act(async () => {
      await auth.deleteAccount();
    });

    expect(stoppedBeforeWipe).toBe(true);
  });
});
