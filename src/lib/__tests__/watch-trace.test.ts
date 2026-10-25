import AsyncStorage from "@react-native-async-storage/async-storage";

import { recordCardioDiscard, cardioDiscards, resetCardioDiscards } from "../cardio-discards";
import { readWatchTrace, resetWatchTrace, setWatchStart, traceWatch } from "../watch-trace";
import type { Workout } from "@/types";

/**
 * The diagnostics trace is read after something went wrong — often after
 * the app was closed and opened again — so a new launch must add to the
 * last one's lines, not replace them.
 */

const KEY = "plato.watch.trace.v1";

beforeEach(async () => {
  await AsyncStorage.clear();
  resetWatchTrace();
  resetCardioDiscards();
});

describe("the trace", () => {
  it("keeps the last launch's lines when this launch adds one", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(["07:00:00 start: watch woken"]));
    traceWatch("watch start: tracking the phone's run", new Date(2026, 9, 25, 7, 1, 0));
    const lines = await readWatchTrace();
    expect(lines).toEqual(["07:00:00 start: watch woken", "07:01:00 watch start: tracking the phone's run"]);
    // And on disk, for the launch after.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual(lines);
  });

  it("shows each line once, however often it's read", async () => {
    traceWatch("one", new Date(2026, 9, 25, 7, 0, 0));
    await readWatchTrace();
    traceWatch("two", new Date(2026, 9, 25, 7, 0, 1));
    expect(await readWatchTrace()).toEqual(["07:00:00 one", "07:00:01 two"]);
  });
});

describe("a discard while the watch is still starting", () => {
  const run = (id: string): Workout => ({
    id,
    userId: "u1",
    name: "Outdoor Run",
    isTemplate: false,
    createdAt: new Date(0),
    startedAt: new Date(1000),
    cardio: { kind: "run" },
    exercises: [],
  });

  // Woken but not yet tracking: without a record, the watch would carry on
  // into a run nobody wants once it got going.
  it("is remembered when a watch was woken for the session", () => {
    setWatchStart("woken", { state: "woken", at: 1000 });
    recordCardioDiscard(run("woken"));
    expect(cardioDiscards()).toEqual([{ id: "woken", startOpId: null, kind: "run", startedAt: 1000, discard: true }]);
  });

  it("isn't needed when no watch was involved", () => {
    recordCardioDiscard(run("phone-only"));
    setWatchStart("failed", { state: "failed", reason: "no watch" });
    recordCardioDiscard(run("failed"));
    expect(cardioDiscards()).toEqual([]);
  });
});
