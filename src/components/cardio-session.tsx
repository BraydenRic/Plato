import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { FigureRow, SessionSpan, SessionTrend, SplitsChart, type Figure, type SplitRow } from "@/components/cardio-figures";
import { Button } from "@/components/ui";
import { FontScaleCap, Radius, Spacing } from "@/constants/theme";
import { makeStyles, usePalette } from "@/context/AppearanceContext";
import { useTheme } from "@/context/ThemeContext";
import { useWeightUnit } from "@/context/UnitContext";
import { canCount, measureOnPhone, usePhoneDistance, useStepsBefore } from "@/hooks/use-phone-distance";
import { useWorkouts } from "@/hooks/use-workouts";
import {
  distanceKind,
  distanceUnit,
  formatDistance,
  formatDistanceValue,
  formatRate,
  fromMetres,
  parseDistanceText,
  type DistanceUnit,
} from "@/lib/cardio";
import {
  finishedSession,
  isPaused,
  kindInfo,
  movingSeconds,
  movingSecondsUntil,
  paused,
  recentOfKind,
  resumed,
  sessionSet,
  sessionSpan,
  type SessionMeasure,
} from "@/lib/cardio-session";
import { recordCardioDiscard } from "@/lib/cardio-discards";
import { computeStats, deleteWorkout, getCompletedWorkouts, stripUndefined, updateWorkout, upsertUserStats } from "@/lib/data";
import { liveFor, useWatchLive } from "@/lib/watch-live";
import { useWatchStart } from "@/lib/watch-trace";
import { formatClock } from "@/lib/workout-utils";
import type { TrackedCardio, Workout } from "@/types";

/** What a unit is called above the box you type it into. */
const UNIT_NAME = { mi: "miles", km: "kilometers", m: "meters", yd: "yards" } as const;

/**
 * A cardio session's screen: a clock while it runs, and the run itself once
 * it's done — how far, how fast, and what the watch measured on the way.
 *
 * No exercises, no sets, no keypad. Distance comes from the watch when it's
 * tracking, or on foot from the iPhone's step counter; ending asks how far
 * you went, inline, only if neither could say. That's the only question it
 * ever asks, and it can be skipped.
 */
