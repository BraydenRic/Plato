import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

import PlatoWatch, { type InboxEntry } from "../../modules/plato-watch";
import { THEMES } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useRestTimer, type RunningRest } from "@/context/RestTimerContext";
import { useSetTimer, type RunningSetTimer } from "@/context/SetTimerContext";
import { useThemePicker } from "@/context/ThemeContext";
import { useWeightUnit, type WeightUnit } from "@/context/UnitContext";
import { useWorkouts } from "@/hooks/use-workouts";
import { readCachedBodyweight } from "@/lib/bodyweight-cache";
import { markCurrentWorkout, useCurrentWorkoutId } from "@/lib/current-workout";
import {
  awaitingFirstSync,
  computeStats,
  createWorkoutLocalFirst,
  getBodyweightLog,
  getCompletedWorkouts,
  getWorkout,
  startFromTemplate,
  stripUndefined,
  updateWorkout,
  upsertUserStats,
} from "@/lib/data";
import { isGuestUserId } from "@/lib/local-store";
import {
  applySetOp,
  bankRunningTimer,
  buildWatchSnapshot,
  endedCardio,
  finishedFields,
  opTime,
  parseWatchLive,
  parseWatchOp,
  SNAPSHOT_APPLIED_LIMIT,
  type WatchCardioOp,
  type WatchOp,
} from "@/lib/watch-protocol";
import { distanceKind } from "@/lib/cardio";
import { newCardioSession, paused, resumed, sessionTarget } from "@/lib/cardio-session";
import { curveFromFlat, trackedFromWatch } from "@/lib/cardio-tracking";
import { setWatchLive } from "@/lib/watch-live";
import { cardioDiscards, isDiscarded, loadCardioDiscards, useCardioDiscards } from "@/lib/cardio-discards";
import {
  MAX_ACTIVE_WORKOUTS,
  bodyweightOn,
  isActiveWorkout,
  leadWorkout,
  workoutDay,
  workoutVolumeLbs,
} from "@/lib/workout-utils";
import type { BodyweightEntry, Workout } from "@/types";

/** Op ids already applied, so one the watch resends is never applied twice. */
export const APPLIED_KEY = "plato.watch.applied.v1";
/** When each set was last changed from the watch — see WatchSyncContext.setStamps. */
export const STAMPS_KEY = "plato.watch.setStamps.v1";
const APPLIED_LIMIT = SNAPSHOT_APPLIED_LIMIT;
const STAMPS_LIMIT = 500;
/** Coalesces a burst of changes (a set, then its rest) into one send. */
const PUSH_DELAY_MS = 250;
/**
 * A start that reaches the phone later than this is dropped. Starting is the
 * one op that shouldn't happen late: a workout appearing an hour after you gave
 * up waiting for it is worse than one that never started.
 */
export const START_TTL_MS = 2 * 60 * 1000;
/** How long a finish waits on a cloud read of the weigh-ins before going without. */
const BODYWEIGHT_READ_MS = 3000;
/** How long an op that can't be applied yet waits before the next try. */
export const RETRY_MS = 5000;
/** An op that keeps throwing is given up on after this many tries. */
const MAX_ATTEMPTS = 3;

/**
 * Thrown for an op that can't be applied *yet* — its workout hasn't reached a
 * phone that has only just signed in. It stays in the inbox for a later try.
 */
export class NotYet extends Error {}

/** What op handlers read: the latest render's state, not the one they closed over. */
export type WatchSyncContext = {
  dataUserId: string | null;
  active: Workout[];
  /** Finished workouts — where a session the phone already ended is found. */
  completed: Workout[];
  templates: Workout[];
  unit: WeightUnit;
  restSeconds: number;
  rest: RunningRest | null;
  timer: RunningSetTimer | null;
  startRest: (workoutId: string, fromMs?: number) => void;
  extendRest: (ms: number) => void;
  endRest: () => void;
  clearTimer: () => void;
  /**
   * When each set was last changed from the watch, keyed workoutId:setId.
   *
   * The watch sends some ops as messages and, out of range, some through the
   * system's queue, and the two can arrive in either order. An edit that
   * arrives after a newer one for the same set is skipped instead of
   * overwriting it.
   */
  setStamps: Map<string, number>;
  saveStamps: () => void;
};

