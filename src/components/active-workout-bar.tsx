import { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";

import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
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
 * A card, not a strip. The first version was a full-bleed surface band that
 * painted up through the status bar, with an accent rule down its left edge and
 * a hairline progress track along its bottom — three separate devices, and the
 * grey band made the top of every tab look like it had a slab glued to it. This
 * speaks the same language as everything below it instead: a bordered, rounded
 * surface floating on the page, so it reads as the first card on the screen
 * rather than as foreign chrome.
 *
 * Still deliberately not a badge or a pill, and still no word saying "live" —
 * the ticking clock proves that. What was three devices is now one: the ring
 * carries the set progress the track and the rule used to split between them.
 *
 * The accent is spent on one thing. The elapsed clock is plain text, and only
 * a running rest turns it accent — so colour on this card means "something is
 * counting down for you", rather than being the permanent state it was when
 * the clock was always tinted and therefore said nothing.
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
  // Past the largest standard text size there isn't room for the name, the
  // count and the clock on one 44pt line, and the name was what gave — "L…".
  // The ring already says how far through you are, so the count steps aside.
  const { fontScale } = useWindowDimensions();
  const roomyText = fontScale <= 1.36;

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      {/*
        One line, not two. Stacking the name over the set count read better in
        isolation and came to ~56pt before any margin — which is exactly the
        height at which permanent chrome starts crowding the screen it is
        supposed to be serving. One line keeps the card at 44pt.
      */}
      <Pressable
        testID="active-workout-bar"
        accessibilityRole="button"
        accessibilityLabel={`${workout.name}, ${meta}, ${
          resting ? `resting, ${formatClock(restLeft)} left` : `${formatClock(elapsed)} elapsed`
        }. Back to workout.`}
        onPress={() => router.push(`/workout/${workout.id}`)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <ProgressRing
          progress={total > 0 ? done / total : 0}
          color={theme.accent}
          trackColor={palette.borderStrong}
        />
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={FontScaleCap.grid}>
          {workout.name}
        </Text>
        {/* Dim and small against the clock, so two numbers sharing a corner
            don't read as one. */}
        {roomyText && (
          <>
            <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={FontScaleCap.grid}>
              {meta}
            </Text>
            <View style={styles.divider} />
          </>
        )}
        {resting ? (
          <View style={styles.readoutRow}>
            <Ionicons name="timer-outline" size={14} color={theme.accentText} />
            <Text
              style={[styles.readout, { color: theme.accentText }]}
              maxFontSizeMultiplier={FontScaleCap.grid}>
              {`Rest ${formatClock(restLeft)}`}
            </Text>
          </View>
        ) : (
          <Text style={styles.readout} maxFontSizeMultiplier={FontScaleCap.grid}>
            {formatClock(elapsed)}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={15} color={palette.textTertiary} />
      </Pressable>
    </View>
  );
}

const RING_SIZE = 20;
const RING_STROKE = 2.5;

/**
 * Sets done as a ring rather than a bar: it fits in the height of the text it
 * sits beside, so the progress costs no row of its own, and it is legible at a
 * glance from across the gym in a way the count beside it isn't.
 */
function ProgressRing({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor: string;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const center = RING_SIZE / 2;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} testID="active-workout-ring">
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={RING_STROKE} fill="none" />
      {/* Skipped at zero rather than drawn with no length: a round cap on an
          empty arc still paints a dot, which reads as one set done. */}
      {clamped > 0 && (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          // Start at twelve o'clock, the way every progress ring on the phone does.
          transform={`rotate(-90 ${center} ${center})`}
        />
      )}
    </Svg>
  );
}

const useStyles = makeStyles((c) => ({
  idle: {
    backgroundColor: c.bg,
  },
  wrap: {
    // The page colour, not a surface: the status bar area belongs to the page,
    // and the card is what marks the session — not a band behind the clock.
    backgroundColor: c.bg,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingLeft: 12,
    paddingRight: 10,
    // 11 + a 20pt ring + 11 + the 2pt border lands the card on 44pt, the height
    // of the nav bar it stands in for and the minimum comfortable tap target.
    paddingVertical: 11,
  },
  cardPressed: {
    backgroundColor: c.surfaceRaised,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: c.text,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 13,
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: c.border,
  },
  readoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  readout: {
    fontSize: 15,
    fontWeight: "600",
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
}));
