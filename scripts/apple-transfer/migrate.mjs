/**
 * Keeps Sign in with Apple users when Plato moves to another Apple Developer team.
 *
 * WHY THIS EXISTS
 *
 * Apple scopes each user's identifier (`sub`) to the developer *team* that owns
 * the app, not to the app itself — deliberately, so one developer can't
 * correlate a person across their portfolio. Transferring Plato to another team
 * therefore means Apple hands back a different `sub` for the same human.
 *
 * Firebase stores that `sub` as the Apple provider's uid. A `sub` it has never
 * seen is a new person, so it mints a new Firebase uid — and every collection in
 * this app (workouts, userStats, exerciseLibrary, weeklyPlans, bodyweight) is
 * keyed by Firebase uid. The user's history is still there, still intact, and
 * now unreachable, with firestore.rules correctly refusing the new account
 * access to the old account's rows.
 *
 * No user data moves. The only thing that changes is one identifier on the auth
 * record. Apple's migration endpoints exist to give you the old -> new mapping,
 * and half of that can only be obtained while you still own the app.
 *
 * THREE PHASES, RUN IN ORDER
 *
 *   collect    BEFORE the transfer. Reads Apple users out of Firebase and asks
 *              Apple for a `transfer_sub` for each. Writes the map. Touches
 *              nothing. Re-runnable — run it again right before the transfer
 *              completes to catch anyone who signed up in the meantime.
 *
 *   exchange   AFTER the transfer, from the new team. Turns each transfer_sub
 *              into that team's `sub`. Still touches nothing.
 *
 *   apply      AFTER exchange. The only step that writes. Rewrites each auth
 *              record so the existing Firebase uid keeps its data and points at
 *              the new Apple identifier. Dry run unless --commit is passed.
 *
 * See README.md for the environment variables and the order to run things in.
 */

import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { argv, env, exit } from "node:process";

const MAP_FILE = env.MAP_FILE ?? "apple-transfer-map.json";
const APPLE = "https://appleid.apple.com";

// ── small helpers ────────────────────────────────────────────────────────────

const b64url = (v) => Buffer.from(v).toString("base64url");

function need(name) {
  const value = env[name];
  if (!value) {
    console.error(`Missing ${name}. See README.md.`);
    exit(1);
  }
  return value;
}

function loadMap() {
  if (!existsSync(MAP_FILE)) return { users: {} };
  return JSON.parse(readFileSync(MAP_FILE, "utf8"));
}

function saveMap(map) {
  writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + "\n");
}

// ── Apple ────────────────────────────────────────────────────────────────────

/**
 * Apple authenticates you with a short-lived JWT rather than a static secret.
 * ES256 signatures must be raw r||s, which is what `ieee-p1363` produces — the
 * DER encoding Node defaults to is rejected with an opaque invalid_client.
 */
