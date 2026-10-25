# Plato Mobile

iOS workout tracker built with Expo (React Native), live on the App Store. It shares its Firebase backend with [plato-web](../plato-web), so the same account sees the same workouts on both.

## Features

- **Workout logging.** Start empty, from a template, or from the day's weekly-split slot, and reorder exercises mid-session. Enter weight × reps on a gym-friendly keypad with Back / Done / Next, copy the previous set in one tap, and time holds and cardio with a per-set stopwatch. Sets complete themselves once filled in.
- **Rest timer.** Off by default, and set in Profile. It and a running set stopwatch survive leaving the workout screen and the app being closed: each is one saved wall-clock time, so it reopens still counting.
- **Apple Watch.** A watch app for the workout in progress: the next set's weight × reps ready to adjust with the Digital Crown or type on a number pad, one tap (or double tap) to log it, the rest countdown, and Finish. With nothing running it lists your templates to start one. A watch face complication opens it. See [Apple Watch](#apple-watch).
- **Cardio sessions.** Start cardio (beside Start workout) picks a run, walk, hike, ride, swim, row, elliptical or stair session and opens its own screen: a moving-time clock, Pause and End. With an Apple Watch the watch tracks it — live distance, pace, heart rate and splits on the wrist — and the finished session shows its splits, heart rate and calories; it's saved to Apple Health for the rings. With just a phone, a run, walk or hike gets its distance, pace and splits from the iPhone's step counter. Stats gets a section once there's cardio with a distance. Cardio added inside a workout stays a plain timer. See [Cardio sessions](#cardio-sessions).
- **Resume bar and Live Activity.** The bar above the tabs leads back to the workout in progress (and lists the others if more than one is running). The newest also sits on the Lock Screen and in the Dynamic Island, with a running clock and the rest countdown.
- **Templates, weekly split and planning.** Reusable templates (up to 20), a weekday → template split, and workouts planned or backfilled on any calendar day.
- **Exercise library.** 600 built-ins across 11 categories, including Neck, each with a form guide. Custom exercises, edits to built-ins and hidden built-ins are stored as per-user deltas.
- **Progress.** Full history, per-exercise progress charts (weight, reps, estimated 1RM), weekly sets per muscle group, and a muscle map.
- **Body weight.** Dated weigh-ins, a trend chart, and bodyweight exercises valued at what you weighed *on the day you trained*. A finished workout's volume is frozen, so a later weigh-in never rewrites it.
- **Works offline.** With or without an account: history, templates and the library open with no signal, and changes sync when it's back. See [Offline](#offline).
- **Guest mode.** The whole app works with no account, stored on the device. Signing up later moves everything into the account.
- **Accounts.** Sign in with Apple, Google, or email and password (email must be verified). Account deletion is in the app.
- **Appearance.** Light, dark or system, seven accent colours, and a matching home-screen icon.

Stats are always **derived from workout history**, never incremented counters. History is kept forever.

## Running it

```bash
npm install
npx expo start --tunnel    # tunnel, because LAN mode can't cross the WSL2 boundary
```

Copy `.env.example` to `.env.local` and fill in the Firebase config. Expo Go runs most of the app, but **Apple and Google sign-in, the Live Activity and alternate icons need a real build**, because they're native code. In Expo Go, use email/password or guest mode.

```bash
npm test                   # jest, ~1,100 tests
npx tsc --noEmit           # type-check
npm run lint
```

## Builds and releases

Builds run on GitHub Actions ([ios-build.yml](.github/workflows/ios-build.yml)) using `eas build --local` on a macOS runner pinned to Xcode 26, then upload straight to TestFlight:

```bash
gh workflow run ios-build.yml --ref main -f submit=true
```

A build takes about 15–20 minutes, plus Apple's processing before it shows in TestFlight. Build numbers are managed remotely by EAS and increment automatically. The **version** is not: App Store Connect closes a version to new builds once it's approved, so bump `version` in `app.json` and `package.json` before building after a release.

