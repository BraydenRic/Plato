# Next release: 1.2.1, for the search results image

1.2.0 (77) is on the App Store (approved October 27, 2026). 1.2.1 exists
only to carry the new search results image, which the live version's page
won't take: the app inside it is the same as 77, with the version number
changed (`app.json` and `package.json` say 1.2.1). Its steps:

1. Build it: `gh workflow run ios-build.yml --ref main -f submit=true`. It
   comes out as 1.2.1 (78) on TestFlight.
2. In App Store Connect, add version **1.2.1** (+ next to iOS App).
3. **What's New:** the 1.2.1 block in [store-listing.md](store-listing.md).
   **Promotional Text** came up empty on the new version: paste it from
   store-listing.md (it can be changed any time, the live version too).
   The rest should carry over from 1.2.0; check the subtitle, description,
   keywords, support URL, the screenshots (iPhone Medium and Large, Apple
   Watch), the header image, the review notes and automatic release
   against store-listing.md. Optionally add to the review notes: "1.2.1
   only changes the App Store search results image; the app is the same
   as 1.2.0." App Privacy, age rating and price are the app's, not the
   version's, and need nothing.
4. **Header and Search Results → Search Results:** upload
   `store/screenshots/header-and-search/search-results.png` (3840 × 2560),
   "Use header asset in search results" unticked. Check it in Device
   Preview on an iPhone.
5. **Build:** 1.2.1 (78). Then Add for Review and Submit.
6. Once it's out, look at Plato in App Store search on a phone.

The rest of this file is how 1.2.0 went out, kept for the next full release.

# 1.2.0, build 77

Everything since 1.1.0 goes out in this one: offline mode, 600 exercises,
mid-workout reorder, the Apple Watch app, cardio sessions, the Start workout
picker, Help in Profile, Watch a demo, the week strip's icons, shorter rests
and Restore original. The App Store text is written and lives in
[store-listing.md](store-listing.md); this is the order to do things in.

## Pick up here (as of October 27, 2026)

**Submitted:** 1.2.0 (77) went to App Review on October 27, 2026, set to
release automatically once approved. Everything below is done; what's left
is step 6 (wait, and answer a rejection if one comes) and, once it's on the
App Store, step 7.

**Done:**
- Build 1.2.0 (77) is on TestFlight and checked on a phone (step 2).
- The site is live at https://plato-workouts.web.app/, and the old
  braydenric.github.io/plato-support pages forward to it (step 1).
- The Apple Watch screenshots are taken and sized (step 3).
- The screenshots are done: ten iPhone ones in `store/screenshots/1.2.0/`
  (Large Display) and the same ten in `1.2.0-medium/` (Medium Display), and
  three watch ones in `store/screenshots/watch/`, in App Store order, with a
  clean status bar (9:41, full battery, no carrier). Restyled October 27: each
  on one of the app's accents, the key words in amber, and gym gear that
  straddles the join between one screenshot and the next. Compare them with
  the earlier black set at https://claude.ai/artifact/AD5KoZ5whSpLg3AMS7GZqS.
- The header and search results images are done, in
  `store/screenshots/header-and-search/` (step 5).
- Version 1.2.0 is created in App Store Connect (it hadn't been, so build 55
  was never in review: skip step 4).
- The version page is filled in from store-listing.md (screenshots, header
  and search images, text, keywords, build 77, review notes, subtitle, App
  Privacy) and submitted (step 5).

**Next:**
1. Replace the search results image (October 27): App Store Connect →
   Header and Search Results → Search Results, upload the new
   `store/screenshots/header-and-search/search-results.png` (3840 × 2560).
   The first one was 16:9 and the live iPhone card cropped it to the words
   alone. This one is the card's own 3:2, laid out so even the tightest
   crop Apple's template allows shows the words and the top of the app.
   The page for the live version won't take it (the upload is greyed out),
   so it goes on the next version, 1.2.1. Check it in Device Preview on an
   iPhone, and on a phone once it's live.
