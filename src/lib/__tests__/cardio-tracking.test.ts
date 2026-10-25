import { curveFromFlat, fastest, splits, trackedFromPhone, trackedFromWatch, type Curve } from "../cardio-tracking";

const MILE = 1609.344;

/**
 * A curve for stretches run at steady paces: each leg is metres covered in
 * seconds, with a point every ten seconds — about as often as the watch's
 * readings arrive.
 */
function curve(...legs: [metres: number, seconds: number][]): Curve {
  const metres = [0];
  const seconds = [0];
  for (const [m, s] of legs) {
    const pieces = Math.max(1, Math.round(s / 10));
    const m0 = metres[metres.length - 1];
    const s0 = seconds[seconds.length - 1];
    for (let i = 1; i <= pieces; i++) {
      metres.push(m0 + (m * i) / pieces);
      seconds.push(s0 + (s * i) / pieces);
    }
  }
  return { metres, seconds };
}

describe("splits", () => {
  it("times each whole kilometre and mile", () => {
    // 4:00 for the first km, 5:00 for the second.
    const c = curve([1000, 240], [1000, 300]);
    expect(splits(c, 1000)).toEqual([240, 300]);
    // Not even two kilometres make a whole second mile.
    expect(splits(c, MILE)).toHaveLength(1);
  });

  it("is empty for a session shorter than one unit", () => {
    expect(splits(curve([900, 200]), 1000)).toEqual([]);
  });

  // 150 readings of a third of a metre can sum to 4,999.999… m.
  it("counts a distance the readings fall a hair short of", () => {
    const c = curve(...Array.from({ length: 150 }, () => [5000 / 150, 10] as [number, number]));
    expect(splits(c, 1000)).toHaveLength(5);
    expect(fastest(c, 5000)).toBe(1500);
  });
});

describe("fastest", () => {
  it("finds the quickest stretch even when it straddles the readings", () => {
    const c = curve([1000, 330], [1000, 240], [1000, 330]);
    expect(fastest(c, 1000)).toBe(240);
    // Any 2 km here holds a whole kilometre of slow running, wherever it starts.
    expect(fastest(c, 2000)).toBe(570);
  });

  // Waiting at a light without pausing: an effort that ends there ended when
  // you arrived, and one that starts there started when you set off.
  it("doesn't count standing still at either end of an effort", () => {
    const c = curve([1000, 240], [0, 60], [1000, 240]);
    expect(fastest(c, 1000)).toBe(240);
    // Across the stop it has to count: you were standing still in the middle.
    expect(fastest(c, 2000)).toBe(540);
  });

  it("is nothing for a session shorter than the distance", () => {
    expect(fastest(curve([4000, 1200]), 5000)).toBeNull();
  });

  it("throws out a GPS jump faster than anyone has ever run", () => {
    expect(fastest(curve([1000, 60]), 1000)).toBeNull();
  });
});

describe("curveFromFlat", () => {
  it("reads metres and seconds in pairs", () => {
    expect(curveFromFlat([0, 0, 100, 30, 250, 60])).toEqual({ metres: [0, 100, 250], seconds: [0, 30, 60] });
  });

  // A corrected GPS fix can step back a few metres; distance and time must
  // never run in reverse, or the splits come out negative.
  it("holds a step backwards level", () => {
    expect(curveFromFlat([0, 0, 100, 30, 95, 31, 200, 60])).toEqual({ metres: [0, 100, 100, 200], seconds: [0, 30, 31, 60] });
  });

  it("refuses anything malformed rather than half-reading it", () => {
    expect(curveFromFlat([0, 0, 100])).toBeNull();
    expect(curveFromFlat([0, 0, -5, 10])).toBeNull();
    expect(curveFromFlat([0, 0, "100", 10])).toBeNull();
    expect(curveFromFlat([0, 0, Number.NaN, 10])).toBeNull();
    expect(curveFromFlat("0,0,100,30")).toBeNull();
    expect(curveFromFlat(new Array(10_000).fill(1))).toBeNull();
  });
});

describe("trackedFromWatch", () => {
  const base = { healthId: "H-1", indoor: false, activeCalories: 312.4, avgHeartRate: 151.6, maxHeartRate: 170.6 };

  it("keeps a run's heart rate, calories, splits and fastest times", () => {
    const tracked = trackedFromWatch({ ...base, curve: curve([5000, 1500]), withSplits: true, isRun: true });
    expect(tracked).toEqual({
      healthId: "H-1",
      source: "Apple Watch",
      activeCalories: 312,
      avgHeartRate: 152,
      maxHeartRate: 171,
      splitsMi: [483, 483, 483],
      splitsKm: [300, 300, 300, 300, 300],
      best: { "1k": 300, "1mi": 483, "5k": 1500 },
    });
  });

  it("gives a ride its splits but no records", () => {
    const tracked = trackedFromWatch({ ...base, curve: curve([10000, 1500]), withSplits: true, isRun: false });
    expect(tracked.splitsKm).toHaveLength(10);
    expect(tracked.best).toBeUndefined();
  });

  it("leaves out what the watch didn't have, rather than storing nulls", () => {
    const tracked = trackedFromWatch({
      healthId: null,
      indoor: true,
      activeCalories: null,
      avgHeartRate: null,
      maxHeartRate: null,
      curve: null,
      withSplits: true,
      isRun: true,
    });
    expect(tracked).toEqual({ source: "Apple Watch", indoor: true });
  });
});

describe("a session the iPhone measured", () => {
  it("says so, with splits and a run's fastest efforts, and nothing a phone can't tell", () => {
    // Eight minutes a mile, steady, for two miles.
    const curve = { metres: [0, 1609.344, 3218.688], seconds: [0, 480, 960] };
    const tracked = trackedFromPhone({ indoor: false, curve, isRun: true });
    expect(tracked).toEqual({ source: "iPhone", splitsMi: [480, 480], splitsKm: [298, 298, 298], best: { "1k": 298, "1mi": 480 } });
  });

  it("keeps records to runs", () => {
    const curve = { metres: [0, 1609.344], seconds: [0, 900] };
    expect(trackedFromPhone({ indoor: true, curve, isRun: false })).toEqual({ source: "iPhone", indoor: true, splitsMi: [900], splitsKm: [559] });
  });
});