The App Store copy (description, What's New, review notes) lives in [docs/store-listing.md](docs/store-listing.md). Update it with the app.

## Firebase

Project `workouttracker-4e0c8`. Security rules and indexes are in the repo:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Every collection is per-user: `workouts`, `userStats`, `exerciseLibrary`, `weeklyPlans`, `bodyweight`. A new collection needs a block in [firestore.rules](firestore.rules) and a line in `deleteAllUserData`. [account-data-coverage.test.ts](src/lib/__tests__/account-data-coverage.test.ts) fails if either is missing.

Auth providers enabled: Email/Password, Google and Apple. The Google client IDs go in `.env.local` (see `.env.example`). The reversed iOS client ID is already set in `app.json`.

## Project structure

```
src/
├── app/                         # Expo Router routes
│   ├── _layout.tsx              # Providers, auth/guest/verification guards, crash screen
│   ├── (tabs)/                  # Workouts · Exercises · Stats · Profile
│   ├── workout/[id].tsx         # Live logging, template editor, planned/backfill
│   ├── add-exercise.tsx         # Exercise picker (modal)
│   ├── create-exercise.tsx      # Custom exercise (modal)
│   ├── exercise/[id].tsx        # Form guide + progress chart (modal)
│   ├── history.tsx, bodyweight.tsx, reorder-templates.tsx
│   └── sign-in.tsx, verify-email.tsx
├── components/                  # UI kit, resume bar, charts, muscle map, Live Activity + watch sync
├── context/                     # Auth, appearance/theme, units, rest + set timers, default sets, Health import
├── hooks/                       # Workouts, active workout, bodyweight, library, weekly plan
├── lib/
│   ├── data.ts                  # The single data entry point — routes cloud vs device
│   ├── cloud-cache.ts           # Offline copy + outbox for signed-in accounts
│   ├── firestore.ts             # Cloud store (Firestore calls)
│   ├── remembered-account.ts    # Opens on the last account without waiting for Firebase
│   ├── local-store.ts           # Guest store (one AsyncStorage blob)
│   ├── migrate-guest-data.ts    # Guest → account, resumable
│   ├── exercises.ts             # The 600 built-ins + search
│   ├── exercise-form.ts         # Form guide per built-in, keyed by id
│   ├── workout-utils.ts         # Volume, streaks, dates, previous sets
│   ├── bodyweight-cache.ts      # Offline copy of the weigh-in log
│   ├── watch-protocol.ts        # What the phone and the Apple Watch send each other
│   ├── cardio.ts                # Which cardio covers ground, units, pace, records
│   ├── cardio-session.ts        # Session kinds, the moving-time clock, ending one
│   ├── cardio-tracking.ts       # The watch's distance record → splits and best efforts
│   ├── watch-live.ts            # The watch's live numbers, for the session screen
│   └── live-activity.ts
├── constants/theme.ts           # Palettes (light/dark) and the seven accents
└── types/index.ts               # Domain types, shared with plato-web
targets/watch/                   # The Apple Watch app (SwiftUI), built by @bacons/apple-targets
targets/watch-complication/      # Its watch face complication (a WidgetKit extension inside it)
modules/plato-watch/             # WatchConnectivity bridge on the phone (local Expo module)
modules/plato-health/            # Health access and waking the watch for a session (local Expo module)
plugins/                         # Config plugins: Live Activity widget patch, watch targets + Info.plist
scripts/apple-transfer/          # One-off tool for an App Store team transfer
docs/                            # Privacy policy (GitHub Pages) and store listing
```

## Data model

One Firestore doc per workout, with exercises and sets **embedded**. A set update writes the whole exercises array, so a set can never be partly saved or orphaned. Workouts embed a copy of each exercise, so **built-in exercise ids are permanent**: rename one and history stops lining up.

Screens never call Firestore directly. [data.ts](src/lib/data.ts) sends each call to the cloud or the guest store, based on the data itself (a guest user id, or a `local-` workout id) rather than a global flag.

### Offline

Signed-in accounts work with no signal, the same as guests. The Firebase JS SDK can't do this on React Native: its offline cache needs IndexedDB, so it keeps everything in memory. Opening the app with no signal showed nothing, writes hung until the server acked them, and queued writes died with the app. [cloud-cache.ts](src/lib/cloud-cache.ts) fills that gap:

- **A copy on the phone**, one AsyncStorage key per workout plus one for the library and weekly split. Screens read from it.
- **An outbox.** Every write is saved before it's sent and removed only when the server acks it, so it survives the app being killed. Writes set whole values, so sending one twice is harmless, and a later write that covers an earlier one replaces it.
- **Only the server's answers update the copy.** Firestore's cache answers `fromCache` with whatever this launch touched, often nothing, so those are ignored until the server has answered once.
- **Nothing is sent until Firebase confirms the uid.** The app opens on the last account ([remembered-account.ts](src/lib/remembered-account.ts)) instead of waiting out Firebase's 60-second session check on a dead signal.
- **Whole-document writes wait until the document is known.** The library and weekly split are refused until they've loaded; weigh-ins are held back. This stops a copy that never loaded from overwriting the real one. Lifetime stats wait for the full history.

Guest-to-account migration still writes straight to Firestore, because it deletes each guest workout once the server has it.

### Apple Watch

The watch app logs the workout in progress and starts templates; it is not the whole app, and it never talks to Firestore. The phone is the only source of truth:

- **Phone → watch: one snapshot.** [watch-sync.tsx](src/components/watch-sync.tsx) sends the workout the resume bar leads with, the templates, the unit, the rest setting and countdown, and the theme accent, through WatchConnectivity's application context, whenever any of it changes. Signed out sends an empty one, so the watch never keeps the last account's data.
- **Watch → phone: ops.** "Log this set", "add a set", "finish", "start this template", each with an id. The phone's native side ([modules/plato-watch](modules/plato-watch)) writes them to disk *before* answering the watch, because a set sent from the watch usually wakes the phone app in the background, before React is running. JavaScript applies them through data.ts once an account is loaded, so they get the offline copy and the outbox like any edit, and the screen, resume bar and Live Activity simply see a set being logged.
- **Each op lands once.** Applied ids are remembered (resends are skipped) and echoed back in the next snapshot; until then the watch lays its own unapplied changes over the snapshot, so Done shows instantly even out of range. Ops sent out of range go through the system's delivery queue. Starting a workout is the exception: it needs the phone now, because a workout appearing an hour later is worse than none.
- **Versions.** Xcode won't embed a watch app whose version or build number differs from the phone's. EAS stamps both into the watch's own Info.plist, and [with-watch-plist-only.js](plugins/with-watch-plist-only.js) makes that file the only source (for the complication too).
- **Target order.** [with-watch-targets.js](plugins/with-watch-targets.js) stands in for apple-targets' own entry point, which finds `targets/*` in file-system order: if the complication's target is made before the watch app's, it gets embedded in the phone app instead and the build can't work.

[watch-protocol.ts](src/lib/watch-protocol.ts) holds the contract; the Swift side is [Models.swift](targets/watch/Models.swift). The fixtures in `src/lib/__tests__/fixtures/` pin it from both ends. The watch's pure logic has its own tests that need only a Swift toolchain, Linux included: `SWIFTC=/path/to/swiftc scripts/watch-logic-tests/run.sh`. Everything in `targets/watch/` except its config and Info.plist compiles into the watch app, so keep only Swift sources there. It has no privacy manifest of its own on purpose: React Native's pod install attaches its aggregated one to every app target, the watch included, and a second fails the build.

To take the watch app out: delete `targets/watch`, `targets/watch-complication`, `modules/plato-watch`, `plugins/with-watch-targets.js`, `plugins/with-watch-plist-only.js`, `assets/watch`, their two app.json plugin entries, `<WatchSync />` in the root layout, and the `@bacons/apple-targets` dependency.

### Cardio sessions

A session (`workout.cardio` set) is stored as an ordinary workout holding one exercise with one set, so History, Stats, the streak and plato-web count it without knowing sessions exist; it just has its own screen ([cardio-session.tsx](src/components/cardio-session.tsx)) instead of exercises and sets. The clock is moving time, read from the stored start and pauses ([cardio-session.ts](src/lib/cardio-session.ts)), so it survives the app being closed. Cardio added *inside* a workout is the plain timer, as it always was.

With an Apple Watch, the watch tracks it:

- **Started on the watch** (Start → Cardio): an `HKWorkoutSession` runs there ([CardioTracker.swift](targets/watch/CardioTracker.swift)) and a `startCardio` op creates the phone's session. **Started on the phone**: `startWatchApp(with:)` wakes the watch, which tracks it and learns the phone's id from the next snapshot (or is matched by kind and start time, if it ends first).
- **Pause and end on the watch**, which sends them as ops. Ending on the phone lists the session in the snapshot's `endedCardio`, and the watch stops and sends what it measured.
- **`finishCardio`** carries time, distance, calories, heart rate, the Health workout's id and a record of distance against moving time; the phone works out splits and best efforts from it ([cardio-tracking.ts](src/lib/cardio-tracking.ts)), where Jest can check them. A finish with no session behind it brings the whole session in.
- **Live numbers** go to the phone every 5 s while in reach (`onLive`, [watch-live.ts](src/lib/watch-live.ts)); never stored.
- **The run page on the wrist** ([CardioViews.swift](targets/watch/CardioViews.swift)) is sized for the smallest watch it runs on, 40 mm: clock, distance, pace (`--:--` until there's enough to say) and heart rate in about 140 of a page's ~160 points. Average pace moves every 5 s there and on the phone — worked out every second it twitched.
- **Matching by kind and start time** (within 5 minutes) is only for a session the phone woke the watch for: `startCardio` carries `fromPhone`, and a run started on the wrist is never taken for a session discarded on the phone. A watch that takes over a phone session late gets the phone's stretch counted first — its moving time, and on foot its step count — on the clock and in what's saved.
- The session is saved to Apple Health by the watch, for the rings. Plato reads nothing from Health except during its own sessions — there's no import of other apps' workouts.

With no watch tracking it, a session **on foot** (run, walk, hike) is measured by the iPhone's step counter, `CMPedometer` in [modules/plato-motion](modules/plato-motion). The motion coprocessor counts steps whether Plato is open or not, so nothing has to stay awake:

- **While it runs**, the screen shows distance and average pace ([use-phone-distance.ts](src/hooks/use-phone-distance.ts)): the stretches before the last resume asked about once, the one under way counted live.
- **At End**, the moving time — start to end less each pause, kept in `cardio.pauses` — is cut into minutes and the step counter asked about each ([phone-distance.ts](src/lib/phone-distance.ts)). The total is the distance; the minute-by-minute curve gives splits and best efforts through the same code as the watch's. It's saved with `tracked.source: "iPhone"`, and End doesn't ask how far.
- With Motion & Fitness refused, no step counter, or next to nothing counted, End asks how far, as it always did.

iOS's first-time questions — Health access with a watch, Motion & Fitness on foot — are asked on the picker ([start-cardio.tsx](src/app/start-cardio.tsx)) before the session exists. Asked after moving to the session screen, the Health sheet was requested while the picker was being dismissed and never showed (build 67); the watch then woke without access and asked on the wrist.

The first build with HealthKit needs the capability on both App IDs: run `eas credentials` → iOS → production → Build Credentials → *All*, which signs in to Apple, enables HealthKit on the phone and watch apps and makes new profiles. The GitHub build can't do that step itself.

To take sessions out: delete `src/app/start-cardio.tsx`, `src/components/cardio-session.tsx`, `src/lib/cardio-session.ts`, `src/lib/cardio-tracking.ts`, `src/lib/watch-live.ts`, `src/lib/phone-distance.ts`, `src/hooks/use-phone-distance.ts`, `modules/plato-health`, `modules/plato-motion`, and on the watch `CardioTracker.swift`, `CardioViews.swift`, `CardioMath.swift` (plus their uses in WatchStore, PlatoWatchApp, TemplatesView, Models and Logbook, the cardio ops in watch-protocol.ts and watch-sync.tsx); drop the HealthKit entitlements and the `NSHealth…` and `NSMotionUsageDescription` strings from app.json and the watch target; put Home's single start button back. Saved sessions stay, as plain cardio workouts.

Finishing a workout stores `totalVolume`, priced at that day's weigh-in, and recomputes `userStats/{uid}`, which plato-web reads.

## Privacy

The privacy policy is [docs/index.html](docs/index.html), served at <https://braydenric.github.io/Plato/> and linked from the App Store listing. Update it whenever what the app stores changes, including what it keeps on the device.
