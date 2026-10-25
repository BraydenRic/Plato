import { splits } from "../cardio-tracking";
import { curveFromPieces, matchTotal, movingStretches, stepCounted, stepPieces, withLead } from "../phone-distance";

/**
 * The step counter is asked about windows of time, so which windows matters:
 * the session less its pauses, in minutes, so that distance walked while
 * paused is never counted and splits come out on moving time.
 */

const T0 = Date.UTC(2026, 9, 25, 7, 0, 0);
const MIN = 60_000;

describe("what the step counter measures", () => {
  it("is sessions on foot", () => {
    expect(stepCounted("run")).toBe(true);
    expect(stepCounted("walk")).toBe(true);
    expect(stepCounted("hike")).toBe(true);
    expect(stepCounted("bike")).toBe(false);
    expect(stepCounted("stairs")).toBe(false);
  });
});

describe("the moving stretches", () => {
  it("is the whole session with no pauses", () => {
    expect(movingStretches(T0, T0 + 30 * MIN)).toEqual([{ fromMs: T0, toMs: T0 + 30 * MIN }]);
  });

  it("leaves the pauses out", () => {
    const pauses = [
      { fromMs: T0 + 10 * MIN, toMs: T0 + 12 * MIN },
      { fromMs: T0 + 20 * MIN, toMs: T0 + 21 * MIN },
    ];
    expect(movingStretches(T0, T0 + 30 * MIN, pauses)).toEqual([
      { fromMs: T0, toMs: T0 + 10 * MIN },
      { fromMs: T0 + 12 * MIN, toMs: T0 + 20 * MIN },
      { fromMs: T0 + 21 * MIN, toMs: T0 + 30 * MIN },
    ]);
  });

  // Ended while paused: the pause, banked at the end, runs right up to it.
  it("ends where a pause still on at the end began", () => {
    expect(movingStretches(T0, T0 + 30 * MIN, [{ fromMs: T0 + 25 * MIN, toMs: T0 + 30 * MIN }])).toEqual([
      { fromMs: T0, toMs: T0 + 25 * MIN },
    ]);
  });

  it("copes with pauses out of order, overlapping, or past either end", () => {
    const pauses = [
      { fromMs: T0 + 8 * MIN, toMs: T0 + 12 * MIN },
      { fromMs: T0 - MIN, toMs: T0 + MIN },
      { fromMs: T0 + 10 * MIN, toMs: T0 + 15 * MIN },
      { fromMs: T0 + 28 * MIN, toMs: T0 + 40 * MIN },
    ];
    expect(movingStretches(T0, T0 + 30 * MIN, pauses)).toEqual([
      { fromMs: T0 + MIN, toMs: T0 + 8 * MIN },
      { fromMs: T0 + 15 * MIN, toMs: T0 + 28 * MIN },
    ]);
  });

  it("is nothing when the whole session was paused", () => {
    expect(movingStretches(T0, T0 + MIN, [{ fromMs: T0, toMs: T0 + MIN }])).toEqual([]);
  });
});

describe("the pieces asked about", () => {
  it("cuts each stretch into minutes, the last piece of each whatever's left", () => {
    const pieces = stepPieces([
      { fromMs: T0, toMs: T0 + 2.5 * MIN },
      { fromMs: T0 + 4 * MIN, toMs: T0 + 5 * MIN },
    ]);
    expect(pieces).toEqual([T0, T0 + MIN, T0 + MIN, T0 + 2 * MIN, T0 + 2 * MIN, T0 + 2.5 * MIN, T0 + 4 * MIN, T0 + 5 * MIN]);
  });

  // A session left running overnight shouldn't mean a thousand queries.
  it("makes the pieces longer rather than more of them past ten hours", () => {
    const pieces = stepPieces([{ fromMs: T0, toMs: T0 + 20 * 60 * MIN }]);
    expect(pieces.length / 2).toBe(600);
  });
});

describe("the curve", () => {
  it("adds up distance against moving time, from nothing", () => {
    const pieces = [T0, T0 + MIN, T0 + 3 * MIN, T0 + 4 * MIN];
    expect(curveFromPieces(pieces, [180, 200])).toEqual({ metres: [0, 180, 380], seconds: [0, 60, 120] });
  });

  it("counts a nonsense reading as no steps", () => {
    expect(curveFromPieces([T0, T0 + MIN, T0 + MIN, T0 + 2 * MIN], [-1, NaN]).metres).toEqual([0, 0, 0]);
  });

  // A pause in the middle of the second mile isn't in its split.
  it("gives splits on moving time", () => {
    const stretches = movingStretches(T0, T0 + 20 * MIN, [{ fromMs: T0 + 9 * MIN, toMs: T0 + 12 * MIN }]);
    const pieces = stepPieces(stretches);
    // 17 moving minutes at 200 m each: 3,400 m, two whole miles.
    const curve = curveFromPieces(pieces, Array(pieces.length / 2).fill(200));
    expect(curve.seconds[curve.seconds.length - 1]).toBe(17 * 60);
    expect(splits(curve, 1609.344)).toEqual([483, 483]);
  });
});

describe("a watch's curve after the phone's start", () => {
  it("puts the phone's stretch in front, so splits cover the whole session", () => {
    const watch = { metres: [0, 1000, 2000], seconds: [0, 300, 600] };
    expect(withLead(watch, 400, 120)).toEqual({ metres: [0, 400, 1400, 2400], seconds: [0, 120, 420, 720] });
  });

  it("is the watch's own curve with nothing before it", () => {
    const watch = { metres: [0, 1000], seconds: [0, 300] };
    expect(withLead(watch, 0, 0)).toBe(watch);
  });
});

describe("bringing the minutes up to the live count", () => {
  const curve = { metres: [0, 200, 400, 560], seconds: [0, 60, 120, 180] };

  it("puts a small shortfall at the end, where the history lags", () => {
    expect(matchTotal(curve, 600)).toEqual({ metres: [0, 200, 400, 600], seconds: [0, 60, 120, 180] });
  });

  // Most of the history missing: added at the end it would be a sprint in
  // the last minute; spread out, the splits stay even.
  it("spreads a big one over the whole curve", () => {
    expect(matchTotal(curve, 1120).metres).toEqual([0, 400, 800, 1120]);
  });

  it("leaves a curve that already covers it alone", () => {
    expect(matchTotal(curve, 500)).toBe(curve);
  });
});
