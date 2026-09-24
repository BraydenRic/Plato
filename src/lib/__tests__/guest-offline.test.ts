import AsyncStorage from "@react-native-async-storage/async-storage";

import { makeWorkout } from "./factories";

/**
 * Guest mode has always worked with no signal, because a guest's data never
 * leaves the phone. The offline layer for accounts (cloud-cache) sits right
 * next to it in data.ts, so this pins down that a guest never reaches it or
 * Firestore. It runs a whole session, start to finish, through the real
 * data.ts and guest store, with both cloud modules rigged to fail the test the
 * moment anything touches them.
 */

jest.mock("../cloud-cache", () =>
  new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === "__esModule") return true;
        if (name === "LibraryNotLoadedError") return class extends Error {};
        return () => {
          throw new Error(`guest mode reached cloud-cache.${String(name)}`);
        };
      },
    }
  )
);

jest.mock("../firestore", () => {
  const touched = (name: string) => () => {
    throw new Error(`guest mode reached firestore.${name}`);
  };
  return {
    // Pure helpers data.ts re-exports; no network in any of them.
    stripUndefined: (value: unknown) =>
      JSON.parse(JSON.stringify(value ?? null), (_k, v) =>
        typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v
      ),
    computeStats: () => ({}),
    sanitizeExercises: (x: unknown) => x,
    EMPTY_WEEKLY_PLAN: [null, null, null, null, null, null, null],
    sendWrite: touched("sendWrite"),
    listenWorkouts: touched("listenWorkouts"),
    listenUserDoc: touched("listenUserDoc"),
  };
});

type Data = typeof import("../data");
const GUEST = "local-guest";
let data: Data;

// A fresh guest store per test: it caches the phone's data in memory, so
// without this one test's workouts would carry into the next.
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.resetModules();
  data = require("../data");
});

it("runs a whole guest session on the phone, never touching the cloud", async () => {
  const seen: string[][] = [];
  const stop = data.subscribeWorkouts(GUEST, (list) => seen.push(list.map((w) => w.name)));

  // Start a workout, log a set, finish it.
  const { id, saved } = data.createWorkoutLocalFirst(
    makeWorkout({ userId: GUEST, name: "Push", startedAt: new Date() })
  );
  await saved;
  expect(data.isGuestUserId(GUEST)).toBe(true);
  await data.updateWorkout(id, { exercises: [] });
  await data.updateWorkout(id, { completedAt: new Date(), durationMinutes: 45 });
  const completed = await data.getCompletedWorkouts(GUEST);
  await data.upsertUserStats({ userId: GUEST, ...data.computeStats(completed) } as never);
  expect(completed.map((w) => w.id)).toEqual([id]);

  // Save it as a template, resume it, delete it.
  const finished = (await data.getWorkout(id))!;
  await data.saveAsTemplate(finished, "Push template");
  await data.reopenWorkout(finished);
  await data.deleteWorkout(finished);

  // Library, weekly split and weigh-ins.
  await data.updateExerciseLibrary(GUEST, { custom: [], removedIds: ["bench-press"], overrides: [] });
  await data.setWeeklyPlan(GUEST, ["t", null, null, null, null, null, null]);
  await data.setBodyweightLog(GUEST, [{ date: new Date(), lbs: 180 }]);
  expect((await data.getBodyweightLog(GUEST)).map((e) => e.lbs)).toEqual([180]);

  stop();
  expect(seen.at(-1)).toEqual(["Push template"]);
});

it("keeps a guest's data across a restart, since it all lives on the phone", async () => {
  const { saved } = data.createWorkoutLocalFirst(makeWorkout({ userId: GUEST, name: "Legs" }));
  await saved;

  jest.resetModules();
  const fresh = require("../data") as Data;

  const names = await new Promise<string[]>((resolve) => {
    const stop = fresh.subscribeWorkouts(GUEST, (list) => {
      stop();
      resolve(list.map((w) => w.name));
    });
  });
  expect(names).toEqual(["Legs"]);
});
