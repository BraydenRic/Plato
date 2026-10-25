import { workoutFromDoc } from "../firestore";

jest.mock("../firebase", () => ({ db: {}, auth: {} }));
// Only Timestamp is touched by reading a doc; the rest talk to the network.
jest.mock("firebase/firestore", () => ({ Timestamp: class Timestamp {} }));
jest.mock("firebase/auth", () => ({ onAuthStateChanged: jest.fn() }));

/**
 * A session's `cardio` as it comes back from Firestore: checked field by
 * field, so a doc written by an older build — or a bad one — can't put
 * nonsense on the session screen.
 */

const doc = (cardio: unknown) =>
  workoutFromDoc("s1", { userId: "u1", name: "Outdoor Run", isTemplate: false, exercises: [], cardio });

describe("a session's pauses", () => {
  it("come back as they were saved", () => {
    const pauses = [{ fromMs: 1000, toMs: 2000 }, { fromMs: 5000, toMs: 5500 }];
    expect(doc({ kind: "run", pausedSeconds: 1.5, pauses }).cardio).toMatchObject({ kind: "run", pausedSeconds: 1.5, pauses });
  });

  // Half a list of pauses is no better than none: the step counter would
  // count the walking in the ones that went missing.
  it("are dropped whole if any is malformed", () => {
    expect(doc({ kind: "run", pauses: [{ fromMs: 1000, toMs: 2000 }, { fromMs: "x", toMs: 3000 }] }).cardio?.pauses).toBeUndefined();
    expect(doc({ kind: "run", pauses: [{ fromMs: 3000, toMs: 2000 }] }).cardio?.pauses).toBeUndefined();
    expect(doc({ kind: "run", pauses: "nope" }).cardio?.pauses).toBeUndefined();
  });

  it("are absent from a session that never paused", () => {
    expect(doc({ kind: "walk" }).cardio?.pauses).toBeUndefined();
  });
});
