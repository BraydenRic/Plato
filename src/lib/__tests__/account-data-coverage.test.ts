import { readFileSync } from "fs";
import { join } from "path";

/**
 * Three lists have to agree, and nothing at runtime ever checks that they do.
 *
 * Every collection the app touches needs (a) a block in firestore.rules, or
 * writes fail with a permission-denied that reads like a network error, and
 * (b) a line in deleteAllUserData, or the data outlives the account. Both
 * failures are silent in opposite directions: the first blames the network, and
 * the second leaves no trace at all — the rows sit under a uid nobody can sign
 * in as, so no screen can ever show you that they're there. weeklyPlans and
 * bodyweight were both missed by (b) for exactly that reason.
 *
 * This reads the source rather than the running code, which is unusual and
 * worth the oddity: the thing being checked *is* a correspondence between three
 * files, and there is no runtime moment where all three are in the same place.
 */

const root = join(__dirname, "..", "..", "..");
const rules = readFileSync(join(root, "firestore.rules"), "utf8");
const firestoreSource = readFileSync(join(root, "src", "lib", "firestore.ts"), "utf8");

/**
 * Collection names with a `match /name/{...}` block in the rules.
 *
 * Read from inside the `/databases/{database}/documents` wrapper, which is a
 * `match` of the same shape but names a database rather than a collection.
 */
const ruledBlocks = rules.split("/documents {")[1] ?? "";
const ruled = new Set(
  [...ruledBlocks.matchAll(/match\s+\/([A-Za-z][A-Za-z0-9_]*)\/\{/g)].map((m) => m[1])
);

/** Collection names the app actually reads or writes. */
const used = new Set(
  [...firestoreSource.matchAll(/(?:collection|doc)\(\s*db\s*,\s*"([^"]+)"/g)].map((m) => m[1])
);

/** Collection names deleteAllUserData removes. */
const wiped = new Set(
  [
    ...(firestoreSource
      .split("export async function deleteAllUserData")[1]
      ?.split("\n}")[0] ?? ""
    ).matchAll(/(?:collection|doc)\(\s*db\s*,\s*"([^"]+)"/g),
  ].map((m) => m[1])
);

it("finds the collections it is meant to be checking", () => {
  // Guards the regexes themselves: if a refactor changes how paths are written,
  // every assertion below would pass vacuously against three empty sets.
  expect(used.size).toBeGreaterThanOrEqual(5);
  expect(ruled.size).toBeGreaterThanOrEqual(5);
  expect(wiped.size).toBeGreaterThanOrEqual(5);
});

it("has a security rule for every collection the app uses", () => {
  const unruled = [...used].filter((c) => !ruled.has(c));
  expect(unruled).toEqual([]);
});

it("deletes every collection the app uses when an account is deleted", () => {
  const orphaned = [...used].filter((c) => !wiped.has(c));
  expect(orphaned).toEqual([]);
});

it("has no rule for a collection that no longer exists", () => {
  // Not a safety problem, but a rule granting access to something unused is a
  // rule nobody is checking against real code any more.
  const stale = [...ruled].filter((c) => !used.has(c));
  expect(stale).toEqual([]);
});
