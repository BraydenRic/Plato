# Next release: 1.2.0, build 74

Everything since 1.1.0 goes out in this one: offline mode, 600 exercises,
mid-workout reorder, the Apple Watch app, cardio sessions, the Start workout
picker and Help in Profile. The App Store text is written and lives in
[store-listing.md](store-listing.md); this is the order to do things in.

## 1. Check build 74 on your phone and watch

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
- [ ] **Profile → Help**: Contact support opens Mail; Privacy policy opens the
      page. The version line at the bottom says **1.2.0 (74)**, not (1).
- [ ] **Stats**: the cardio card's line across the weeks says "avg" and a number.
- [ ] **Light mode** (Profile → Appearance → Light): on an exercise page, the
      muscles not worked are light grey, not charcoal.
- [ ] **Largest text** (Settings → Accessibility → Display & Text Size → Larger
      Text, slider all the way up): the Help rows and the Start workout picker
      wrap; nothing is cut off.

## 2. Take Apple Watch screenshots

Apple requires at least one for an app with a watch app.

- [ ] On the iPhone: Watch app → General → turn on **Enable Screenshots**.
- [ ] On the watch: press the **side button and the Digital Crown together**.
      Screenshots land in the iPhone's Photos at a size Apple accepts.
- [ ] Two or three is plenty: the live run screen, logging a set, the template
      list. Take them all on the same watch, since every one has to be the same
      size.

## 3. Check whether 1.2.0 is already with Apple

In App Store Connect, open Plato and the 1.2.0 version page.

- **Waiting for Review or In Review, with build 55:** remove it from review,
  then carry on. Build 55 has neither the watch app nor cardio.
- **Prepare for Submission, or rejected:** carry on.

1.2.0 hasn't been approved: Apple closes a version to new builds once it is,
and builds still upload as 1.2.0.

## 4. Fill in the version page

Everything to paste is in [store-listing.md](store-listing.md).

- [ ] **Subtitle**, **Promotional Text**, **Description**, **What's New in This
      Version**.
- [ ] **Screenshots**: the iPhone set in `store/screenshots/`, plus the watch
      ones from step 2.
- [ ] **Build**: 1.2.0 (74).
- [ ] **App Review Information → Notes**: the Notes for App Review block. It
      says how Health and the watch are used; leaving the old "No HealthKit
      access" in would be grounds for rejection.
- [ ] **URLs**: Support URL `https://braydenric.github.io/plato-support/`,
      Marketing URL empty, and under App Privacy the Privacy Policy URL
      `https://braydenric.github.io/plato-support/privacy.html`. Run the check
      in store-listing.md first; both should say 200.
- [ ] **App Privacy → Data Types**: add **Health** and **Fitness** under Health &
      Fitness (App Functionality · linked to identity · not used for tracking),
      then Publish.
- [ ] **Version Release**: automatically release this version.
- [ ] **Add for Review**, then **Submit**.

## 5. While it's in review

Nothing to do. If it's rejected, read the reason. Most can be answered in
App Store Connect; one that needs a code change means a fix, a build, and
choosing the new build on the same 1.2.0 page.

## 6. Once it's out

- [ ] On the App Store page, the privacy policy link opens plato-support's page.
- [ ] Make this repo private: the steps are in [plans-for-later.md](plans-for-later.md),
      "Make the repo private". From then on builds come out of a monthly allowance
      (about 12–14), so batch changes (README, "Build sparingly").
- [ ] Before the next build, bump `version` in `app.json` and `package.json`
      (1.2.1 for fixes, 1.3.0 for features). App Store Connect takes no more
      builds for 1.2.0 once it's approved.