function clientSecret({ teamId, keyId, servicesId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const claims = {
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: APPLE,
    sub: servicesId,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign("SHA256")
    .update(input)
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(signature)}`;
}

async function appleForm(path, body, accessToken) {
  const res = await fetch(`${APPLE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: new URLSearchParams(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || parsed.error) {
    throw new Error(`${path} returned ${res.status}: ${parsed.error ?? text.slice(0, 200)}`);
  }
  return parsed;
}

/** Credentials from Firebase Console -> Authentication -> Sign-in method -> Apple. */
function appleConfig() {
  const servicesId = need("APPLE_SERVICES_ID");
  const teamId = need("APPLE_TEAM_ID");
  const keyId = need("APPLE_KEY_ID");
  const privateKey = readFileSync(need("APPLE_PRIVATE_KEY_PATH"), "utf8");
  return { servicesId, teamId, keyId, privateKey };
}

async function appleSession() {
  const cfg = appleConfig();
  const secret = clientSecret(cfg);
  // `user.migration` is the only scope these endpoints accept.
  const { access_token: accessToken } = await appleForm("/auth/token", {
    grant_type: "client_credentials",
    scope: "user.migration",
    client_id: cfg.servicesId,
    client_secret: secret,
  });
  return { accessToken, secret, clientId: cfg.servicesId };
}

// ── Firebase ─────────────────────────────────────────────────────────────────

async function firebaseAuth() {
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  // Reads GOOGLE_APPLICATION_CREDENTIALS. The key is never read by this script
  // directly and never leaves the machine.
  initializeApp({ credential: applicationDefault() });
  return getAuth();
}

/** Every user with an apple.com provider, with the bits needed to rewrite them. */
async function listAppleUsers(auth) {
  const found = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const apple = user.providerData.find((p) => p.providerId === "apple.com");
      if (!apple) continue;
      found.push({
        uid: user.uid,
        appleSub: apple.uid,
        email: user.email ?? null,
        providers: user.providerData.map((p) => p.providerId),
        hasPassword: Boolean(user.passwordHash),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return found;
}

// ── phases ───────────────────────────────────────────────────────────────────

async function collect() {
  const target = need("APPLE_TARGET_TEAM_ID");
  const auth = await firebaseAuth();
  const users = await listAppleUsers(auth);
  const map = loadMap();
  map.target = target;
  map.collectedFor = map.collectedFor ?? [];

  console.log(`${users.length} Apple user(s) in Firebase; target team ${target}\n`);

  const session = await appleSession();
  let fresh = 0;
  let already = 0;

  for (const user of users) {
    const existing = map.users[user.uid];
    if (existing?.transferSub && existing.target === target) {
      already++;
      continue;
    }
    try {
      const { transfer_sub: transferSub } = await appleForm(
        "/auth/usermigrationinfo",
        {
          sub: user.appleSub,
          target,
          client_id: session.clientId,
          client_secret: session.secret,
        },
        session.accessToken
      );
      map.users[user.uid] = {
        ...user,
        target,
        transferSub,
        collectedAt: new Date().toISOString(),
      };
      fresh++;
      console.log(`  ok    ${user.uid}  ${user.email ?? "(no email)"}`);
    } catch (error) {
      // Keep going: one bad record shouldn't cost you the other seven.
      console.error(`  FAIL  ${user.uid}  ${error.message}`);
    }
  }

  saveMap(map);
  console.log(
    `\n${fresh} collected, ${already} already had one. Map: ${MAP_FILE}` +
      `\nRe-run this right before the transfer completes to catch new sign-ups.`
  );
}

async function exchange() {
  const map = loadMap();
  const entries = Object.entries(map.users).filter(([, u]) => u.transferSub && !u.newSub);
  if (entries.length === 0) {
    console.log("Nothing left to exchange.");
    return;
  }
  // Run from the *new* team: APPLE_TEAM_ID and the key must be the LLC's.
  const target = need("APPLE_TEAM_ID");
  const session = await appleSession();
  console.log(`Exchanging ${entries.length} identifier(s) into team ${target}\n`);

  for (const [uid, user] of entries) {
    try {
      const result = await appleForm(
        "/auth/usermigrationinfo",
        {
          transfer_sub: user.transferSub,
          target,
          client_id: session.clientId,
          client_secret: session.secret,
        },
        session.accessToken
      );
      user.newSub = result.sub;
      user.newEmail = result.email ?? null;
      user.exchangedAt = new Date().toISOString();
      console.log(`  ok    ${uid}  -> ${result.sub}`);
    } catch (error) {
      console.error(`  FAIL  ${uid}  ${error.message}`);
    }
  }

  saveMap(map);
  console.log(`\nDone. Run \`npm run apply\` to see what would change.`);
}

async function apply() {
  const commit = argv.includes("--commit");
  const map = loadMap();
  const ready = Object.entries(map.users).filter(([, u]) => u.newSub && !u.appliedAt);
  if (ready.length === 0) {
    console.log("Nothing to apply.");
    return;
  }

  const auth = await firebaseAuth();
  console.log(commit ? "APPLYING FOR REAL\n" : "DRY RUN — nothing will be written. Add --commit.\n");

  for (const [uid, user] of ready) {
    /*
     * importUsers is the only way to change providerData, and it *overwrites*
     * the record rather than merging. Anything not restated here is lost — most
     * dangerously a password hash, which listUsers does not return in a form
     * that can be handed back without the project's hash parameters.
     *
     * So this refuses to touch anyone it cannot rewrite losslessly. Those users
     * have another way in anyway, which is exactly why they are the safe ones to
     * leave alone.
     */
    if (user.hasPassword || user.providers.length > 1) {
      console.log(
        `  skip  ${uid}  has ${user.providers.join(", ")}${user.hasPassword ? " + password" : ""}` +
          ` — can sign in another way; rewrite by hand if you want the Apple link back`
      );
      continue;
    }

    const record = {
      uid,
      email: user.email ?? undefined,
      emailVerified: true,
      providerData: [
        {
          uid: user.newSub,
          providerId: "apple.com",
          email: user.newEmail ?? user.email ?? undefined,
        },
      ],
    };

    if (!commit) {
      console.log(`  would  ${uid}  ${user.appleSub} -> ${user.newSub}`);
      continue;
    }

    const result = await auth.importUsers([record]);
    if (result.failureCount > 0) {
      console.error(`  FAIL   ${uid}  ${result.errors[0]?.error?.message ?? "unknown"}`);
      continue;
    }
    user.appliedAt = new Date().toISOString();
    console.log(`  done   ${uid}  ${user.appleSub} -> ${user.newSub}`);
  }

  if (commit) saveMap(map);
}

// ── entry ────────────────────────────────────────────────────────────────────

const phases = { collect, exchange, apply };
const phase = argv[2];

if (!phases[phase]) {
  console.error("Usage: node migrate.mjs <collect|exchange|apply> [--commit]");
  exit(1);
}

phases[phase]().catch((error) => {
  console.error(`\n${error.stack ?? error.message}`);
  exit(1);
});
