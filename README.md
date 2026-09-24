# Plato Mobile

iOS workout tracker built with Expo (React Native), live on the App Store. It shares its Firebase backend with [plato-web](../plato-web), so the same account sees the same workouts on both.

## Features

- **Workout logging.** Start empty, from a template, or from the day's weekly-split slot. Enter weight × reps on a gym-friendly keypad with Back / Done / Next, copy the previous set in one tap, and time holds and cardio with a per-set stopwatch. Sets complete themselves once filled in.
- **Rest timer.** Off by default, and set in Profile. It survives leaving the workout screen.
- **Live Activity.** The workout in progress sits on the Lock Screen and in the Dynamic Island, with a running clock and the rest countdown.
- **Templates, weekly split and planning.** Reusable templates (up to 20), a weekday → template split, and workouts planned or backfilled on any calendar day.
- **Exercise library.** 500 built-ins across 11 categories, including Neck, each with a form guide. Custom exercises, edits to built-ins and hidden built-ins are stored as per-user deltas.
- **Progress.** Full history, per-exercise progress charts (weight, reps, estimated 1RM), weekly sets per muscle group, and a muscle map.
- **Body weight.** Dated weigh-ins, a trend chart, and bodyweight exercises valued at what you weighed *on the day you trained*. A finished workout's volume is frozen, so a later weigh-in never rewrites it.
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
npm test                   # jest, ~700 tests
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
├── components/                  # UI kit, resume bar, charts, muscle map, Live Activity sync
├── context/                     # Auth, appearance/theme, units, rest + set timers, default sets
├── hooks/                       # Workouts, active workout, bodyweight, library, weekly plan
├── lib/
│   ├── data.ts                  # The single data entry point — routes cloud vs device
│   ├── cloud-cache.ts           # Offline copy + outbox for signed-in accounts
│   ├── firestore.ts             # Cloud store (Firestore calls)
│   ├── remembered-account.ts    # Opens on the last account without waiting for Firebase
│   ├── local-store.ts           # Guest store (one AsyncStorage blob)
│   ├── migrate-guest-data.ts    # Guest → account, resumable
│   ├── exercises.ts             # The 500 built-ins + search
│   ├── exercise-form.ts         # Form guide per built-in, keyed by id
│   ├── workout-utils.ts         # Volume, streaks, dates, previous sets
│   ├── bodyweight-cache.ts      # Offline copy of the weigh-in log
│   └── live-activity.ts
├── constants/theme.ts           # Palettes (light/dark) and the seven accents
└── types/index.ts               # Domain types, shared with plato-web
plugins/                         # Config plugin patching the Live Activity widget
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

Finishing a workout stores `totalVolume`, priced at that day's weigh-in, and recomputes `userStats/{uid}`, which plato-web reads.

## Privacy

The privacy policy is [docs/index.html](docs/index.html), served at <https://braydenric.github.io/Plato/> and linked from the App Store listing. Update it whenever what the app stores changes, including what it keeps on the device.
