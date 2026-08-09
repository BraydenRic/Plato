import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { FontScaleCap, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useRestTimer } from "@/context/RestTimerContext";
import { useTheme } from "@/context/ThemeContext";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import { completedSetCount, formatClock, totalSetCount } from "@/lib/workout-utils";
import type { Workout } from "@/types";

/**
 * The strip above the tabs: a way back to the workout that is still running,
 * and otherwise just the status-bar inset the four tab screens handed up (see
 * the note in the tabs layout).
 *
 * The workout subscription and the ticking clock both live down here rather
 * than in the layout, so a set logged on the workout screen re-renders this
 * strip alone instead of the whole tab navigator underneath it.
 */
export function ActiveWorkoutBar() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const workout = useActiveWorkout();

  if (!workout) return <View style={[styles.idle, { height: insets.top }]} />;
  return <ResumeBar workout={workout} topInset={insets.top} />;
}

/**
 * Deliberately not a badge or a pill: it is chrome, so it reads as part of the
 * frame rather than as a notification sitting on top of one. The accent rule
 * down its left edge is what marks it as the live session — a word saying so
 * would only restate what the ticking clock beside it already proves.
 *
 * Paints into the status bar area rather than sitting below a SafeAreaView,
 * because the bar and the notch above it should read as one surface.
 */
function ResumeBar({ workout, topInset }: { workout: Workout; topInset: number }) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const router = useRouter();
  const { rest } = useRestTimer();

  // One clock drives both readouts. A second interval for the countdown would
  // buy nothing: both are shown to the whole second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startedAtMs = workout.startedAt?.getTime();
  const elapsed = startedAtMs ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;

  // Rest outlives the workout screen, so it can still be running while you're
  // over here — and it's the one number worth interrupting the elapsed clock
  // for. Only this workout's, though: the deadline in the context belongs to
  // whichever session started it.
  const restEndsAt = rest?.workoutId === workout.id ? rest.endsAt : null;
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const resting = restLeft > 0;

  const done = completedSetCount(workout);
  const total = totalSetCount(workout);
  // Same shorthand the Workouts list uses for an in-progress row.
  const meta = total > 0 ? `${done}/${total} sets` : "No sets yet";
  const readout = resting ? `Rest ${formatClock(restLeft)}` : formatClock(elapsed);

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      {/*
        One line, not two. Stacking the name over the set count read better in
        isolation and came to ~56pt — taller than the nav bar it sits where, and
        than the tab bar opposite it — which is exactly the height at which
        permanent chrome starts crowding the screen it is supposed to be serving.
        At 44pt it costs a row of the list underneath and nothing more.
      */}
      <Pressable
        testID="active-workout-bar"
        accessibilityRole="button"
        accessibilityLabel={`${workout.name}, ${meta}, ${
          resting ? `resting, ${formatClock(restLeft)} left` : `${formatClock(elapsed)} elapsed`
        }. Back to workout.`}
        onPress={() => router.push(`/workout/${workout.id}`)}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.7 }]}>
        <View style={[styles.rule, { backgroundColor: theme.accent }]} />
        <Text style={styles.name} numberOfLines={1}>
          {workout.name}
        </Text>
        {/* Dim and small against the bright tabular clock beside it, so two
            numbers sharing a corner don't read as one. */}
        <Text
          style={styles.meta}
          numberOfLines={1}
          maxFontSizeMultiplier={FontScaleCap.grid}>
          {meta}
        </Text>
        <Text
          style={[styles.readout, { color: theme.accentText }]}
          maxFontSizeMultiplier={FontScaleCap.grid}>
          {readout}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
      </Pressable>
      {/* Set progress as a scrubber along the bottom edge — legible from across
          the gym in a way the count beside it isn't, and it doubles as the
          bar's boundary so nothing is spent on a divider. */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${total > 0 ? (done / total) * 100 : 0}%`, backgroundColor: theme.accent },
          ]}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  idle: {
    backgroundColor: c.bg,
  },
  wrap: {
    backgroundColor: c.surface,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    // 12 + a 15pt line + 12 + the 2pt track lands the strip on 44pt, the height
    // of the nav bar it stands in for.
    paddingVertical: 12,
  },
  rule: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: c.text,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 12,
    color: c.textTertiary,
  },
  readout: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 2,
    backgroundColor: c.surfaceRaised,
  },
  fill: {
    height: 2,
  },
}));
