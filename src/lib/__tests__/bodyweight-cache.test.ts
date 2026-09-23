import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  forgetCachedBodyweight,
  readCachedBodyweight,
  writeCachedBodyweight,
} from "../bodyweight-cache";

/**
 * The device's spare copy of the weigh-in log, for starts with no signal. It is
 * read back from JSON, so what matters is that dates come back as dates, junk
 * never comes back at all, and each account only ever sees its own.
 */

beforeEach(() => AsyncStorage.clear());

it("hands back what it was given, dates and all", async () => {
  await writeCachedBodyweight("u1", [{ date: new Date(2026, 8, 20), lbs: 198 }]);

  const back = await readCachedBodyweight("u1");

  expect(back).toHaveLength(1);
  expect(back![0].date).toBeInstanceOf(Date);
  expect(back![0].date.getTime()).toBe(new Date(2026, 8, 20).getTime());
  expect(back![0].lbs).toBe(198);
});

it("keeps each account's copy to itself", async () => {
  await writeCachedBodyweight("u1", [{ date: new Date(2026, 8, 20), lbs: 198 }]);

  expect(await readCachedBodyweight("u2")).toBeNull();
});

it("treats a corrupt copy as no copy", async () => {
  await AsyncStorage.setItem("bodyweight_log_cache_v1:u1", "{not json");

  expect(await readCachedBodyweight("u1")).toBeNull();
});

it("drops entries that don't revive into a real date and weight", async () => {
  await AsyncStorage.setItem(
    "bodyweight_log_cache_v1:u1",
    JSON.stringify([
      { date: "garbage", lbs: 190 },
      { date: new Date(2026, 8, 19).toISOString(), lbs: "abc" },
      { date: new Date(2026, 8, 20).toISOString(), lbs: 198 },
    ])
  );

  expect((await readCachedBodyweight("u1"))!.map((e) => e.lbs)).toEqual([198]);
});

it("forgets the copy when the account goes", async () => {
  await writeCachedBodyweight("u1", [{ date: new Date(2026, 8, 20), lbs: 198 }]);

  await forgetCachedBodyweight("u1");

  expect(await readCachedBodyweight("u1")).toBeNull();
});
