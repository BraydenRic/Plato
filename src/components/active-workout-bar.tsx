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
import { useActiveWorkout, useOtherLiveWorkouts } from "@/hooks/use-active-workout";
import { isPaused, kindInfo, movingSeconds } from "@/lib/cardio-session";
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
  const others = useOtherLiveWorkouts(workout?.id ?? null);

  if (!workout) return <View style={[styles.idle, { height: insets.top }]} />;
  return <ResumeBar workouts={[workout, ...others]} topInset={insets.top} />;
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
 *
 * With more than one workout running, the newest leads and a plain count with
 * a chevron at the end opens the rest as more rows of the same card. Tapping
 * the lead row still goes straight to the newest, so the common case costs
 * nothing extra.
 */
function ResumeBar({ workouts, topInset }: { workouts: Workout[]; topInset: number }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const multiple = workouts.length > 1;

  // One clock drives every readout. A second interval for the countdown would
  // buy nothing: both are shown to the whole second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Down to one again (the other was finished or deleted): nothing to list.
  useEffect(() => {
    if (!multiple) setExpanded(false);
  }, [multiple]);

  function open(workout: Workout) {
    setExpanded(false);
    router.push(`/workout/${workout.id}`);
  }

  const [lead, ...rest] = workouts;
  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <View style={styles.card}>
        <View style={styles.row}>
          <BarRow
            workout={lead}
            now={now}
            onPress={() => open(lead)}
            testID="active-workout-bar"
            chevron={!multiple}
          />
          {multiple && (
            <Pressable
              onPress={() => setExpanded((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? "Hide the other workouts" : `${workouts.length} workouts running. Show them all.`
              }
              testID="active-workout-toggle"
              style={styles.toggle}>
              <View style={styles.divider} />
              <Text style={styles.count} maxFontSizeMultiplier={FontScaleCap.grid}>
                {workouts.length}
              </Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={palette.textTertiary} />
            </Pressable>
          )}
        </View>
        {expanded &&
          rest.map((workout) => (
            <View key={workout.id} style={[styles.row, styles.extraRow]}>
              <BarRow workout={workout} now={now} onPress={() => open(workout)} testID="active-workout-row" chevron />
            </View>
          ))}
      </View>
    </View>
  );
}

/** One workout's line: ring, name, set count and its clock (or its rest). */
function BarRow({
  workout,
  now,
  onPress,
  testID,
  chevron,
}: {
  workout: Workout;
  now: number;
  onPress: () => void;
  testID: string;
  /** Inside the press target, so the whole width opens the workout. */
  chevron?: boolean;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const { rest } = useRestTimer();

  const startedAtMs = workout.startedAt?.getTime();
  // A cardio session's clock is its moving time — the same number its own
  // screen shows, pauses left out.
  const session = workout.cardio;
  const elapsed = session
    ? movingSeconds(workout, now)
    : startedAtMs
      ? Math.max(0, Math.floor((now - startedAtMs) / 1000))
      : 0;

  // Rest outlives the workout screen, so it can still be running while you're
  // over here — and it's the one number worth interrupting the elapsed clock
  // for. Only this workout's, though: the deadline in the context belongs to
  // whichever session started it.
  const restEndsAt = rest?.workoutId === workout.id ? rest.endsAt : null;
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;
  const resting = restLeft > 0;

  const done = completedSetCount(workout);
  const total = totalSetCount(workout);
  // Same shorthand the Workouts list uses for an in-progress row. A session
  // has no sets to count; the only thing worth saying beside its name is
  // that it's paused.
  const meta = session ? (isPaused(workout) ? "Paused" : null) : total > 0 ? `${done}/${total} sets` : "No sets yet";
  // Past the largest standard text size there isn't room for the name, the
  // count and the clock on one 44pt line, and the name was what gave — "L…".
  // The ring already says how far through you are, so the count steps aside.
  const { fontScale } = useWindowDimensions();
  const roomyText = fontScale <= 1.36;

  return (
    // One line, not two. Stacking the name over the set count read better in
    // isolation and came to ~56pt before any margin — which is exactly the
    // height at which permanent chrome starts crowding the screen it is
    // supposed to be serving. One line keeps the card at 44pt.
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${meta ? `${meta}, ` : ""}${
        resting ? `resting, ${formatClock(restLeft)} left` : `${formatClock(elapsed)} elapsed`
      }. Back to workout.`}
      onPress={onPress}
      style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}>
      {session ? (
        // A run is no fraction of the way through anything; its icon says
        // what it is instead.
        <Ionicons name={kindInfo(session.kind).icon} size={18} color={theme.accent} />
      ) : (
        <ProgressRing progress={total > 0 ? done / total : 0} color={theme.accent} trackColor={palette.borderStrong} />
      )}
      <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={FontScaleCap.grid}>
        {workout.name}
      </Text>
      {/* Dim and small against the clock, so two numbers sharing a corner
          don't read as one. */}
      {roomyText && meta && (
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
          <Text style={[styles.readout, { color: theme.accentText }]} maxFontSizeMultiplier={FontScaleCap.grid}>
            {`Rest ${formatClock(restLeft)}`}
          </Text>
        </View>
      ) : (
        <Text style={styles.readout} maxFontSizeMultiplier={FontScaleCap.grid}>
          {formatClock(elapsed)}
        </Text>
      )}
      {chevron && <Ionicons name="chevron-forward" size={15} color={palette.textTertiary} />}
    </Pressable>
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  extraRow: {
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingLeft: 12,
    paddingRight: 10,
    // 11 + a 20pt ring + 11 + the 2pt border lands the card on 44pt, the height
    // of the nav bar it stands in for and the minimum comfortable tap target.
    paddingVertical: 11,
  },
  rowPressed: {
    backgroundColor: c.surfaceRaised,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    alignSelf: "stretch",
    paddingRight: 10,
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textTertiary,
    fontVariant: ["tabular-nums"],
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
