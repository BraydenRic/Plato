# Plato Mobile

iOS + Android workout tracker built with Expo (React Native). Shares its Firebase backend with [plato-web](../plato-web) — the same account sees the same workouts on web and mobile.

## Features

- **Workout logging** — start empty or from a template, add exercises, log weight × reps per set, check sets off as you go.
- **Rest timer** — 90s countdown starts automatically when you complete a set.
- **Templates** — save any workout as a template, start it again with one tap.
- **Exercise library** — 60+ movements with muscle groups and coaching notes, searchable by name or muscle.
- **Statistics** — streaks, lifetime volume/sets/time, and a 14-day volume chart. All stats are **derived from workout history**, never incremented counters, and history is kept forever.
- **Cloud sync** — Firebase Auth (Google or email/password) + Firestore. Sign in on any device.

## Running it on your iPhone (from WSL2/Windows)

1. Install the **Expo Go** app from the App Store.
2. Copy the Firebase config (already done if `.env.local` exists — see `.env.example`).
3. Start the dev server in tunnel mode (LAN mode usually can't cross the WSL2 network boundary):

   ```bash
   npx expo start --tunnel
   ```

4. Scan the QR code with the iPhone camera. The app opens in Expo Go.

For Android: same thing with the Expo Go app from the Play Store.

## One-time Firebase setup

In the [Firebase console](https://console.firebase.google.com/project/workouttracker-4e0c8):

- **Authentication → Sign-in method → enable Email/Password.** Google's native sign-in can't run inside Expo Go (it needs custom native code), so email/password is the way to sign in while developing.
- **Authentication → Sign-in method → enable Google** for the "Continue with Google" button, which appears automatically in development/production builds (it's hidden in Expo Go).
- Firestore security rules should allow signed-in users to read/write their own `workouts` and `userStats` docs, e.g.:

  ```
  match /workouts/{id} {
    allow read, write: if request.auth != null
      && (resource == null || resource.data.userId == request.auth.uid)
      && (request.resource == null || request.resource.data.userId == request.auth.uid);
  }
  match /userStats/{uid} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```

## Project structure

```
src/
├── app/                 # Expo Router routes
│   ├── _layout.tsx      # Auth guard: sign-in vs app
│   ├── sign-in.tsx
│   ├── (tabs)/          # Workouts · Exercises · Stats · Profile
│   ├── workout/[id].tsx # Live set-logging screen
│   └── add-exercise.tsx # Modal exercise picker
├── components/ui.tsx    # Button, Card, Field, Chip, …
├── constants/theme.ts   # Plato palette (dark zinc + violet)
├── context/AuthContext.tsx
├── hooks/use-workouts.ts
├── lib/
│   ├── firebase.ts      # App/Auth/Firestore init (env-driven)
│   ├── firestore.ts     # Data layer — shared shape with plato-web
│   ├── exercises.ts     # Bundled exercise library
│   └── workout-utils.ts # Volume/duration/streak helpers
└── types/index.ts       # Shared domain types (same as plato-web)
```

## Data model

One Firestore doc per workout with exercises and sets **embedded** — a set update writes the whole exercises array, so a set can never be partially zeroed or orphaned. `userStats/{uid}` is recomputed from full history after every finished workout (plato-web reads the same doc).

## Google sign-in setup (development/production builds only)

The Google button uses `@react-native-google-signin/google-signin`, which is native code — it works in EAS builds but **not in Expo Go** (where the button is hidden and email/password is used instead). One-time setup before your first build:

1. Enable the **Google** provider in Firebase console → Authentication → Sign-in method.
2. Copy the **Web client ID** shown under that provider's *Web SDK configuration* into `.env.local`:

   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=79757088014-xxxx.apps.googleusercontent.com
   ```

3. For iOS, create an iOS OAuth client (Google Cloud console → APIs & Services → Credentials → Create credentials → OAuth client ID → iOS, bundle ID `com.plato.workouts`), then put its **reversed** client ID into `app.json` where the plugin currently says `REPLACE-WITH-REVERSED-IOS-CLIENT-ID` (it looks like `com.googleusercontent.apps.79757088014-xxxx`).

## Store builds (later)

Expo Go is for development. For TestFlight/App Store/Play Store builds, use EAS:

```bash
npm i -g eas-cli
eas build --platform ios   # cloud-builds the iOS binary; no Mac needed
```

Note: installing a **development** build on a physical iPhone requires an Apple Developer Program membership ($99/yr) so EAS can sign it for your device. Android dev builds are free APKs.