/**
 * Invisible component (mounted once in the root layout, beside
 * LiveActivitySync) that links the phone to the Apple Watch app.
 *
 * Out: a snapshot of the workout the resume bar leads with, the templates and
 * a few settings, sent whenever any of it changes. In: what the watch logged,
 * applied through data.ts like any edit made on the phone — so the offline
 * copy and the cloud outbox cover it, and the workout screen, the resume bar
 * and the Live Activity all just see a set being logged.
 *
 * Renders nothing and does nothing without the native module, which only
 * exists in an iOS build: Jest, web and Expo Go never get past this line.
 */
export function WatchSync() {
  return PlatoWatch ? <WatchSyncBridge /> : null;
}

function WatchSyncBridge() {
  const { dataUserId, loading: authLoading } = useAuth();
  const { active, templates, completed, loading } = useWorkouts();
  const currentId = useCurrentWorkoutId();
  const { unit, loaded: unitLoaded } = useWeightUnit();
  const { restSeconds, rest, startRest, extendRest, endRest, loaded: restLoaded } = useRestTimer();
  const { timer, clearTimer } = useSetTimer();
  const { themeId } = useThemePicker();
  // null until read from disk; nothing is sent or applied before then.
  const [applied, setApplied] = useState<string[] | null>(null);
  const appliedRef = useRef<string[]>([]);
  const stampsRef = useRef(new Map<string, number>());
  const latest = useRef<WatchSyncContext | null>(null);
  const lastSent = useRef<string | null>(null);
  const chain = useRef(Promise.resolve());
  // Re-renders when a session is discarded, so the watch hears at once.
  const discards = useCardioDiscards();
  useEffect(() => {
    void loadCardioDiscards();
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(APPLIED_KEY), AsyncStorage.getItem(STAMPS_KEY)])
      .then(([rawApplied, rawStamps]) => {
        appliedRef.current = readList(rawApplied).filter((id): id is string => typeof id === "string");
        stampsRef.current = new Map(
          readList(rawStamps).filter(
            (pair): pair is [string, number] =>
              Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "number"
          )
        );
      })
      .catch(() => {})
      .finally(() => setApplied(appliedRef.current));
  }, []);

  // Declared before the inbox effect so a drain started in the same commit
  // already reads this render.
  useEffect(() => {
    latest.current = {
      dataUserId,
      active,
      completed,
      templates,
      unit,
      restSeconds,
      rest,
      timer,
      startRest,
      extendRest,
      endRest,
      clearTimer,
      setStamps: stampsRef.current,
      saveStamps: () => {
        const stamps = stampsRef.current;
        // Oldest first (Map keeps insertion order); the edits worth guarding
        // against are minutes apart, not hundreds of sets.
        for (const key of stamps.keys()) {
          if (stamps.size <= STAMPS_LIMIT) break;
          stamps.delete(key);
        }
        AsyncStorage.setItem(STAMPS_KEY, JSON.stringify([...stamps])).catch(() => {});
      },
    };
  });

  // ── Out: the snapshot ──────────────────────────────────────────────────────
  // Not before sign-in, the workouts and the settings have all loaded. A
  // snapshot sent mid-launch would blank the watch for a moment, call a
  // running workout "none", or show it in the wrong unit — and on a background
  // launch (the watch woke the phone) that's exactly when this first runs.
  const ready = !authLoading && !loading && unitLoaded && restLoaded && applied !== null;
  const accentSet = THEMES[themeId].dark;
  const snapshotKey = ready
    ? snapshotKeyOrNull({
        signedIn: !!dataUserId,
        workout: leadWorkout(active, currentId),
        templates,
        completed,
        unit,
        restSeconds,
        rest,
        accent: accentSet.accent,
        onAccent: accentSet.onAccent,
        applied: applied ?? [],
        // Within the last six hours, give or take — exact enough for a list
        // that only has to outlast a watch out of range for a run.
        endedCardio: [
          ...endedCardio(completed, Math.floor(Date.now() / 600_000) * 600_000),
          ...(discards.length > 0 ? cardioDiscards() : []),
        ],
        // Stamped at send time; leaving it out here keeps the key stable
        // across renders that changed nothing.
        now: 0,
      })
    : null;

  useEffect(() => {
    if (snapshotKey == null || snapshotKey === lastSent.current) return;
    const send = setTimeout(() => {
      lastSent.current = snapshotKey;
      PlatoWatch?.updateContext(JSON.stringify({ ...JSON.parse(snapshotKey), sentAt: Date.now() }));
    }, PUSH_DELAY_MS);
    return () => clearTimeout(send);
  }, [snapshotKey]);

  // ── In: the watch's ops ────────────────────────────────────────────────────
  // Only with an account (or guest session) loaded. Ops that arrive before
  // that — the watch woke the phone, and sign-in is still restoring — wait in
  // the native inbox rather than being applied to nobody.
  const canApply = ready && !!dataUserId;

  useEffect(() => {
    const bridge = PlatoWatch;
    if (!canApply || !bridge) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const attempts = new Map<string, number>();

    async function remember(opId: string) {
      appliedRef.current = [...appliedRef.current, opId].slice(-APPLIED_LIMIT);
      setApplied(appliedRef.current);
      await AsyncStorage.setItem(APPLIED_KEY, JSON.stringify(appliedRef.current)).catch(() => {});
    }

    /** "later" leaves the op in the inbox and stops the drain there. */
    async function handle(entry: InboxEntry): Promise<"done" | "later"> {
      if (appliedRef.current.includes(entry.id)) {
        bridge!.ackInbox([entry.id]);
        return "done";
      }
      let op: WatchOp | null = null;
      try {
        op = parseWatchOp(JSON.parse(entry.json));
      } catch {
        op = null;
      }
      const ctx = latest.current;
      if (op && op.opId === entry.id && ctx) {
        if (op.kind === "startTemplate") {
          // Not loaded yet on a phone that has just signed in.
          if (!ctx.templates.some((t) => t.id === op.templateId) && awaitingFirstSync(ctx.dataUserId!)) {
            return "later";
          }
          // A start is the one op that isn't safe to repeat, so it's marked
          // before it runs: if the app dies halfway, it's lost rather than run
          // twice. Everything else is marked after, so it's retried instead.
          await remember(op.opId);
        }
        try {
          await applyWatchOp(op, ctx);
        } catch (e) {
          const tries = (attempts.get(entry.id) ?? 0) + 1;
          attempts.set(entry.id, tries);
          if (op.kind !== "startTemplate" && (e instanceof NotYet || tries < MAX_ATTEMPTS)) {
            if (!(e instanceof NotYet)) console.warn("Couldn't apply a change from the watch; will retry", e);
            return "later";
          }
          // Given up on: one that keeps throwing would block everything queued
          // behind it. Marking it applied lets the watch drop its copy and show
          // what the phone actually has.
          console.warn("Couldn't apply a change from the watch", e);
        }
      }
      if (op?.kind !== "startTemplate") await remember(entry.id);
      bridge!.ackInbox([entry.id]);
      return "done";
    }

    const drain = () => {
      chain.current = chain.current
        .then(async () => {
          for (const entry of bridge.takeInbox()) {
            if (cancelled) return;
            if ((await handle(entry)) === "later") {
              // Stop rather than skip: what comes after may build on this one,
              // like a set logged into a set the watch just added.
              clearTimeout(retry);
              retry = setTimeout(drain, RETRY_MS);
              return;
            }
          }
        })
        .catch((e) => console.warn("Watch sync failed", e));
    };

    const subscription = bridge.addListener("onInbox", drain);
    drain();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      subscription.remove();
    };
  }, [canApply]);

  // ── In: a tracked session's live numbers ───────────────────────────────────
  // Straight to the session screen. Not ops: nothing is written, and a reading
  // that's missed is replaced a few seconds later.
  useEffect(() => {
    const bridge = PlatoWatch;
    if (!bridge) return;
    const subscription = bridge.addListener("onLive", ({ json }) => {
      try {
        const live = parseWatchLive(JSON.parse(json));
        if (live) setWatchLive(live);
      } catch {
        // A garbled reading is skipped; the next one is seconds away.
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}

/**
 * The snapshot, as the string compared between renders — or null if it can't
 * be built. This runs at the root of the app for everyone, watch or not, so a
 * malformed workout must cost the watch one update, not crash the whole app.
 */
function snapshotKeyOrNull(input: Parameters<typeof buildWatchSnapshot>[0]): string | null {
  try {
    return JSON.stringify(buildWatchSnapshot(input));
  } catch (e) {
    console.warn("Couldn't build the watch snapshot", e);
    return null;
  }
}

function readList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Applies one op from the watch.
 *
 * Every op is checked against what the phone has now, not what the watch saw:
 * the workout might have been finished, a set deleted, or the account switched
 * since. Anything that no longer fits is skipped, and the next snapshot shows
 * the watch the phone's version.
 */
export async function applyWatchOp(op: WatchOp, ctx: WatchSyncContext): Promise<void> {
  const now = Date.now();
  const { dataUserId } = ctx;
  if (!dataUserId) return;

  switch (op.kind) {
    case "logSet":
    case "undoSet":
    case "addSet": {
      const workout = await getWorkout(op.workoutId);
      if (!workout) {
        // A phone that has only just signed in has no copy yet; the workout is
        // probably on its way down.
        if (awaitingFirstSync(dataUserId)) throw new NotYet();
        return;
      }
      if (workout.userId !== dataUserId || workout.isTemplate || !workout.startedAt) return;
      // Finished since? A set the watch logged *before* the finish still
      // belongs in it: the finish can overtake it on the way here.
      const finishedAt = workout.completedAt?.getTime();
      if (finishedAt != null && op.at > finishedAt) return;

      const stampKey = `${workout.id}:${op.setId}`;
      if (op.kind !== "addSet") {
        const stamp = ctx.setStamps.get(stampKey);
        if (stamp != null && stamp > op.at) return;
        // An edit made on the phone after this was logged on the watch wins too.
        const current = workout.exercises.find((e) => e.id === op.exerciseId)?.sets.find((s) => s.id === op.setId);
        if (op.kind === "logSet" && current?.completedAt && current.completedAt.getTime() > op.at) return;
      }

      const result = applySetOp(workout, op, { unit: ctx.unit, now });
      if (!result) return;
      const updates: Partial<Workout> = { exercises: result.exercises };
      if (finishedAt != null) {
        // A finished workout's volume is frozen at finish, so a set landing
        // late has to update it, and the lifetime stats with it.
        const log = await bodyweightLogFor(workout.userId);
        updates.totalVolume = workoutVolumeLbs(
          { ...workout, exercises: result.exercises },
          bodyweightOn(log, workoutDay(workout))?.lbs
        );
      }
      await updateWorkout(workout.id, stripUndefined(updates) as Partial<Workout>);
      if (op.kind !== "addSet") {
        ctx.setStamps.delete(stampKey);
        ctx.setStamps.set(stampKey, op.at);
        ctx.saveStamps();
      }
      if (finishedAt != null) {
        await refreshStats(workout.userId);
        return;
      }
      // The same rule as the workout screen: a rest starts when a set first
      // turns done. Timed from when it was lifted, so a set that reaches the
      // phone late doesn't start a rest that should already be over.
      if (result.completedNow && ctx.restSeconds > 0) {
        const from = opTime(op.at, now, workout.startedAt.getTime());
        const endsAt = from + ctx.restSeconds * 1000;
        if (endsAt > now) {
          ctx.startRest(workout.id, from);
          ctx.rest = { workoutId: workout.id, endsAt };
        }
      }
      return;
    }

    case "startTemplate": {
      if (now - op.at > START_TTL_MS) return;
      // The watch only offers templates when nothing is running. If something
      // started on the phone in the meantime, that workout is what the watch
      // should show next, not a second one.
      if (ctx.active.length > 0) return;
      const template = ctx.templates.find((t) => t.id === op.templateId);
      if (!template) return;
      const { id, saved } = startFromTemplate(template, dataUserId);
      // Counted as running straight away, so a second start in the same batch
      // (a retry from the watch) is turned away like any other.
      ctx.active = [...ctx.active, { ...template, id, isTemplate: false, startedAt: new Date(now) }];
      // Opening a workout on the phone makes it the lead; there's no screen
      // opening here, so say so directly.
      markCurrentWorkout(id);
      await saved;
      return;
    }

    case "finish": {
      const workout = await getWorkout(op.workoutId);
      if (!workout) {
        if (awaitingFirstSync(dataUserId)) throw new NotYet();
        return;
      }
      if (workout.userId !== dataUserId || !isActiveWorkout(workout)) return;
      const completedAt = new Date(opTime(op.at, now, workout.startedAt?.getTime() ?? 0));
      let exercises = workout.exercises;
      // As the workout screen does: a stopwatch still running is banked, not lost.
      if (ctx.timer?.workoutId === workout.id) {
        exercises = bankRunningTimer(exercises, ctx.timer, completedAt.getTime());
        ctx.clearTimer();
        ctx.timer = null;
      }
      const log = await bodyweightLogFor(workout.userId);
      const bodyweightLbs = bodyweightOn(log, workoutDay(workout))?.lbs;
      await updateWorkout(
        workout.id,
        stripUndefined({ exercises, ...finishedFields(workout, exercises, completedAt, bodyweightLbs) }) as Partial<Workout>
      );
      await refreshStats(workout.userId);
      return;
    }

    case "startCardio": {
      // Here already: a resend, or its finish arrived first and brought it in.
      if (sessionStartedBy(op.opId, ctx)) return;
      if (isDiscarded({ workoutId: null, startOpId: op.opId, session: op.session, startedAt: op.at })) return;
      // The watch is now tracking a session the phone started and woke it
      // for: the same session, not a second one. Marked as tracked there only
      // now, when the watch says so — the phone waking the app proves nothing.
      const phoneStarted = [...ctx.active].find(
        (w) =>
          w.cardio?.kind === op.session &&
          !w.cardio.watchStartOpId &&
          !!w.startedAt &&
          Math.abs(w.startedAt.getTime() - op.at) < SAME_START_MS
      );
      if (phoneStarted) {
        const fresh = (await getWorkout(phoneStarted.id)) ?? phoneStarted;
        if (!fresh.cardio || fresh.completedAt) return;
        const cardio = { ...fresh.cardio, watch: true, watchStartOpId: op.opId };
        await updateWorkout(fresh.id, stripUndefined({ cardio }) as Partial<Workout>);
        ctx.active = ctx.active.map((w) => (w.id === fresh.id ? { ...w, cardio } : w));
        return;
      }
      // At the limit, it waits for its finish, which brings it in regardless —
      // the run is happening on the watch whether or not the phone has room.
      if (ctx.active.length >= MAX_ACTIVE_WORKOUTS) return;
      const session = newCardioSession(op.session, op.indoor, {
        userId: dataUserId,
        weightUnit: ctx.unit,
        now: new Date(Math.min(op.at, now)),
      });
      session.cardio = { ...session.cardio!, watch: true, watchStartOpId: op.opId };
      const { id, saved } = createWorkoutLocalFirst(stripUndefined(session));
      ctx.active = [...ctx.active, { ...session, id }];
      markCurrentWorkout(id);
      await saved;
      return;
    }

    case "pauseCardio":
    case "resumeCardio": {
      if (isDiscarded(op)) return;
      const session = await findSession(op, ctx);
      if (!session?.cardio || session.completedAt || !session.startedAt) return;
      const at = opTime(op.at, now, session.startedAt.getTime());
      const cardio = op.kind === "pauseCardio" ? paused(session, at) : resumed(session, at);
      await updateWorkout(session.id, stripUndefined({ cardio }) as Partial<Workout>);
      return;
    }

    case "finishCardio": {
      // Thrown away on the phone: whatever the watch measured goes with it.
      if (isDiscarded(op)) return;
      const { exercise } = sessionTarget(op.session, op.indoor);
      const ground = distanceKind(exercise);
      const tracked = trackedFromWatch({
        healthId: op.healthId,
        indoor: op.indoor,
        activeCalories: op.activeCalories,
        avgHeartRate: op.avgHeartRate,
        maxHeartRate: op.maxHeartRate,
        curve: curveFromFlat(op.curve),
        withSplits: ground === "foot" || ground === "ride",
        isRun: op.session === "run",
      });
      const distance = ground && op.distance && op.distance > 0 ? Math.round(op.distance * 10) / 10 : undefined;
      const session = await findSession(op, ctx);
      // Started on the phone, the session's clock began a few seconds — the
      // Health sheet, the watch waking — before the watch's did. That time
      // was spent in the session too.
      const lead = session?.startedAt ? Math.max(0, Math.round((op.startedAt - session.startedAt.getTime()) / 1000)) : 0;
      const duration = op.duration + (lead < SAME_START_MS / 1000 ? lead : 0);
      const durationMinutes = Math.max(1, Math.round(duration / 60));

      if (!session) {
        // Ended before it got going — seconds, and nowhere — isn't a session
        // worth bringing in on its own.
        if (op.duration < MIN_SESSION_SECONDS && !distance) return;
        // Its start never landed — refused at the limit, or lost — so the
        // finish brings the whole session in, finished.
        const fresh = newCardioSession(op.session, op.indoor, {
          userId: dataUserId,
          weightUnit: ctx.unit,
          now: new Date(Math.min(op.startedAt, now)),
        });
        const completedAt = new Date(Math.min(Math.max(op.at, op.startedAt), now));
        const { saved } = createWorkoutLocalFirst(
          stripUndefined({
            ...fresh,
            cardio: { ...fresh.cardio!, watch: true, ...(op.startOpId ? { watchStartOpId: op.startOpId } : {}) },
            completedAt,
            durationMinutes,
            totalVolume: 0,
            exercises: fresh.exercises.map((ex) => ({
              ...ex,
              sets: ex.sets.map((set) => ({ ...set, duration, distance, tracked, isCompleted: true, completedAt })),
            })),
          })
        );
        await saved;
        await refreshStats(dataUserId);
        return;
      }
      if (session.userId !== dataUserId || !session.cardio) return;

      // Ended on the phone already: it keeps the moment it was ended there.
      const completedAt = session.completedAt ?? new Date(opTime(op.at, now, session.startedAt?.getTime() ?? 0));
      const { pausedAtMs: _paused, ...cardio } = session.cardio;
      const exercises = session.exercises.map((ex, i) =>
        i !== 0
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((set, j) =>
                j !== 0
                  ? set
                  : {
                      ...set,
                      // The watch measured these; a distance typed on the
                      // phone stays only if the watch had none.
                      duration: duration > 0 ? duration : set.duration,
                      distance: distance ?? set.distance,
                      tracked,
                      isCompleted: true,
                      completedAt,
                    }
              ),
            }
      );
      await updateWorkout(
        session.id,
        stripUndefined({
          exercises,
          completedAt,
          durationMinutes,
          totalVolume: 0,
          cardio: { ...cardio, watch: true },
        }) as Partial<Workout>
      );
      await refreshStats(dataUserId);
      return;
    }

    case "extendRest":
      if (ctx.rest?.workoutId !== op.workoutId) return;
      ctx.extendRest(op.seconds * 1000);
      ctx.rest = { ...ctx.rest, endsAt: ctx.rest.endsAt + op.seconds * 1000 };
      return;

    case "endRest":
      if (ctx.rest?.workoutId !== op.workoutId) return;
      ctx.endRest();
      ctx.rest = null;
      return;
  }
}

/** The session a start op of this id created, if it's here yet. */
function sessionStartedBy(startOpId: string, ctx: WatchSyncContext): Workout | undefined {
  return [...ctx.active, ...ctx.completed].find((w) => w.cardio?.watchStartOpId === startOpId);
}

/** A session started on the phone and this close to the watch's start is the one it woke the watch for. */
const SAME_START_MS = 5 * 60 * 1000;
/** Shorter than this, with no distance, a finish with nothing behind it is a false start. */
const MIN_SESSION_SECONDS = 10;

/**
 * The session a cardio op is about: by the phone's id, once the watch knows
 * it; by the watch's start op, for one the watch started; and otherwise by
 * kind and start time — a session started on the phone wakes the watch, which
 * may end it before ever hearing its id.
 */
async function findSession(op: WatchCardioOp, ctx: WatchSyncContext): Promise<Workout | null> {
  if (op.workoutId) {
    const byId = await getWorkout(op.workoutId);
    if (byId) return byId;
  }
  const sessions = [...ctx.active, ...ctx.completed].filter((w) => w.cardio && w.userId === ctx.dataUserId);
  const match =
    (op.startOpId ? sessions.find((w) => w.cardio!.watchStartOpId === op.startOpId) : undefined) ??
    (op.session != null && op.startedAt != null
      ? sessions.find(
          (w) =>
            w.cardio!.kind === op.session &&
            !w.cardio!.watchStartOpId &&
            !w.exercises[0]?.sets[0]?.tracked &&
            !!w.startedAt &&
            Math.abs(w.startedAt.getTime() - op.startedAt!) < SAME_START_MS
        )
      : undefined);
  if (!match) return null;
  // The freshest copy: ctx's lists are as of the last render.
  return (await getWorkout(match.id)) ?? match;
}

/** Lifetime stats are derived from history, as the workout screen's Finish does. */
async function refreshStats(userId: string): Promise<void> {
  const history = await getCompletedWorkouts(userId);
  await upsertUserStats({ userId, ...computeStats(history) });
}

/**
 * The weigh-ins a finish values bodyweight sets against.
 *
 * The workout screen has these loaded already; this runs with no screen open,
 * often in the few seconds iOS gives a background launch. So the copy on the
 * phone comes first, and a cloud read only fills in when there isn't one — and
 * isn't waited on for long. Without any, bodyweight sets count zero volume,
 * exactly as they do on the phone before a first weigh-in.
 */
async function bodyweightLogFor(userId: string): Promise<BodyweightEntry[]> {
  if (isGuestUserId(userId)) return getBodyweightLog(userId).catch(() => []);
  const cached = await readCachedBodyweight(userId).catch(() => null);
  if (cached) return cached;
  const timeout = new Promise<BodyweightEntry[]>((resolve) => setTimeout(() => resolve([]), BODYWEIGHT_READ_MS));
  return Promise.race([getBodyweightLog(userId), timeout]).catch(() => []);
}
