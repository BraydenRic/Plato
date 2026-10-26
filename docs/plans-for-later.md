# Plans for later

Things decided on but deliberately not done yet, with enough detail to pick up
cold. Written after the October 2026 audit (build 72).

## App Check

**What it is.** Firebase App Check makes every database request prove it comes
from the genuine Plato app on a real iPhone. On first run the app asks Apple's
App Attest to vouch for it (a key in the phone's Secure Enclave, signed by Apple
for this exact app and team), trades that for a short-lived App Check token from
Firebase (about an hour, refreshed in the background), and sends the token with
every Firestore request. A script with the app's Firebase config can't get a
token, so once enforcement is on its requests are refused before the security
rules even run.

**Why it isn't done yet.** The rules already stop anyone touching another
person's data. What App Check adds is protection from someone scripting junk
into their *own* account. Plato is on Firebase's free (Spark) plan, so that can
never cost money: the worst case is the free quota running out (syncing stops
until the daily reset; Plato keeps working offline) or the 1 GiB of storage
filling. For an app this size that's unlikely, and the work below is real.
Worth doing before a bigger public launch, or straight away if the project ever
moves to the paid (Blaze) plan.

**How, in two stages.**

1. *Watch only — nothing is ever blocked.*
   - The app uses the Firebase JS SDK, which has no App Attest provider of its
     own. Add the native Firebase iOS App Check library (App Attest, with
     DeviceCheck as the fallback for older devices) in a small Expo module, and
     hand its tokens to the JS SDK through `initializeAppCheck` with a
     `CustomProvider` whose `getToken` calls the native side.
   - In the Firebase console, register the iOS app under App Check with the App
     Attest provider (needs the Apple Team ID).
   - The iPhone Simulator can't do App Attest: development needs the debug
     provider, with its token registered in the console.
   - Ship it and watch App Check's metrics in the console for a few weeks.
2. *Enforce.* Once nearly all requests carry valid tokens, turn on enforcement
   for Cloud Firestore. Any phone still on a build from before stage 1 stops
   syncing (it keeps logging locally) until it updates.

**Downsides to accept.** A native dependency and some build risk; a new way for
syncing to fail if Apple's attestation does (an Apple outage, an odd device);
fiddlier development. The Apple Watch is unaffected: it only ever talks to the
phone. App Check itself is free.

**Not a substitute:** size limits in the Firestore rules. Rules can't measure a
document in bytes or count how many documents an account has, so they'd barely
slow abuse while risking rejected saves. Decided against.

## Stop writing `userStats`

plato-web, the web version the backend was shared with, was never deployed and
isn't wanted. It was the only reader of `userStats/{uid}`, which the app still
recomputes and writes on every finish: in `workout/[id].tsx` (finish and the
finish-from-menu path), `cardio-session.tsx`, `watch-sync.tsx`,
`apply-volume-corrections.ts` and `migrate-guest-data.ts`. The app never reads
it — its own stats come from the workouts.

To remove: drop those calls and `upsertUserStats` with them, and the
stats-deferral machinery in `cloud-cache.ts` that exists only to keep those
totals honest (`statsDirty`, `recomputeStats`, the `workoutsFresh` check in
`upsertUserStats`). Keep `computeStats` only if something else still uses it.
Keep the `userStats` rule and its line in `deleteAllUserData`, so documents
already written are still deleted with an account. Code comments across `src/`
still mention plato-web; tidy them in the same change. Saves one write per
finished workout.

## Known, minor, left open

Found by the audit's rechecks, judged not worth the risk of fixing now:

- A late watch edit for a set that was cleared on the phone can bring the set
  back: a clear leaves no timestamp to compare against.
- A Live Activity tap while the add-exercise sheet is open over a *different*
  workout opens the tapped workout inside that sheet (not a duplicate).
- A watch start the phone woke, applied more than 30 s late while the watch is
  in reach (a very slow phone launch), becomes its own session instead of being
  stopped. An unwanted session the user can end — nothing lost.
- During a guest move, a moved workout deleted in the account, then the app
  killed before the delete reaches the server, can reappear on the next run.
- The Firestore rules don't require a verified email; the verify-email gate is
  in the app only. An unverified account can only ever touch its own data.

## Make the repo private

**Nothing public depends on it any more.** The support page and the privacy
policy are this repo's `site/`, published with Firebase Hosting at
https://plato-workouts.web.app/, which doesn't care whether the repo is
public, and the repo's GitHub Pages site is off. So it can go private whenever
suits: GitHub → Settings → General → Danger Zone → Change visibility. That
also takes the commit history, with its author names and email address, out of
public view.

**The one cost.** From then on every build spends Actions minutes, about 12–14
a month (see "Build sparingly" in the README). Going private once the release
builds are done is the cheaper order.

## Delete the plato-support repo, after the next release

The live App Store listing (1.1.0) links https://braydenric.github.io/plato-support/
for support and https://braydenric.github.io/plato-support/privacy.html for the
privacy policy, and Apple changes those only with a new version. Until then the
two pages there only forward to https://plato-workouts.web.app/. Once 1.2.0,
which names the new site, is *released* (not just approved):

1. Check that the App Store page's support and privacy links open
   plato-workouts.web.app.
2. Delete the repo: plato-support on GitHub → Settings → Danger Zone → Delete
   this repository. Its site goes with it.

## Before submitting to the App Store

- `docs/next-release.md`: the steps for the next release, in order, with the
  App Store text in `docs/store-listing.md`.
- Sign in with Apple token revocation is set up in Firebase (key "Plato Sign
  in with Apple", Services ID `com.plato.workouts.signin`). If the developer
  team changes, make a new key and Services ID under it and update Firebase.