2. Step 7: 1.2.0 was approved and is on the App Store (October 27), so:
   check the listing's support and privacy links, delete the plato-support
   repo and make this repo private. The version is bumped to 1.2.1 already
   (see the top of this file).

**For 1.2.1, if wanted** (none of these block 1.2.0): the header and search
images and promotional text can change without a new version; screenshots
and everything else wait for the next one.
1. *Optional:* assign templates to a few days in the weekly split, retake the
   Home screen scrolled to Templates and Weekly split, and save it over
   `store/screenshots/raw-1.2.0/home-templates.png`. Screenshot 8's caption
   says "Templates and a weekly split", and the current one shows the split
   as "Not set". Then run `python3 store/screenshots/render.py 08`.
2. *Optional:* screenshot 3 is a run 10 seconds in (0.00 mi), with the watch
   4 seconds in beside it. A run or walk a few minutes in, with distance and
   pace, would be stronger: save the phone's over
   `raw-1.2.0/cardio-live-run.png` and the watch's over
   `watch/originals-42mm/02-run.png`, then run `render.py 03 watch` (the
   watch one is in both sets).
3. The small things the build 76/77 review found: Profile's email doesn't
   hide again when you leave the tab, the privacy policy doesn't mention
   that Watch a demo opens a YouTube search, and Diagnostics (a long press on
   the logo) can't be reached with VoiceOver.

**Re-rendering the screenshots on another computer:** change the words in
`store/screenshots/captions.json` (each screenshot's headline, the words in
amber, and its accent), or replace a raw screenshot (iPhone ones taken on a
6.1-inch iPhone with a Dynamic Island, 1179 × 2556; watch ones on a 42 mm
Series 10 or 11, 374 × 446; the status bar and the watch's clock are placed
for those sizes), then `python3 store/screenshots/render.py`. Name the ones
to redo with `render.py 03 08`, `render.py watch` or `render.py header`. `render.py --plain`
renders the earlier black look instead. It needs Pillow (`pip install
pillow`) and a headless Chrome: `npx playwright install
chromium-headless-shell`, or `CHROME=/path/to/chrome`.

**A new build** is only needed if the app changes before submitting:
`gh workflow run ios-build.yml --ref main -f submit=true`. It comes out as
1.2.0 (78); change the build number in this doc and store-listing.md to
match.

## 1. Put the new site up (once)

The support page and the privacy policy now live in this repo's `site/`
folder, published at **https://plato-workouts.web.app/**: no personal name in
the address, and "Full Stach LLC" on the pages, as on the App Store. Firebase
needs you signed in, which opens a browser, so these three are yours:

```bash
npx firebase-tools login --reauth
npx firebase-tools hosting:sites:create plato-workouts --project workouttracker-4e0c8
npx firebase-tools deploy --only hosting --project workouttracker-4e0c8
```

- [x] https://plato-workouts.web.app/ shows the support page, and
      https://plato-workouts.web.app/privacy the privacy policy.
- [x] **Tell Claude it's up.** Claude then merges plato-support's
      `forward-to-new-site` branch into its `main`, which turns the old pages at
      braydenric.github.io/plato-support/ into forwarders to the new site (the
      live 1.1.0 listing links those until 1.2.0 is out), and starts build 75,
      the one with the new site in the app's Help links. Not before the site
      is up: merged early, the live listing's links would lead nowhere.

Done on October 26, 2026: the site is up, the old pages forward to it, and
build 75 was started from main. Builds 76 and 77 followed the same day with
the last changes for this release (the step 2 list marks them **new in 76** and
**new in 77**); 77 is the one to check and submit. Keep the old pages until 1.2.0 is out (step 7).
After changing anything in `site/`, publish it again with
`npx firebase-tools deploy --only hosting --project workouttracker-4e0c8`.

If `plato-workouts` turns out to be taken, pick another name and say so: it's
in `firebase.json`, `src/constants/links.ts` and these docs.

