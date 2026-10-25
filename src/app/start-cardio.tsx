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
import { createWorkoutLocalFirst, stripUndefined } from "@/lib/data";
import { MAX_ACTIVE_WORKOUTS } from "@/lib/workout-utils";
import type { CardioSessionKind } from "@/types";

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

  function start() {
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
    const { id, saved } = createWorkoutLocalFirst(
      stripUndefined(newCardioSession(kind, place === "indoor", { userId: dataUserId, weightUnit: unit, now: new Date() }))
    );
    // Straight onto the clock, with this picker gone from the stack behind it.
    router.replace(`/workout/${id}`);
    saved.catch(() => Alert.alert("Couldn't start", "Check your connection and try again."));
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
