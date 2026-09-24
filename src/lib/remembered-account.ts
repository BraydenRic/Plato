import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "firebase/auth";

/**
 * Who was signed in last, kept so the app can open on that account straight
 * away instead of waiting for Firebase to confirm it.
 *
 * The wait is the problem. Firebase restores a saved session by checking it
 * with the server first. With no signal at all that check fails fast and the
 * session is kept. But on the kind of signal gyms are full of, connected and
 * getting nothing through, it waits out a 60-second timeout, and Plato sat on
 * its splash screen the whole time. Now the app opens on the remembered
 * account, reads from the offline copy (cloud-cache), and swaps in Firebase's
 * real user when it arrives. Nothing is sent to the server until then:
 * cloud-cache holds every write back until Firebase confirms this uid.
 *
 * Only what the screens read is kept: the uid for routing data, and what
 * Profile and the email-verification gate show. Firebase already keeps all of
 * this, and more, in the same storage.
 */

const KEY = "plato.account.v1";

interface RememberedAccount {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providerIds: string[];
}

/** Marks a stand-in, so it's never written back as though Firebase had confirmed it. */
const PROVISIONAL = Symbol("provisional");

export function isProvisional(user: User | null): boolean {
  return !!user && PROVISIONAL in user;
}

/**
 * A stand-in User built from the remembered fields.
 *
 * It has only the fields the screens read. Anything that needs the real
 * session goes through auth.currentUser, which stays null until Firebase
 * confirms, so those actions fail cleanly instead of acting on a guess.
 */
function provisionalUser(account: RememberedAccount): User {
  return {
    [PROVISIONAL]: true,
    uid: account.uid,
    email: account.email,
    displayName: account.displayName,
    emailVerified: account.emailVerified,
    providerData: account.providerIds.map((providerId) => ({ providerId })),
  } as unknown as User;
}

function parse(raw: string | null): RememberedAccount | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.uid !== "string" || !value.uid) return null;
    const providers = Array.isArray(value.providerIds)
      ? value.providerIds
      : Array.isArray(value.providerData)
        ? (value.providerData as { providerId?: unknown }[]).map((p) => p?.providerId)
        : [];
    return {
      uid: value.uid,
      email: typeof value.email === "string" ? value.email : null,
      displayName: typeof value.displayName === "string" ? value.displayName : null,
      emailVerified: value.emailVerified === true,
      providerIds: providers.filter((p): p is string => typeof p === "string"),
    };
  } catch {
    return null;
  }
}

/**
 * The remembered account as a stand-in User, or null.
 *
 * On the first launch after this shipped nothing is remembered yet, so this
 * falls back to the session Firebase saved itself. That session uses an
 * internal format, not a public one. If a future Firebase changes it, the
 * parse finds nothing and the app waits for Firebase as it always did, so the
 * fallback can only help.
 */
export async function readRememberedUser(): Promise<User | null> {
  try {
    const own = parse(await AsyncStorage.getItem(KEY));
    if (own) return provisionalUser(own);
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) return null;
    const firebases = parse(await AsyncStorage.getItem(`firebase:authUser:${apiKey}:[DEFAULT]`));
    return firebases ? provisionalUser(firebases) : null;
  } catch {
    return null;
  }
}

export async function rememberUser(user: User): Promise<void> {
  if (isProvisional(user)) return;
  const account: RememberedAccount = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    providerIds: user.providerData.map((p) => p.providerId),
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(account));
  } catch (e) {
    console.warn("Couldn't remember the signed-in account", e);
  }
}

export async function forgetRememberedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn("Couldn't forget the signed-in account", e);
  }
}
