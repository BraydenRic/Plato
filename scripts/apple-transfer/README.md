# Moving Plato's Sign in with Apple users to another team

One-off tool for the App Store transfer to a new Apple Developer team (e.g. an
LLC). Nothing here is part of the app, and nothing here runs in CI.

## What problem this solves

Apple scopes each user's identifier (`sub`) to the developer **team** that owns
the app, not to the app. That's deliberate — it stops one developer recognising
the same person across their portfolio. So when Plato moves to a new team, Apple
starts returning a **different `sub` for the same human**.

Firebase stores that `sub` as the Apple provider's uid. A `sub` it has never
seen is a new person, so it creates a new Firebase uid — and every collection in
this app (`workouts`, `userStats`, `exerciseLibrary`, `weeklyPlans`,
`bodyweight`) is keyed by Firebase uid. The user opens Plato and finds it empty.
Their history is still in Firestore, untouched, and now unreachable, with
`firestore.rules` correctly refusing the new account access to the old rows.

**No user data moves.** The only thing that changes is one identifier on the
auth record. This tool captures the old → new mapping from Apple and writes it
back, so each user keeps their existing Firebase uid and therefore all of their
data.

Only Sign in with Apple is affected. Email/password users are keyed by email and
Google users by their Google account id; neither identifier comes from your
Apple team, so both survive the transfer untouched. Guests never had an account.

## The one thing you cannot do later

`collect` can only run **while you still own the app on the old team**. If you
transfer without running it, there is no supported way to reconnect those users.
Everything else can be done afterwards, within Apple's window.

## Before you start

Check these while Plato is still yours — each one is cheap now and a blocker
later:

- [ ] You still have the **`.p8` Sign in with Apple key** for the current team.
      If it's lost, generate a new key in the Apple Developer portal and update
      Firebase Console → Authentication → Sign-in method → Apple *first*. You
      cannot sign the requests in step 1 without it.
- [ ] The **new team's** Developer Program membership is active and its
      agreements are accepted in App Store Connect. A transfer isn't offered to
      an account that hasn't finished enrolling.
- [ ] Plato has **no version in Waiting for Review, In Review, or Pending
      Developer Release**. Any of those blocks the transfer, so don't submit a
      release immediately beforehand.
- [ ] You have the new team's **Team ID** (developer.apple.com → Membership).

## Order of operations

Steps 4 and 5 want to be close together. Everything after step 5 can take its
time, within Apple's exchange window.

1. Confirm the prerequisites above.
2. `npm run collect`
3. Submit the transfer in App Store Connect.
4. `npm run collect` again — picks up anyone who signed up in between.
5. Accept the transfer from the new account.
6. `npm run exchange`
7. `npm run apply` — dry run; read what it says it will do.
8. `npm run apply -- --commit`, then sign in as that user on a device and
   confirm their history is there.
9. Run it for the rest.

### How much time you actually have

The gap that matters is small and specific: it is only people who sign in with
Apple **for the first time between your last `collect` and the transfer
completing**. Anyone who signs up *after* the transfer is an ordinary new user
on the new team with nothing to migrate, and anyone already collected is
already safe. A final `collect` immediately before you accept closes it.

## Setup

```
cd scripts/apple-transfer
npm install
```

Two sets of credentials. Neither is read by anyone but you — the script takes
paths and reads them at runtime.

**Firebase** — a service account with permission to read and import users:
Firebase Console → Project settings → Service accounts → Generate new private
key.

```
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

**Apple** — the same four values already configured in Firebase Console →
Authentication → Sign-in method → Apple. The `.p8` is the private key file you
downloaded from the Apple Developer portal when you created the Sign in with
Apple key; if you no longer have it, generate a new key and update Firebase.

```
export APPLE_SERVICES_ID=...        # e.g. com.plato.workouts.signin
export APPLE_TEAM_ID=...            # the team the command runs AS
export APPLE_KEY_ID=...             # 10 chars
export APPLE_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
```

`APPLE_TEAM_ID` is **the team you are acting as**, and it changes between
phases: the old team for `collect`, the new team for `exchange`.

## Running it

### 1. Before the transfer — `collect`

Run as the **old** team. Also set the destination:

```
export APPLE_TARGET_TEAM_ID=<the new team's Team ID>
npm run collect
```

Reads every Apple user from Firebase, asks Apple for a `transfer_sub` for each,
and writes `apple-transfer-map.json`. It writes nothing to Firebase.

It is **re-runnable and incremental** — users already collected are skipped. Run
it again immediately before the transfer completes, because anyone who signs in
with Apple for the first time during the gap won't be in the map otherwise.

Keep `apple-transfer-map.json`. It is the whole point of this step and it cannot
be regenerated once the app has moved.

### 2. Transfer the app

App Store Connect → Apps → Plato → App Information → Transfer App.

Apple does not "approve" a transfer the way it reviews a build. It runs
eligibility checks when you initiate, but the thing that completes it is **the
recipient accepting**. If you own both accounts you control that timing, so
submit and accept back to back and the whole window is minutes rather than
days.

Do not plan on collecting mappings after the move. Once the app belongs to the
new team, the old team no longer owns it — treat "before the transfer
completes" as a hard deadline rather than something with a grace period.

### 3. After the transfer — `exchange`

Run as the **new** team, with the new team's Sign in with Apple key:

```
export APPLE_TEAM_ID=<new team>
export APPLE_KEY_ID=... APPLE_PRIVATE_KEY_PATH=... APPLE_SERVICES_ID=...
npm run exchange
```

Turns each `transfer_sub` into that team's `sub` and records it. Still writes
nothing to Firebase. Apple allows a limited window after the transfer for this —
check their current documentation and don't leave it for months.

### 4. Write it back — `apply`

```
npm run apply            # dry run, prints what would change
npm run apply -- --commit
```

Rewrites each auth record so the **existing Firebase uid** points at the new
Apple identifier. Because the uid doesn't change, no Firestore data is touched.

Do one user first. Sign in as them on a device, confirm their history is there,
then run the rest.

### Users it deliberately skips

`apply` refuses anyone who has a password or more than one provider. Changing
`providerData` requires `importUsers`, which **overwrites** the record rather
than merging — restating a password hash correctly needs the project's hash
parameters, and getting it wrong silently locks someone out of their own
account.

Those users can already sign in another way, so they lose nothing by being left
alone. They'll simply have a stale Apple link. Re-link by hand if you want it
back.

## If something goes wrong

- `invalid_client` from Apple — nearly always the client secret: wrong Team ID
  for the key, wrong Key ID, or the `.p8` doesn't match. The script signs ES256
  as raw `r||s`, which is what Apple requires; DER-encoded signatures are
  rejected with exactly this error.
- `collect` reports zero users — check `GOOGLE_APPLICATION_CREDENTIALS` points
  at the right project.
- A single user fails — the script logs and continues rather than aborting, so
  one bad record doesn't cost you the rest. Re-run to retry just the failures.

## Afterwards

Delete `apple-transfer-map.json` and the service account key. The map contains
user identifiers and emails and has no further use once `apply` reports done.

Note this tool has never been run against Apple's live endpoints — the JWT
signing is verified locally, but the request/response shapes come from Apple's
documentation. Expect to debug the first call, and do it on one user.
