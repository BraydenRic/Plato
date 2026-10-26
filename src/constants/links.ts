/**
 * Every address the app, or its App Store listing, sends people to. They're
 * kept here so the app's links and the listing (docs/store-listing.md) can't
 * drift apart: links.test.ts fails if the listing names others.
 *
 * The pages are in this repo's site/ folder, published with Firebase Hosting
 * (`npx firebase-tools deploy --only hosting`), under a name that isn't
 * anyone's: the support page and the privacy policy are public, the repo isn't.
 */

/** The App Store listing's Support URL. Has the contact address. */
export const SUPPORT_URL = "https://plato-workouts.web.app/";

/** Apple wants this linked from inside the app as well as the listing (5.1.1). */
export const PRIVACY_POLICY_URL = "https://plato-workouts.web.app/privacy";

/** The same address the support page and the privacy policy give. */
export const SUPPORT_EMAIL = "platoworkoutapp@gmail.com";
