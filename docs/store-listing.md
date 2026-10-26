# App Store listing — 1.2.0

Copy from here into App Store Connect. Kept in the repo so the listing is
versioned alongside the features it describes; update it when the app changes.

## Description

```
Plato is a fast, no-clutter workout tracker built for people who actually lift.
Open it, log your sets, get back to training. No account needed to start.

LOG WORKOUTS FAST
• 600 built-in exercises — barbell staples, machines, cables, bands, calisthenics, sports and neck work — each with a guide to doing it right
• Enter weight and reps with a keypad built for the gym — jump to the next field with one tap
• Copy your previous set with a single tap
• Timed exercises like planks, dead hangs, and cardio get a built-in start/stop timer
• Rest timer between sets
• Works with no signal — log a whole session in a dead zone and it syncs when you're back online

START WITHOUT AN ACCOUNT
• Use the whole app as a guest — no sign-up, no email, nothing to fill in
• Everything stays on your phone until you decide otherwise
• Create an account later and everything you already logged comes with you

LIVE ACTIVITY
• Your active workout lives on your Lock Screen and Dynamic Island with a running timer and set count — no need to unlock your phone to check

PLAN YOUR TRAINING
• Build reusable workout templates
• Set a weekly split — assign templates to each day of the week
• Plan workouts ahead on the calendar

TRACK YOUR PROGRESS
• Full workout history
• Progress charts for every exercise
• Muscle recap shows which muscle groups you've hit and which you've neglected

BODY WEIGHT
• Log weigh-ins and watch your weight trend over time
• Pull ups, dips and other bodyweight moves are counted at what you actually weighed that day — so your volume is honest, and a weigh-in tomorrow never re-writes what you lifted today
• Pounds or kilos, your call

MAKE IT YOURS
• Light or dark, or follow your phone
• Seven accent colours — and your home screen icon changes to match

YOUR DATA, EVERYWHERE
• Sign in with Apple, Google, or email — your workouts sync automatically
• Delete your account and data anytime, right from the app

No ads. No pop-ups. No clutter. Just training.
```

## What's New in This Version

```
Plato now works with no signal. Open it in a basement gym and your history,
templates and exercises are all there. Log a whole session, finish it, and it
syncs to your account when you're back online, even if you close the app
first.

600 exercises — the library has grown from under 200 to 600, each with a
form guide. New: a Neck category, including the 4-way neck machine, plus
the standing calf machine, V-squat and reverse hack machines, the reverse
wrist roller and more grip work, band and cable variations, Olympic lifts,
calisthenics progressions, and sports and classes for cardio.

Reorder the exercises in a workout you've already started: tap ⋯, then
Reorder exercises. Sets you've logged move with their exercise.

Your body weight now counts even when you open Plato with no signal, and in
templates — and workouts that missed it are corrected.

Back and Next on the keypad move exactly one field, every time.

A running timer on a plank or cardio set, and the rest countdown, now keep
going even if you swipe Plato closed.

Search results no longer hide behind the keyboard. The bar for your
workout in progress has a cleaner look, and if you have two going at once it
lists both. Home is tidier too: History is one row near the top, and the
weekly split folds away until you need it.
```

## Notes for App Review

```
The whole app is usable as a guest with no account, so no demo credentials
are needed — tap "Continue as guest" on the sign-in screen.

Sign in with Apple, Google and email/password are all supported for users who
want cloud sync. Account deletion is in Profile → Delete account.

Body weight is optional, entered by hand, and used only to chart the user's
own weight and to value bodyweight exercises. No HealthKit access.
```

## Checklist for the version page

- Build: **1.2.0 (55)** — offline mode, the timer fix, mid-workout reorder, 600 exercises, and the tidier Home and resume bar
- Privacy Policy URL: **https://braydenric.github.io/plato-support/privacy.html**, changed from
  https://braydenric.github.io/Plato/, which only forwards there while the Plato repo is public.
  Apple applies a URL change with the next version, so it goes live when this version is
  released. After that, the repo can go private (see plans-for-later.md).
- App Privacy → Data Types: **Health** added under Health & Fitness
  (App Functionality · linked to identity · not used for tracking)
- Export compliance: answered automatically by `ITSAppUsesNonExemptEncryption: false`
- Release: **automatic** on approval

## When a build with cardio sessions ships

The 1.2.0 text above predates cardio sessions and the watch's HealthKit use.
Before submitting a build that has them:

- **Description** — Apple requires HealthKit apps to say so in the listing.
  Add a section:
  ```
  CARDIO
  • Start a run, walk, ride, swim or row and track it on your Apple Watch — live distance, pace, heart rate and splits
  • No watch? Runs and walks get their distance, pace and splits from your iPhone's step counter
  • Finished sessions show your splits, heart rate and calories, and save to Apple Health so they count toward your rings
  • Weekly distance and your fastest mile, 5K and 10K on the Stats tab
  ```
- **Notes for App Review** — replace "No HealthKit access." with:
  `Apple Health is used only for cardio sessions started in Plato: on the Workouts tab, Start cardio → Run → Start. With an Apple Watch paired, the watch tracks the session (heart rate, energy, distance) and saves it to Health as a workout. Plato never reads workouts recorded by other apps. Without a watch, Health isn't used: a run, walk or hike gets its distance from the iPhone's step counter (Motion & Fitness), and other sessions run on the phone's clock.`
- **App Privacy → Data Types** — under Health & Fitness, **Health** and
  **Fitness** (App Functionality · linked to identity · not used for
  tracking). Sessions are saved to the account like typed workouts.
- **Screenshots** — a watch screenshot is needed for the watch app anyway;
  the live run screen makes a good one.
- **Privacy Policy** — already updated (Apple Health and Apple Watch, and Your iPhone's step counter),
  at the plato-support address in the checklist above.
- **Motion & Fitness** needs nothing more in App Privacy: the distance it gives is
  saved with the session, which is already Fitness data above.