export function CardioSession({
  workout,
  onLocalChange,
}: {
  workout: Workout;
  /** Shows a change at once, ahead of the store's echo — as the workout screen does. */
  onLocalChange: (next: Workout) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const router = useRouter();
  const { unit } = useWeightUnit();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  // "end": ending, asking how far. "edit": correcting a finished one.
  const [askDistance, setAskDistance] = useState<"end" | "edit" | null>(null);
  const [distanceText, setDistanceText] = useState("");

  const set = sessionSet(workout);
  const exercise = workout.exercises[0]?.exercise;
  const ground = exercise ? distanceKind(exercise) : null;
  const groundUnit = ground ? distanceUnit(ground, unit) : null;
  const done = !!workout.completedAt;
  // Tracked on the watch: the clock, distance and heart rate come from there,
  // and pausing is done there, where the sensors are.
  const onWatch = !!workout.cardio?.watch;
  const live = liveFor(useWatchLive(), workout, nowMs);
  const isPausedNow = live ? live.paused : isPaused(workout);
  // With no watch tracking it, a session on foot is measured by the phone's
  // step counter — the screen needn't be on for that, only for the figure.
  const phoneMetres = usePhoneDistance(workout, !done && !onWatch);
  // A watch that took over a session already running here: the phone's
  // stretch before it — its time, and on foot its steps — comes first.
  const leadSeconds = live ? movingSecondsUntil(workout, live.startedAt) : 0;
  const leadMetres = useStepsBefore(workout, !done && live && leadSeconds > 0 ? live.startedAt : null);

  useEffect(() => {
    // Ticks while paused too when the watch is tracking: it's how a stale
    // reading is noticed and the phone's own clock takes back over.
    if (done || (isPausedNow && !onWatch)) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done, isPausedNow, onWatch]);

  // The watch's own time, carried on from its reading to now.
  const watchSeconds = live ? live.elapsed + (live.paused ? 0 : Math.max(0, nowMs - live.at) / 1000) : 0;
  const seconds = done ? (set?.duration ?? 0) : live ? Math.floor(leadSeconds + watchSeconds) : movingSeconds(workout, nowMs);

  async function write(patch: Partial<Workout>) {
    onLocalChange({ ...workout, ...patch });
    await updateWorkout(workout.id, stripUndefined(patch) as Partial<Workout>);
  }

  function togglePause() {
    const now = Date.now();
    setNowMs(now);
    write({ cardio: isPausedNow ? resumed(workout, now) : paused(workout, now) }).catch(() =>
      Alert.alert("Couldn't save", "Check your connection and try again.")
    );
  }

  async function finish(distance?: number, tracked?: TrackedCardio, nowMs = Date.now()) {
    setSaving(true);
    try {
      await write(finishedSession(workout, { distance, tracked, nowMs }));
      // As finishing any workout does: the streak and plato-web's totals.
      const all = await getCompletedWorkouts(workout.userId);
      await upsertUserStats({ userId: workout.userId, ...computeStats(all) });
      setAskDistance(null);
    } catch {
      Alert.alert("Couldn't save", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEditedDistance() {
    if (!set || !groundUnit) return;
    const distance = parseDistanceText(distanceText, groundUnit);
    setSaving(true);
    try {
      await write({
        exercises: workout.exercises.map((ex, i) =>
          i !== 0 ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== 0 ? s : { ...s, distance })) }
        ),
      });
      setAskDistance(null);
    } catch {
      Alert.alert("Couldn't save", "Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function end() {
    // Nothing to ask on a stair stepper: there's no distance to give. Nor when
    // the watch is tracking: it measured how far, and sends it when it hears
    // the session ended.
    if (!groundUnit || onWatch) {
      void finish();
      return;
    }
    // On foot, the step counter knows how far — build 67 asked anyway. Its
    // minute-by-minute counts up to this moment give the splits too. Tried
    // whenever it could count, not only when the live figure is showing: a
    // live count that hiccuped says nothing about the session's minutes.
    if (canCount(workout)) {
      const nowMs = Date.now();
      setSaving(true);
      const measured = await measureOnPhone(workout, nowMs);
      if (measured) {
        await finish(measured.distance, measured.tracked, nowMs);
        return;
      }
      setSaving(false);
    }
    setDistanceText("");
    setAskDistance("end");
  }

  function editDistance() {
    if (!groundUnit) return;
    setDistanceText(set?.distance ? formatDistanceValue(set.distance, groundUnit) : "");
    setAskDistance("edit");
  }

  function openMenu() {
    const noun = workout.name.toLowerCase();
    Alert.alert(workout.name, undefined, [
      { text: "Cancel", style: "cancel" },
      ...(done && groundUnit ? [{ text: set?.distance ? "Edit distance" : "Add distance", onPress: editDistance }] : []),
      {
        text: done ? `Delete ${noun}` : `Discard ${noun}`,
        style: "destructive" as const,
        onPress: () =>
          Alert.alert(done ? `Delete this ${noun}?` : `Discard this ${noun}?`, "It can't be brought back.", [
            { text: "Cancel", style: "cancel" },
            {
              text: done ? "Delete" : "Discard",
              style: "destructive",
              onPress: () => {
                router.back();
                // A watch still tracking it stops, and keeps nothing.
                recordCardioDiscard(workout);
                deleteWorkout(workout).catch(() => Alert.alert("Couldn't delete", "Check your connection and try again."));
              },
            },
          ]),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={26} color={palette.textSecondary} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text
              style={[styles.topLabel, { color: done ? palette.success : theme.accentText }]}
              maxFontSizeMultiplier={FontScaleCap.title}>
              {done ? "Completed" : workout.name}
            </Text>
          </View>
          <Pressable onPress={openMenu} hitSlop={12} testID="session-menu" accessibilityLabel="More">
            <Ionicons name="ellipsis-horizontal" size={24} color={palette.textSecondary} />
          </Pressable>
        </View>

        {askDistance ? (
          <DistancePanel
            title={askDistance === "end" ? "How far did you go?" : "How far was it?"}
            unitName={UNIT_NAME[groundUnit!]}
            decimal={groundUnit === "mi" || groundUnit === "km"}
            value={distanceText}
            onChange={setDistanceText}
            saving={saving}
            primary={askDistance === "end" ? `Save ${workout.name.toLowerCase()}` : "Save"}
            onPrimary={() =>
              askDistance === "end" ? finish(parseDistanceText(distanceText, groundUnit!)) : saveEditedDistance()
            }
            secondary={askDistance === "end" ? "Skip" : "Cancel"}
            onSecondary={() => (askDistance === "end" ? finish() : setAskDistance(null))}
          />
        ) : done ? (
          <FinishedSession workout={workout} onAddDistance={editDistance} />
        ) : (
          <View style={styles.live}>
            <View style={styles.clockWrap}>
              {/* An hour in, "1:00:00" at this size is wider than a 320-point
                  iPhone SE: it shrinks to fit rather than break the line. */}
              <Text
                style={[styles.clock, isPausedNow && { color: palette.textTertiary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={FontScaleCap.title}
                accessibilityLabel={`${isPausedNow ? "Paused at" : "Moving time"} ${formatClock(seconds)}`}>
                {formatClock(seconds)}
              </Text>
              <View style={styles.clockLabelRow}>
                <View
                  style={[styles.liveDot, { backgroundColor: isPausedNow ? palette.textTertiary : theme.accent }]}
                />
                <Text style={styles.clockLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
                  {isPausedNow ? "Paused" : "Moving time"}
                </Text>
              </View>
              {onWatch ? (
                <WatchFigures
                  workout={workout}
                  live={live}
                  watchSeconds={watchSeconds}
                  lead={leadMetres != null ? { metres: leadMetres, seconds: leadSeconds } : null}
                />
              ) : (
                <>
                  {/* No line saying the phone measures it: the distance appearing says so. */}
                  {phoneMetres != null && (
                    <LiveFigures workout={workout} distance={phoneMetres} seconds={seconds} heartRate={null} />
                  )}
                  <WatchStartLine sessionId={workout.id} nowMs={nowMs} />
                </>
              )}
            </View>

            {onWatch && (
              <Text style={styles.watchHint} maxFontSizeMultiplier={FontScaleCap.grid}>
                Pause on your watch
              </Text>
            )}
            <View style={styles.controls}>
              {!onWatch && (
              <Pressable
                onPress={togglePause}
                accessibilityRole="button"
                accessibilityLabel={isPausedNow ? "Resume" : "Pause"}
                style={({ pressed }) => [
                  styles.control,
                  { backgroundColor: palette.surfaceRaised, borderColor: palette.border },
                  pressed && { opacity: 0.8 },
                ]}>
                <Ionicons name={isPausedNow ? "play" : "pause"} size={22} color={palette.text} />
                <Text style={styles.controlText} maxFontSizeMultiplier={FontScaleCap.keypad}>
                  {isPausedNow ? "Resume" : "Pause"}
                </Text>
              </Pressable>
              )}
              <Pressable
                onPress={end}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="End"
                style={({ pressed }) => [
                  styles.control,
                  { backgroundColor: theme.accent, borderColor: theme.accent },
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons name="stop" size={20} color={theme.onAccent} />
                <Text style={[styles.controlText, { color: theme.onAccent }]} maxFontSizeMultiplier={FontScaleCap.keypad}>
                  {/* Reading back a long run's minutes takes a moment. */}
                  {saving ? "Saving…" : "End"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * What the watch is measuring, under the clock on the phone: how far, how
 * fast on average, and the heart rate right now. Until its first reading
 * arrives, a line saying the watch has it.
 *
 * `lead` is the phone's stretch before the watch took over, when the step
 * counter could say how far it went: then distance and pace cover the whole
 * session. Without it, both are the watch's alone, so pace stays honest.
 */
function WatchFigures({
  workout,
  live,
  watchSeconds,
  lead,
}: {
  workout: Workout;
  live: ReturnType<typeof liveFor>;
  watchSeconds: number;
  lead: { metres: number; seconds: number } | null;
}) {
  const distance = live?.distance != null ? live.distance + (lead?.metres ?? 0) : null;
  return (
    <LiveFigures
      workout={workout}
      distance={distance}
      seconds={watchSeconds + (lead?.seconds ?? 0)}
      heartRate={live?.heartRate ?? null}>
      <StatusLine icon="watch-outline" text={live ? "Tracking on your Apple Watch" : "Your Apple Watch is tracking this"} />
    </LiveFigures>
  );
}

/** How often the average pace moves while a session runs. */
const PACE_EVERY_MS = 5_000;

/**
 * `value` as of the last tick every `ms`, rather than every render. For a
 * figure worked out from two that move at different times — distance in
 * jumps, the clock every second — which would otherwise twitch each second.
 * The first value shows at once; after that it waits for the tick.
 */
function useEvery<T>(value: T | null, ms: number): T | null {
  const [shown, setShown] = useState<T | null>(value);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  useEffect(() => {
    if (shown == null && value != null) setShown(value);
  }, [shown, value]);
  useEffect(() => {
    const tick = setInterval(() => setShown(latest.current), ms);
    return () => clearInterval(tick);
  }, [ms]);
  return shown;
}

/** How far, how fast on average, and the heart rate if anything's reading it — then what's measuring, if anything needs saying. */
function LiveFigures({
  workout,
  distance,
  seconds,
  heartRate,
  children,
}: {
  workout: Workout;
  distance: number | null;
  seconds: number;
  heartRate: number | null;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const { unit } = useWeightUnit();
  const exercise = workout.exercises[0]?.exercise;
  const ground = exercise ? distanceKind(exercise) : null;
  const groundUnit = ground ? distanceUnit(ground, unit) : null;

  // Average pace every few seconds: worked out every second, it twitched.
  const rate = useEvery(ground && distance != null ? formatRate(distance, seconds, ground, unit) : null, PACE_EVERY_MS);

  const figures: Figure[] = [];
  if (ground && groundUnit && distance != null) {
    const shown = formatDistance(distance, groundUnit);
    figures.push({
      key: "distance",
      value: shown.split(" ")[0],
      unit: shown.split(" ")[1],
      label: "Distance",
      icon: "navigate",
      tint: theme.accent,
    });
    if (rate) {
      const { value, unit: per } = splitRate(rate);
      figures.push({ key: "rate", value, unit: per, label: ground === "ride" ? "Avg speed" : "Avg pace", icon: "speedometer-outline", tint: theme.accent });
    }
  }
  if (heartRate) {
    figures.push({ key: "hr", value: String(Math.round(heartRate)), unit: "bpm", label: "Heart rate", icon: "heart", tint: palette.danger });
  }

  return (
    <View style={styles.watchFigures}>
      {figures.length > 0 ? <FigureRow figures={figures} /> : null}
      {children}
    </View>
  );
}

/** One quiet line saying what's measuring the session. */
function StatusLine({ icon, text }: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.watchStatus}>
      <Ionicons name={icon} size={14} color={palette.textTertiary} />
      <Text style={styles.watchStatusText} maxFontSizeMultiplier={FontScaleCap.grid}>
        {text}
      </Text>
    </View>
  );
}

/** How long a woken watch gets to say it's tracking before the line says it hasn't. */
const WATCH_START_PATIENCE_MS = 45_000;

/**
 * While the phone waits for the watch to take over: what's happening, in one
 * quiet line under the clock. If the watch hasn't started after a while it
 * says so, rather than leaving the session to run on the phone without a
 * word — someone expecting heart rate and splits finds out now, not at the end.
 */
function WatchStartLine({ sessionId, nowMs }: { sessionId: string; nowMs: number }) {
  const styles = useStyles();
  const palette = usePalette();
  const start = useWatchStart(sessionId);
  if (!start) return null;
  const text =
    start.state === "failed"
      ? start.reason
      : start.state === "waking"
        ? "Waking your watch…"
        : nowMs - start.at < WATCH_START_PATIENCE_MS
          ? "Starting on your watch…"
          : "Your watch hasn't started tracking, so your iPhone is timing this.";
  return (
    <View style={[styles.watchStatus, styles.watchStartLine]}>
      <Ionicons name="watch-outline" size={14} color={palette.textTertiary} />
      <Text style={[styles.watchStatusText, styles.watchStartText]} maxFontSizeMultiplier={FontScaleCap.grid}>
        {text}
      </Text>
    </View>
  );
}

function DistancePanel({
  title,
  unitName,
  decimal,
  value,
  onChange,
  saving,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: {
  title: string;
  unitName: string;
  decimal: boolean;
  value: string;
  onChange: (text: string) => void;
  saving: boolean;
  primary: string;
  onPrimary: () => void;
  secondary: string;
  onSecondary: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle} maxFontSizeMultiplier={FontScaleCap.title}>
        {title}
      </Text>
      <View style={styles.distanceField}>
        <TextInput
          style={styles.distanceInput}
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          placeholder={decimal ? "0.00" : "0"}
          placeholderTextColor={palette.textTertiary}
          autoFocus
          maxFontSizeMultiplier={FontScaleCap.title}
          accessibilityLabel={`Distance in ${unitName}`}
        />
        <Text style={styles.distanceUnit} maxFontSizeMultiplier={FontScaleCap.title}>
          {unitName}
        </Text>
      </View>
      <View style={styles.panelActions}>
        <Button title={primary} onPress={onPrimary} loading={saving} />
        <Pressable onPress={onSecondary} disabled={saving} hitSlop={8} style={styles.panelSecondary}>
          <Text style={styles.panelSecondaryText}>{secondary}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** "8:28 /mi" → the number and its unit, for two sizes of type. */
function splitRate(rate: string): { value: string; unit: string } {
  const space = rate.indexOf(" ");
  return space < 0 ? { value: rate, unit: "" } : { value: rate.slice(0, space), unit: rate.slice(space + 1) };
}

/**
 * A finished session. The distance is the headline, with the time and pace
 * beneath it — or with no distance, the time is. Then the session from start
 * to end, what the watch measured if it was there, the splits, and how this
 * one sits among the last few of its kind.
 *
 * Built so that the least a session can have — a time and nothing else —
 * still reads as a whole page rather than a number in a corner.
 */
function FinishedSession({ workout, onAddDistance }: { workout: Workout; onAddDistance: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const theme = useTheme();
  const { unit } = useWeightUnit();
  const { completed } = useWorkouts();
  const set = sessionSet(workout);
  const exercise = workout.exercises[0]?.exercise;
  const ground = exercise ? distanceKind(exercise) : null;
  const groundUnit = ground ? distanceUnit(ground, unit) : null;
  const tracked = set?.tracked;
  const seconds = set?.duration ?? 0;
  const rate = ground ? formatRate(set?.distance, seconds, ground, unit) : null;
  const distance = set?.distance && groundUnit ? formatDistance(set.distance, groundUnit) : null;
  const when = workout.startedAt ?? workout.completedAt!;
  const span = sessionSpan(workout);
  // Ended on the phone while the watch tracked it: its distance follows in a
  // moment, and anything typed now would be overwritten. The menu still has
  // Add distance if it never comes.
  const awaitingWatch = !!workout.cardio?.watch && !tracked;
  const recent = recentOfKind(completed, workout);
  const noun = kindInfo(workout.cardio?.kind ?? "run").noun;

  const figures: Figure[] = [];
  if (tracked?.avgHeartRate) {
    figures.push({
      key: "hr",
      value: String(tracked.avgHeartRate),
      unit: "bpm",
      label: tracked.maxHeartRate ? `Avg · max ${tracked.maxHeartRate}` : "Avg heart rate",
      icon: "heart",
      tint: palette.danger,
    });
  }
  if (tracked?.activeCalories) {
    figures.push({
      key: "cal",
      value: String(tracked.activeCalories),
      unit: "cal",
      label: "Active",
      icon: "flame",
      tint: palette.amber,
    });
  }

  const whole = groundUnit === "mi" ? tracked?.splitsMi : groundUnit === "km" ? tracked?.splitsKm : undefined;
  const rows: SplitRow[] = (whole ?? []).map((s, i) => ({ label: String(i + 1), seconds: s, units: 1 }));
  // The part past the last whole mile, so the splits add up to the run.
  if (whole && groundUnit && set?.distance && seconds) {
    const leftUnits = fromMetres(set.distance, groundUnit) - whole.length;
    const leftSeconds = seconds - whole.reduce((sum, s) => sum + s, 0);
    if (leftUnits >= 0.05 && leftSeconds > 0) rows.push({ label: leftUnits.toFixed(2), seconds: leftSeconds, units: leftUnits });
  }

  return (
    <ScrollView contentContainerStyle={styles.finished}>
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={FontScaleCap.title}>
          {workout.name}
        </Text>
        <Text style={styles.when}>
          {when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          {/* The span below gives the times when it can. */}
          {span ? "" : ` · ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
          {tracked?.source ? ` · ${tracked.source}` : ""}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={FontScaleCap.title}>
          {distance ? distance.split(" ")[0] : formatClock(seconds)}
          {distance ? (
            <Text style={styles.heroUnit} maxFontSizeMultiplier={FontScaleCap.title}>
              {" "}
              {distance.split(" ")[1]}
            </Text>
          ) : null}
        </Text>
        {distance ? (
          <View style={styles.heroMeta}>
            <Ionicons name="stopwatch-outline" size={14} color={palette.textTertiary} />
            <Text style={styles.heroMetaText} maxFontSizeMultiplier={FontScaleCap.title}>
              {formatClock(seconds)}
            </Text>
            {rate && (
              <>
                <Ionicons name="speedometer-outline" size={14} color={theme.accent} style={{ marginLeft: Spacing.two }} />
                <Text style={styles.heroMetaText} maxFontSizeMultiplier={FontScaleCap.title}>
                  {splitRate(rate).value}
                  <Text style={styles.heroMetaUnit}> {splitRate(rate).unit}</Text>
                </Text>
              </>
            )}
          </View>
        ) : (
          <Text style={styles.clockLabel} maxFontSizeMultiplier={FontScaleCap.grid}>
            Moving time
          </Text>
        )}
        {/* Right where the distance would be, not behind the menu: the one
            thing missing, and the one that makes pace and splits possible. */}
        {!distance && groundUnit && awaitingWatch && (
          <View style={styles.awaitingWatch}>
            <StatusLine icon="watch-outline" text="Your watch is sending the distance" />
          </View>
        )}
        {!distance && groundUnit && !awaitingWatch && (
          <Pressable
            onPress={onAddDistance}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addDistance, pressed && { opacity: 0.7 }]}>
            <Ionicons name="add" size={16} color={theme.accentText} />
            <Text style={[styles.addDistanceText, { color: theme.accentText }]} maxFontSizeMultiplier={FontScaleCap.grid}>
              Add distance
            </Text>
          </Pressable>
        )}
      </View>

      {(span || figures.length > 0) && (
        <View style={styles.detailCard}>
          {span && <SessionSpan {...span} />}
          {figures.length > 0 && <FigureRow figures={figures} />}
        </View>
      )}

      {rows.length > 1 && groundUnit && (
        <View style={styles.detailCard}>
          <SplitsChart rows={rows} unitWord={groundUnit === "mi" ? "mile" : "km"} />
        </View>
      )}

      {recent && (
        <View
          style={styles.detailCard}
          accessible
          accessibilityLabel={`Your last ${recent.values.length} ${noun.many}. ${comparison(recent.values, recent.measure, groundUnit, noun.one)}`}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
              Your last {recent.values.length} {noun.many}
            </Text>
            <Text style={styles.cardHeading} maxFontSizeMultiplier={FontScaleCap.grid}>
              {recent.measure === "distance" ? "Distance" : "Moving time"}
            </Text>
          </View>
          <SessionTrend values={recent.values} />
          <Text style={styles.trendNote} maxFontSizeMultiplier={FontScaleCap.grid}>
            {comparison(recent.values, recent.measure, groundUnit, noun.one)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/**
 * The trend in words: this session against the one before it, or — when it
 * beats all the others drawn — that. Under the line rather than as labels on
 * it, so the chart stays a shape.
 */
export function comparison(values: number[], measure: SessionMeasure, unit: DistanceUnit | null, one: string): string {
  const last = values[values.length - 1];
  const before = values[values.length - 2];
  if (values.length >= 3 && last >= Math.max(...values)) {
    return measure === "distance" ? `Your furthest of the last ${values.length}` : `Your longest of the last ${values.length}`;
  }
  const diff = last - before;
  if (measure === "distance" && unit) {
    const shown = formatDistance(Math.abs(diff), unit);
    if (parseFloat(shown) === 0) return `The same distance as your last ${one}`;
    return `${shown} ${diff > 0 ? "further than" : "short of"} your last ${one}`;
  }
  if (Math.abs(diff) < 30) return `About as long as your last ${one}`;
  return `${formatClock(Math.round(Math.abs(diff)))} ${diff > 0 ? "longer than" : "shorter than"} your last ${one}`;
}

const useStyles = makeStyles((c) => ({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  topLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  live: {
    flex: 1,
    justifyContent: "space-between",
    padding: Spacing.three,
    paddingBottom: Spacing.four,
  },
  clockWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  // The clock is the screen. Glanced at mid-run, it has to read from arm's
  // length, so it's as big as the narrowest phone allows for "1:00:00".
  clock: {
    fontSize: 84,
    fontWeight: "800",
    letterSpacing: -3,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  clockLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  clockLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  controls: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  watchFigures: {
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  watchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  watchStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: c.textTertiary,
  },
  watchStartLine: {
    marginTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  watchStartText: {
    flexShrink: 1,
    textAlign: "center",
  },
  watchHint: {
    fontSize: 12,
    color: c.textTertiary,
    textAlign: "center",
    marginBottom: Spacing.two,
  },
  // Big enough to hit without looking, mid-stride.
  control: {
    flex: 1,
    height: 64,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  controlText: {
    fontSize: 18,
    fontWeight: "700",
    color: c.text,
  },
  panel: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.four,
    justifyContent: "center",
  },
  panelTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: c.text,
    textAlign: "center",
  },
  distanceField: {
    alignItems: "center",
    gap: 2,
  },
  distanceInput: {
    minWidth: 160,
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2,
    color: c.text,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
  distanceUnit: {
    fontSize: 15,
    fontWeight: "600",
    color: c.textTertiary,
  },
  panelActions: {
    gap: Spacing.two,
  },
  panelSecondary: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  panelSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: c.textSecondary,
  },
  finished: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  when: {
    fontSize: 13,
    color: c.textTertiary,
  },
  hero: {
    gap: Spacing.one,
  },
  heroValue: {
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0,
    color: c.textTertiary,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroMetaText: {
    fontSize: 17,
    fontWeight: "700",
    color: c.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  heroMetaUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: c.textTertiary,
  },
  awaitingWatch: {
    alignSelf: "flex-start",
    marginTop: Spacing.two,
  },
  addDistance: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.border,
  },
  addDistanceText: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: c.textTertiary,
  },
  trendNote: {
    fontSize: 14,
    fontWeight: "600",
    color: c.textSecondary,
  },
  detailCard: {
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
}));
