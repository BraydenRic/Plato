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

/**
 * A YouTube search for an exercise, for the exercise page's "Watch a demo".
 *
 * A youtube.com link opens the YouTube app where it's installed and Safari
 * where it isn't (iOS decides), so it works on every phone, and it's an
 * ordinary link: Plato sends nothing anywhere. A search rather than chosen
 * videos, so all 600 exercises and every custom one have a demo, and none go
 * dead when a video comes down. "tutorial" rather than "form" so a sport or a
 * class searches as sensibly as a lift.
 */
export function exerciseDemoUrl(exerciseName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} tutorial`)}`;
}