## 2. Check build 77 on your phone and watch

Install it from TestFlight; the watch app comes with it (iPhone Watch app →
Available Apps, if it doesn't appear on its own). If anything here is wrong,
it gets fixed and built again before going on.

- [ ] **Start workout** opens the new picker. If today has a weekly-split
      template, it's already picked and marked Today. Starting blank and
      starting a template both open the workout.
- [ ] **Watch, workout**: with a workout going on the phone, the watch shows it;
      log a set there and it appears on the phone.
- [ ] **Watch, cardio**: Start cardio → Run → Start. The watch shows distance,
      pace and heart rate. End it; the phone shows the splits, and the run is in
      the Health app.
- [ ] **Live Activity**: during a workout it's on the lock screen, with the rest
      countdown after a set. Build 74 changed how it's packaged, so this one
      matters.
- [ ] **Profile → Help**: Contact support opens Mail, and the draft ends with
      **Plato 1.2.0 (77)**, not (1); Privacy policy opens
      plato-workouts.web.app/privacy.
- [ ] **Stats**: the cardio card's line across the weeks says "avg" and a number.
- [ ] **Light mode** (Profile → Appearance → Light): on an exercise page, the
      muscles not worked are light grey, not charcoal.
- [ ] **Largest text** (Settings → Accessibility → Display & Text Size → Larger
      Text, slider all the way up): the Help rows and the Start workout picker
      wrap; nothing is cut off.
- [ ] **Week strip** (new in 76): each day shows a barbell for a workout and the
      session's own icon for cardio (footsteps for a run, a bike for a ride),
      green when done; a planned workout's is an outline. Four or more on one
      day show two icons and "+2". The picked day's icons take its date's
      colour (white, or dark on a light accent like Cyan or Amber).
- [ ] **Profile** (new in 76): Rest timer steps Off, 0:30, 0:45, 1:00 … 5:00;
      Sets per new exercise goes up to 10.
- [ ] **Watch a demo** (new in 76): on an exercise page, under How to do it. Opens
      YouTube searched for that exercise (the app if installed, else Safari).
- [ ] **Restore original** (new in 76): edit a built-in exercise (rename it),
      reopen its edit screen: grey Restore original under Save puts it back.
      Exercises → ↻ (Restore default exercises) brings back hidden ones and
      keeps a custom exercise you made.
- [ ] **Weekly split** (new in 77): folded, Home's row says "Not set", "3 days a
      week" or "Every day", whole, with no "…".
- [ ] **Profile** (new in 77): your email shows as dots until you tap the eye
      beside it. No version line at the bottom; long-pressing the Plato logo
      on the account card still opens Diagnostics.
- [ ] **Exercise page** (new in 77): no category line under the name; the main
      muscle is the filled chip, the rest soft.
- [ ] **Stats** (new in 77): the cardio section is last, under Muscles this
      week and Volume.

## 3. Take Apple Watch screenshots

Apple requires at least one for an app with a watch app.

- [x] On the iPhone: Watch app → General → turn on **Enable Screenshots**.
- [x] On the watch: press the **side button and the Digital Crown together**,
      at the same moment, and let go. Screenshots land in the iPhone's Photos.
- [x] Done October 26, 2026: three, in `store/screenshots/watch/` (logging a
      set, a run, the Start list), ready to upload at **416 × 496**.

Not every watch's screenshots are a size Apple accepts. A 42 mm Series 10 or 11
takes 374 × 446, which App Store Connect refuses; it wants 416 × 496 for that
family (the 46 mm size). The originals are in
`store/screenshots/watch/originals-42mm/`, and `render.py` draws each one in a
watch under a caption at 416 × 496 (`render.py --plain` gives the bare
screens, scaled up). Apple's list:
https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

The run screenshot was taken 4 seconds in (0.00 mi, no pace or heart rate yet).
One a few minutes into a walk, with real numbers, would show it off better:
save it over `originals-42mm/02-run.png` and run `render.py 03 watch`.

## 4. Check whether 1.2.0 is already with Apple

In App Store Connect, open Plato and the 1.2.0 version page.

- **Waiting for Review or In Review, with build 55:** remove it from review,
  then carry on. Build 55 has neither the watch app nor cardio.
- **Prepare for Submission, or rejected:** carry on.

1.2.0 hasn't been approved: Apple closes a version to new builds once it is,
and builds still upload as 1.2.0.

## 5. Fill in the version page

Everything to paste is in [store-listing.md](store-listing.md).

- [ ] **Subtitle**, **Promotional Text**, **Description**, **What's New in This
      Version**.
- [ ] **Screenshots**: under **iPhone Medium Display** (the one Apple
      requires) the ten in `store/screenshots/1.2.0-medium/`, and under
      **iPhone Large Display** the ten in `store/screenshots/1.2.0/`, both in
      their numbered order (they replace 1.1.0's, now in
      `store/screenshots/1.1.0/`). Skip iPhone Duo: Apple only requires it from
      April 2027. On the
      **Apple Watch** tab the three in `store/screenshots/watch/` (not the
      `originals-42mm` ones, which Apple refuses).
- [ ] **Header and search results** (Product Page Information → Header and
      Search Results), from `store/screenshots/header-and-search/`:
      `header.png` under **Header** and `search-results.png` (3840 × 2560, the
      card's own 3:2) under **Search Results**, with "Use header asset in
      search results" unticked. Check
      both with Preview. Optional, shown on iOS 27 and later; without them
      the search card shows the first three screenshots. They can also be
      added after release, from Asset Library, without a new version.
- [ ] **Build**: 1.2.0 (77).
- [ ] **App Review Information → Notes**: the Notes for App Review block. It
      says how Health and the watch are used; leaving the old "No HealthKit
      access" in would be grounds for rejection.
- [ ] **URLs**: Support URL `https://plato-workouts.web.app/`, Marketing URL
      empty, and under App Privacy the Privacy Policy URL
      `https://plato-workouts.web.app/privacy`. Run the check in
      store-listing.md first; both should say 200.
- [ ] **App Privacy → Data Types**: add **Health** and **Fitness** under Health &
      Fitness (App Functionality · linked to identity · not used for tracking),
      then Publish.
- [ ] **Version Release**: automatically release this version.
- [ ] **Add for Review**, then **Submit**.

## 6. While it's in review

Nothing to do. If it's rejected, read the reason. Most can be answered in
App Store Connect; one that needs a code change means a fix, a build, and
choosing the new build on the same 1.2.0 page.

## 7. Once it's out

- [ ] On the App Store page, the privacy policy and support links open
      plato-workouts.web.app.
- [ ] Delete the old plato-support repo: [plans-for-later.md](plans-for-later.md),
      "Delete the plato-support repo".
- [ ] Make this repo private, if it isn't yet: [plans-for-later.md](plans-for-later.md),
      "Make the repo private". From then on builds come out of a monthly
      allowance (about 12–14), so batch changes (README, "Build sparingly").
- [ ] Before the next build, bump `version` in `app.json` and `package.json`
      (1.2.1 for fixes, 1.3.0 for features). App Store Connect takes no more
      builds for 1.2.0 once it's approved.

## Your name elsewhere (check once)

The App Store already names the seller as Full Stach LLC, and the new site
names nobody else. These are outside the code and only you can see them:

- [ ] **platoworkoutapp@gmail.com**: the display name people see when you reply
      (Gmail → Settings → Accounts → Send mail as).
- [ ] **Google sign-in's consent screen**: the app name, support email and
      developer contact (Google Cloud console → APIs & Services → OAuth consent
      screen). People signing in with Google can see these.
- [ ] **Firebase Auth emails**: the sender name and reply-to on verification and
      password emails (Firebase console → Authentication → Templates).
- [ ] **GitHub**: this repo and plato-support show commits under your username
      and email until they're private or deleted (step 7).
