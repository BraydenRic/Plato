import { readFileSync } from "fs";
import { join } from "path";

import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL } from "../links";

/**
 * The addresses the app opens are the ones App Store Connect gets, so a
 * release can't ship with the app and its listing pointing at different
 * pages. And none of them may live in this repo: it goes private, and its
 * GitHub Pages site goes with it (docs/plans-for-later.md).
 */

const root = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

it("gives the store listing the same addresses the app opens", () => {
  const listing = read("docs/store-listing.md");
  expect(listing).toContain(`Privacy Policy URL: **${PRIVACY_POLICY_URL}**`);
  expect(listing).toContain(`Support URL: **${SUPPORT_URL}**`);
});

it("points the README at the same privacy policy", () => {
  expect(read("README.md")).toContain(PRIVACY_POLICY_URL);
});

it("keeps every address in the public plato-support repo", () => {
  for (const url of [SUPPORT_URL, PRIVACY_POLICY_URL]) {
    expect(url.startsWith("https://braydenric.github.io/plato-support/")).toBe(true);
  }
  expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
});
