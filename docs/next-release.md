# Next release: 1.2.0, build 76

Everything since 1.1.0 goes out in this one: offline mode, 600 exercises,
mid-workout reorder, the Apple Watch app, cardio sessions, the Start workout
picker, Help in Profile, Watch a demo, the week strip's icons, shorter rests
and Restore original. The App Store text is written and lives in
[store-listing.md](store-listing.md); this is the order to do things in.

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
build 75 was started from main. Build 76 followed the same day with the last
changes for this release (the step 2 list marks them **new in 76**); it's the
one to check and submit. Keep the old pages until 1.2.0 is out (step 7).
After changing anything in `site/`, publish it again with
`npx firebase-tools deploy --only hosting --project workouttracker-4e0c8`.

If `plato-workouts` turns out to be taken, pick another name and say so: it's
in `firebase.json`, `src/constants/links.ts` and these docs.

## 2. Check build 76 on your phone and watch

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
- [ ] **Profile → Help**: Contact support opens Mail; Privacy policy opens
      plato-workouts.web.app/privacy. The version line at the bottom says
      **1.2.0 (76)**, not (1).
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

## 3. Take Apple Watch screenshots

Apple requires at least one for an app with a watch app.

- [ ] On the iPhone: Watch app → General → turn on **Enable Screenshots**.
- [ ] On the watch: press the **side button and the Digital Crown together**.
      Screenshots land in the iPhone's Photos at a size Apple accepts.
- [ ] Two or three is plenty: the live run screen, logging a set, the template
      list. Take them all on the same watch, since every one has to be the same
      size.

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
- [ ] **Screenshots**: the iPhone set in `store/screenshots/`, plus the watch
      ones from step 3.
- [ ] **Build**: 1.2.0 (76).
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
