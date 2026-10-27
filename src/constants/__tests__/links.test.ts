import { readFileSync } from "fs";
import { join } from "path";

import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL } from "../links";

/**
 * The addresses the app opens are the ones App Store Connect gets, and both
 * are pages this repo publishes (site/, on Firebase Hosting), so a release
 * can't ship with the app, its listing and the site disagreeing.
 */

const root = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const SITE = "https://plato-workouts.web.app/";

it("gives the store listing the same addresses the app opens", () => {
  const listing = read("docs/store-listing.md");
  expect(listing).toContain(`Privacy Policy URL: **${PRIVACY_POLICY_URL}**`);
  expect(listing).toContain(`Support URL: **${SUPPORT_URL}**`);
});

it("points the README at the same privacy policy", () => {
  expect(read("README.md")).toContain(PRIVACY_POLICY_URL);
});

it("keeps every address on the site this repo publishes", () => {
  expect(SUPPORT_URL).toBe(SITE);
  expect(PRIVACY_POLICY_URL).toBe(`${SITE}privacy`);
  // Firebase Hosting serves site/<name>.html at /<name> (cleanUrls).
  expect(JSON.parse(read("firebase.json")).hosting).toMatchObject({ site: "plato-workouts", public: "site", cleanUrls: true });
});

it("has the pages those addresses lead to, with the same contact address", () => {
  const support = read("site/index.html");
  const privacy = read("site/privacy.html");
  expect(support).toContain(SUPPORT_EMAIL);
  expect(support).toContain('href="/privacy"');
  expect(privacy).toContain(SUPPORT_EMAIL);
  expect(privacy).toContain('href="/"');
  // Who runs Plato, as the App Store names the seller.
  expect(privacy).toContain("Full Stach LLC");
});
