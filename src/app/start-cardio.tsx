import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useWeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { SESSION_KINDS, kindInfo, newCardioSession, placeLabel, sessionTarget, type Place } from "@/lib/cardio-session";
import PlatoHealth from "../../modules/plato-health";
import PlatoMotion from "../../modules/plato-motion";
import PlatoWatch from "../../modules/plato-watch";
import { createWorkoutLocalFirst, stripUndefined } from "@/lib/data";
import { stepCounted } from "@/lib/phone-distance";
import { setWatchStart, traceWatch } from "@/lib/watch-trace";
import { MAX_ACTIVE_WORKOUTS } from "@/lib/workout-utils";
import type { CardioSessionKind, Workout } from "@/types";

/**
 * A pool's length, which the watch counts laps against. Pools in lbs
 * countries are mostly 25 yards, elsewhere 25 metres; a guess either way, but
 * the right one more often than a fixed 25 m.
 */
const POOL_METRES = 25;
const POOL_YARDS_IN_METRES = 25 * 0.9144;

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * How long Start waits on a permission sheet before starting anyway. iOS
 * always answers, but a Start that never starts would be the worst way to
 * find out it didn't.
 */
export const PERMISSION_PATIENCE_MS = 90_000;

/** Whether `promise` settled in time. Rejections pass through. */
async function settledWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([promise.then(() => true as const), late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What the session screen says when the watch didn't wake. iOS's own words —
 * "The operation couldn't be completed. Unable to open URLs…" for a locked
 * watch — say nothing anyone can act on; they go in the diagnostics trace.
 */
export const WATCH_DIDNT_WAKE = "Your watch didn't wake — it may be locked or off your wrist. Your iPhone is timing this.";

/** Whether a watch will be woken for the session, or why it can't be. */
type WatchAccess = "none" | "granted" | { refused: string };

/** The last kind and place started on this phone, so a runner's next tap is Start. */
export const LAST_CARDIO_KEY = "plato.cardio.last.v1";

/**
 * Picking a cardio session to start: what, and — where it matters — indoors
 * or out. Two choices and a button, so the time between deciding to run and
 * the clock running is a couple of taps.
 */
export default function StartCardioScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const router = useRouter();
  const { dataUserId } = useAuth();
  const { unit } = useWeightUnit();
  const { active } = useWorkouts();
  const [kind, setKind] = useState<CardioSessionKind>("run");
  const [place, setPlace] = useState<Place>("outdoor");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_CARDIO_KEY)
      .then((raw) => {
        const last = raw ? (JSON.parse(raw) as { kind?: string; place?: string }) : null;
        const info = SESSION_KINDS.find((k) => k.kind === last?.kind);
        if (!info) return;
        setKind(info.kind);
        setPlace(info.places.includes(last?.place as Place) ? (last!.place as Place) : info.places[0]);
      })
      .catch(() => {});
  }, []);

  const info = kindInfo(kind);
  const { name } = sessionTarget(kind, place === "indoor");

  function pick(next: CardioSessionKind) {
    setKind(next);
    // Keep indoors/outdoors when the new kind has it; a rower is only ever in.
    const nextInfo = kindInfo(next);
    if (!nextInfo.places.includes(place)) setPlace(nextInfo.places[0]);
  }

  async function start() {
    if (!dataUserId || starting) return;
    if (active.length >= MAX_ACTIVE_WORKOUTS) {
      Alert.alert(
        "Too many workouts in progress",
        `Finish or delete one of your ${MAX_ACTIVE_WORKOUTS} in-progress workouts before starting another.`
      );
      return;
    }
    setStarting(true);
    AsyncStorage.setItem(LAST_CARDIO_KEY, JSON.stringify({ kind, place })).catch(() => {});
    // Whatever iOS asks the first time, it asks here, over the picker, before
    // the clock starts. Build 67 asked from the session screen — the sheet
    // went up while this screen was being dismissed and never showed, so the
    // watch woke without Health access and asked on its own wrist instead,
    // where nobody mid-run was looking.
    const watch = await askForWatch();
    await askForSteps();
    const session = newCardioSession(kind, place === "indoor", { userId: dataUserId, weightUnit: unit, now: new Date() });
    const { id, saved } = createWorkoutLocalFirst(stripUndefined(session));
    // Straight onto the clock, with this picker gone from the stack behind it.
    router.replace(`/workout/${id}`);
    saved.catch(() => Alert.alert("Couldn't start", "Check your connection and try again."));
    void wakeWatch(id, session.cardio!, watch);
  }

  /**
   * Health access for the watch to track the session: iOS's sheet the first
   * time, an instant answer after. Only asked with a watch that has Plato on
   * it — with none, the session runs on the phone and Health isn't used.
   */
  async function askForWatch(): Promise<WatchAccess> {
    if (!PlatoHealth || !PlatoWatch) {
      traceWatch("start: no Health or watch module (not an iPhone build)");
      return "none";
    }
    let installed = false;
    try {
      installed = PlatoWatch.isWatchAppInstalled();
    } catch (e) {
      traceWatch(`start: couldn't ask about the watch (${errorText(e)})`);
    }
    if (!installed) {
      // No watch with Plato on it: nothing to wake, and nothing to say about it.
      traceWatch("start: no watch with Plato on it — phone clock");
      return "none";
    }
    try {
      const answered = await settledWithin(PlatoHealth.requestAccess(), PERMISSION_PATIENCE_MS);
      traceWatch(answered ? "start: Health access asked" : "start: no answer from the Health sheet; starting anyway");
      return "granted";
    } catch (e) {
      traceWatch(`start: Health access failed (${errorText(e)})`);
      return { refused: "Plato couldn't get Apple Health access, so your watch can't track this." };
    }
  }

  /**
   * Motion & Fitness for the step counter, on a session on foot — asked by
   * asking it something, the first time only. Refused, the session asks how
   * far at the end instead; nothing to do about that here.
   */
  async function askForSteps() {
    if (!PlatoMotion || !stepCounted(kind)) return;
    try {
      if (!PlatoMotion.isAvailable() || PlatoMotion.authorization() !== "notDetermined") return;
      const now = Date.now();
      await settledWithin(PlatoMotion.distances([now - 60_000, now]), PERMISSION_PATIENCE_MS);
      traceWatch("start: Motion & Fitness asked");
    } catch (e) {
      traceWatch(`start: Motion & Fitness refused (${errorText(e)})`);
    }
  }

  /**
   * Wakes the watch into the session, so its sensors track it. With no watch,
   * or the watch off a wrist, the session just runs on the phone.
   */
  async function wakeWatch(id: string, cardio: NonNullable<Workout["cardio"]>, access: WatchAccess) {
    if (access === "none" || !PlatoHealth) return;
    if (access !== "granted") {
      setWatchStart(id, { state: "failed", reason: access.refused });
      return;
    }
    setWatchStart(id, { state: "waking", at: Date.now() });
    traceWatch(`start: waking the watch for ${cardio.kind}`);
    try {
      // Waking the app proves nothing: the session is marked as tracked on the
      // watch when the watch says it's tracking (its startCardio, in
      // watch-sync), and until then runs on the phone's clock.
      const woken = await PlatoHealth.startWatchWorkout(cardio.kind, !!cardio.indoor, unit === "kg" ? POOL_METRES : POOL_YARDS_IN_METRES);
      traceWatch(`start: watch ${woken ? "woken" : "not woken"}`);
      setWatchStart(id, woken ? { state: "woken", at: Date.now() } : { state: "failed", reason: WATCH_DIDNT_WAKE });
    } catch (e) {
      traceWatch(`start: waking the watch failed (${errorText(e)})`);
      setWatchStart(id, { state: "failed", reason: WATCH_DIDNT_WAKE });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={FontScaleCap.title}>
          Start cardio
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={styles.close}>
          <Ionicons name="close" size={20} color={palette.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.grid}>
          {SESSION_KINDS.map((k) => {
            const selected = k.kind === kind;
            return (
              <Pressable
                key={k.kind}
                onPress={() => pick(k.kind)}
                accessibilityRole="button"
                accessibilityLabel={k.label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.tile,
                  selected
                    ? { backgroundColor: theme.accentSoft, borderColor: theme.accent }
                    : { backgroundColor: palette.surface, borderColor: palette.border },
                  pressed && { opacity: 0.8 },
                ]}>
                <Ionicons name={k.icon} size={26} color={selected ? theme.accentText : palette.textSecondary} />
                <Text
                  style={[styles.tileLabel, { color: selected ? theme.accentText : palette.textSecondary }]}
                  maxFontSizeMultiplier={FontScaleCap.grid}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {info.places.length > 1 && (
          <View style={styles.segment}>
            {info.places.map((p) => {
              const selected = p === place;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPlace(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segmentItem, selected && { backgroundColor: theme.accent }]}>
                  <Text style={[styles.segmentText, selected && { color: theme.onAccent }]}>{placeLabel(kind, p)}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button title={`Start ${name.toLowerCase()}`} onPress={start} loading={starting} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.three,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: c.text,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: c.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  // Four to a row: the whole choice fits above the thumb on the smallest phone.
  tile: {
    flexBasis: "23%",
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  segment: {
    flexDirection: "row",
    backgroundColor: c.surfaceRaised,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "700",
    color: c.textSecondary,
  },
  footer: {
    padding: Spacing.three,
  },
}));
