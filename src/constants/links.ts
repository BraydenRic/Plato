/**
 * Every address the app, or its App Store listing, sends people to. They're
 * kept here so the app's links and the listing (docs/store-listing.md) can't
 * drift apart: links.test.ts fails if the listing names others.
 *
 * Each one is in the public plato-support repo, never in this one, which goes
 * private (docs/plans-for-later.md) and takes its GitHub Pages site with it.
 */

/** The App Store listing's Support URL. Has the contact address. */
export const SUPPORT_URL = "https://braydenric.github.io/plato-support/";

/** Apple wants this linked from inside the app as well as the listing (5.1.1). */
export const PRIVACY_POLICY_URL = "https://braydenric.github.io/plato-support/privacy.html";

/** The same address the support page and the privacy policy give. */
export const SUPPORT_EMAIL = "platoworkoutapp@gmail.com";
