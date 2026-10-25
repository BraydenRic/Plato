import Combine
import Foundation
import SwiftUI

/// A template start waiting on the phone.
struct StartRequest: Equatable {
  enum Failure: Equatable {
    /// The request never got to the phone.
    case unreachable
    /// The phone has it but hasn't come back with a workout.
    case noAnswer
  }

  let template: WatchTemplate
  let opId: String
  var failure: Failure?
}

/// The "Workout saved" screen after finishing from the watch.
struct FinishedSummary: Equatable {
  let id = UUID()
  let name: String
  let setsDone: Int
}

/// Everything the watch app knows, and every change it can make.
///
/// The phone's snapshot is the truth. Changes made here go to the phone as
/// ops and are also kept in `pending`, laid over the snapshot until a snapshot
/// lists them as applied — so a set shows as logged the moment Done is
/// tapped, phone in range or not.
final class WatchStore: ObservableObject {
  /// One for the app: the phone can wake it in the background to track a
  /// session before any screen exists, and whatever that session sends has to
  /// go through the same queue as everything else.
  static let shared = WatchStore()

  @Published private(set) var snapshot: WatchSnapshot?
  @Published private(set) var pending: [PendingOp] = []
  /// The rest deadline (ms) the watch worked out itself, which counts while
  /// any rest-moving op is still pending.
  @Published private(set) var localRest: Double?
  @Published private(set) var start: StartRequest?
  @Published private(set) var finished: FinishedSummary?
  @Published private(set) var timedRun: TimedRun?
  /// Bumped when a rest runs out, or the app comes back, so views re-read the clock.
  @Published private(set) var tick = 0
  /// The "Run saved" screen after a cardio session ends.
  @Published private(set) var cardioFinished: CardioResult?
  /// Why tracking didn't start, shown for a moment instead of nothing.
  @Published private(set) var cardioError: String?

  let tracker = CardioTracker.shared
  private let link = PhoneLink()
  private var liveTimer: Timer?
  private let defaults = UserDefaults.standard
  /// The op being sent right now. One at a time, oldest first, so they reach
  /// the phone in the order they happened.
  private var sending: (opId: String, since: Date)?
  private var restTimer: Timer?
  private var startTimeout: DispatchWorkItem?
  private var startPoll: Timer?

  private enum Keys {
    static let snapshot = "plato.watch.snapshot.v1"
    static let pending = "plato.watch.pending.v1"
    static let timedRun = "plato.watch.timedRun.v1"
  }

  /// How long a start waits for the phone to come back with the workout.
  /// Generous: the phone may have to launch Plato in the background first,
  /// and the request itself is known to have arrived (a start that doesn't
  /// reach the phone fails at once, see settle).
  private let startPatience: TimeInterval = 60
  /// How often a start asks the phone for news while it waits.
  private let startPollInterval: TimeInterval = 2
  /// How often a tracked session's numbers go to the phone while it's in reach.
  private let liveInterval: TimeInterval = 5
  /// An op the phone never confirms is dropped after this, so one lost on the
  /// way can't hold the watch's view of a set forever.
  private let pendingLifetimeMs: Double = 6 * 60 * 60 * 1000
  /// A send that hasn't answered in this long is assumed lost (the app was
  /// suspended mid-send) and tried again.
  private let sendPatience: TimeInterval = 30

  private init() {
    if let json = defaults.string(forKey: Keys.snapshot) {
      snapshot = Self.decodeSnapshot(json)
    }
    if let data = defaults.data(forKey: Keys.pending),
       let saved = try? JSONDecoder().decode([PendingOp].self, from: data) {
      pending = saved
    }
    if let data = defaults.data(forKey: Keys.timedRun),
       let saved = try? JSONDecoder().decode(TimedRun.self, from: data) {
      timedRun = saved
    }
    link.onSnapshot = { [weak self] json in self?.receive(json) }
    link.onReady = { [weak self] in self?.reconnect() }
    tracker.onEvent = { [weak self] event in self?.handle(event) }
    link.activate()
    scheduleRestTick()
  }

  // MARK: What the views read

  /// A cardio session running on the phone that this watch isn't tracking.
  var phoneSession: WatchWorkout? {
    guard let workout, workout.cardio != nil, !tracker.isActive else { return nil }
    return workout
  }

  /// The workout in progress, with this watch's unapplied changes on top.
  var workout: WatchWorkout? {
    guard let snapshot, snapshot.isSignedIn else { return nil }
    return Logbook.overlay(pending.map { $0.op }, on: snapshot.workout)
  }

  var unit: String { snapshot?.unit ?? "lbs" }
  var accent: Color { Color(hex: snapshot?.accent) ?? .platoViolet }
  var onAccent: Color { Color(hex: snapshot?.onAccent) ?? .white }
  /// The opacity the Start screen washes the accent in — see Logbook.washOpacity.
  var accentWash: Double { Logbook.washOpacity(accentHex: snapshot?.accent) }

  /// When the current rest ends, while one is running.
  var restDeadline: Date? {
    let ms = pending.contains(where: { $0.affectsRest }) ? localRest : snapshot?.restEndsAt
    guard let ms, ms > Date().ms else { return nil }
    return Date(ms: ms)
  }

  // MARK: Logging

  func log(_ set: WatchSet, in exercise: WatchExercise, of workout: WatchWorkout, weight: Double?, reps: Int?, duration: Int?) {
    let now = Date().ms
    var op = WatchOp(kind: .logSet, at: now, workoutId: workout.id, exerciseId: exercise.id, setId: set.id)
    op.weight = weight
    op.reps = reps
    op.duration = duration
    op.unit = unit
    // The phone starts a rest when a set first turns done; so does the watch,
    // from the same moment, so the two countdowns agree.
    let completes = !set.done && Logbook.isDone(kind: exercise.kind, weight: weight, reps: reps, duration: duration)
    let restSeconds = snapshot?.restSeconds ?? 0
    if completes && restSeconds > 0 {
      localRest = now + Double(restSeconds) * 1000
      enqueue(op, affectsRest: true)
    } else {
      enqueue(op)
    }
  }

  /// Back to untouched, for a Done tapped by mistake.
  func clear(_ set: WatchSet, in exercise: WatchExercise, of workout: WatchWorkout) {
    if timedRun?.setId == set.id { setTimedRun(nil) }
    enqueue(WatchOp(kind: .undoSet, at: Date().ms, workoutId: workout.id, exerciseId: exercise.id, setId: set.id))
  }

  func addSet(to exercise: WatchExercise, of workout: WatchWorkout) {
    enqueue(WatchOp(kind: .addSet, at: Date().ms, workoutId: workout.id, exerciseId: exercise.id, setId: UUID().uuidString))
  }

  // MARK: Timed sets

  func startTimer(on set: WatchSet, in exercise: WatchExercise, of workout: WatchWorkout) {
    // One stopwatch at a time, as on the phone: starting another banks the
    // one that's running.
    if let run = timedRun, run.setId != set.id, let running = locate(run.setId, in: workout) {
      stopTimer(on: running.set, in: running.exercise, of: workout)
    }
    // Backdated by any time the set already has, so starting again resumes.
    let banked = Double(set.duration ?? 0) * 1000
    setTimedRun(TimedRun(setId: set.id, startedAt: Date().ms - banked))
  }

  func stopTimer(on set: WatchSet, in exercise: WatchExercise, of workout: WatchWorkout) {
    guard let run = timedRun, run.setId == set.id else { return }
    let seconds = Int((Date().ms - run.startedAt) / 1000)
    setTimedRun(nil)
    log(set, in: exercise, of: workout, weight: nil, reps: nil, duration: seconds)
  }

  // MARK: Rest

  func extendRest(of workout: WatchWorkout, by seconds: Int = 15) {
    guard let deadline = restDeadline else { return }
    localRest = deadline.ms + Double(seconds) * 1000
    var op = WatchOp(kind: .extendRest, at: Date().ms, workoutId: workout.id)
    op.seconds = seconds
    enqueue(op, affectsRest: true)
  }

  func skipRest(of workout: WatchWorkout) {
    localRest = nil
    enqueue(WatchOp(kind: .endRest, at: Date().ms, workoutId: workout.id), affectsRest: true)
  }

  // MARK: Starting and finishing

  func startWorkout(_ template: WatchTemplate) {
    var op = WatchOp(kind: .startTemplate, at: Date().ms)
    op.templateId = template.id
    stopWaitingForStart()
    start = StartRequest(template: template, opId: op.opId, failure: nil)
    enqueue(op)

    let timeout = DispatchWorkItem { [weak self] in
      guard let self, self.start?.opId == op.opId, self.workout == nil else { return }
      self.stopWaitingForStart()
      self.start?.failure = .noAnswer
    }
    startTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + startPatience, execute: timeout)
    // Ask rather than wait to be told. The phone also sends its snapshot as a
    // message while this app is open, so this is the second of two ways the
    // new workout gets here quickly.
    startPoll = Timer.scheduledTimer(withTimeInterval: startPollInterval, repeats: true) { [weak self] _ in
      self?.link.requestSnapshot()
    }
  }

  func retryStart() {
    guard let request = start else { return }
    startWorkout(request.template)
  }

  func cancelStart() {
    stopWaitingForStart()
    start = nil
  }

  private func stopWaitingForStart() {
    startTimeout?.cancel()
    startTimeout = nil
    startPoll?.invalidate()
    startPoll = nil
  }

  func finish(_ workout: WatchWorkout) {
    // A stopwatch still running is logged first, as the phone's Finish does
    // with its own — the phone can't bank this one, it never knew about it.
    if let run = timedRun, let running = locate(run.setId, in: workout) {
      stopTimer(on: running.set, in: running.exercise, of: workout)
    }
    setTimedRun(nil)
    let counts = Logbook.setCounts(in: self.workout ?? workout)
    enqueue(WatchOp(kind: .finish, at: Date().ms, workoutId: workout.id))
    finished = FinishedSummary(name: workout.name, setsDone: counts.done)
  }

  func dismissFinished() {
    finished = nil
  }

  // MARK: Cardio

  /// From the picker: track it here, and tell the phone once it's going.
  func startCardio(_ kind: CardioKind, indoor: Bool) {
    // A pool's length, guessed from the unit: 25 yards where people think in
    // pounds, 25 metres elsewhere. The phone makes the same guess.
    let pool = unit == "kg" ? 25 : 25 * CardioFormat.yard
    tracker.start(kind: kind, indoor: indoor, poolMetres: pool)
  }

  func dismissCardioFinished() {
    cardioFinished = nil
  }

  func dismissCardioError() {
    cardioError = nil
  }

  private func handle(_ event: CardioTracker.Event) {
    switch event {
    case .started:
      cardioError = nil
      // Every session, however it was started, introduces itself to the
      // phone once it's really running: a watch start becomes a session
      // there, a phone start learns the watch has it.
      var op = WatchOp(kind: .startCardio, at: (tracker.startedAt ?? Date()).ms)
      op.session = tracker.kind.rawValue
      op.indoor = tracker.indoor
      op.fromPhone = tracker.fromPhone
      tracker.assignStartOpId(op.opId)
      enqueue(op)
      startLiveUpdates()
      if let snapshot { reconcileCardio(with: snapshot) }
    case .recovered:
      cardioError = nil
      startLiveUpdates()
      if let snapshot { reconcileCardio(with: snapshot) }
    case .discarded:
      stopLiveUpdates()
    case .paused(let date):
      enqueue(cardioOp(.pauseCardio, at: date.ms))
      sendLive()
    case .resumed(let date):
      enqueue(cardioOp(.resumeCardio, at: date.ms))
      sendLive()
    case .finished(let result):
      stopLiveUpdates()
      var op = WatchOp(kind: .finishCardio, at: Date().ms, workoutId: result.workoutId)
      op.startOpId = result.startOpId
      op.session = result.kind.rawValue
      op.indoor = result.indoor
      op.startedAt = result.startedAt.ms
      op.duration = result.duration
      op.distance = result.distance
      op.activeCalories = result.activeCalories
      op.avgHeartRate = result.avgHeartRate
      op.maxHeartRate = result.maxHeartRate
      op.healthId = result.healthId
      op.curve = result.curve.isEmpty ? nil : result.curve
      enqueue(op)
      Haptics.confirm()
      cardioFinished = result
    case .failed(let reason):
      stopLiveUpdates()
      cardioError = reason
    }
  }

  /// A pause or resume, saying which session in every way the watch knows.
  private func cardioOp(_ kind: WatchOp.Kind, at: Double) -> WatchOp {
    var op = WatchOp(kind: kind, at: at, workoutId: tracker.workoutId)
    op.startOpId = tracker.startOpId
    op.session = tracker.kind.rawValue
    op.startedAt = tracker.startedAt?.ms
    return op
  }

  private func startLiveUpdates() {
    liveTimer?.invalidate()
    sendLive()
    let timer = Timer(timeInterval: liveInterval, repeats: true) { [weak self] _ in self?.sendLive() }
    RunLoop.main.add(timer, forMode: .common)
    liveTimer = timer
  }

  private func stopLiveUpdates() {
    liveTimer?.invalidate()
    liveTimer = nil
  }

  private func sendLive() {
    guard tracker.isActive, let started = tracker.startedAt else { return }
    var live: [String: Any] = [
      "kind": tracker.kind.rawValue,
      "startedAt": started.ms,
      "elapsed": tracker.elapsed(at: Date()),
      "paused": tracker.state == .paused,
      "at": Date().ms,
    ]
    if let id = tracker.workoutId { live["workoutId"] = id }
    if let op = tracker.startOpId { live["startOpId"] = op }
    if tracker.kind.tracksDistance { live["distance"] = tracker.distance }
    if let bpm = tracker.heartRate { live["heartRate"] = bpm }
    guard let data = try? JSONSerialization.data(withJSONObject: live),
          let json = String(data: data, encoding: .utf8) else { return }
    link.sendLive(json)
  }

  /// What a snapshot says about the session this watch is tracking: which of
  /// the phone's sessions it is, and whether it was ended over there. The
  /// rules are CardioMatch's.
  private func reconcileCardio(with next: WatchSnapshot) {
    guard tracker.isActive else { return }
    var tracked = CardioMatch.Tracked(
      kind: tracker.kind.rawValue,
      startedAt: tracker.startedAt?.ms,
      fromPhone: tracker.fromPhone,
      workoutId: tracker.workoutId,
      startOpId: tracker.startOpId
    )
    if let id = CardioMatch.link(tracked, in: next) {
      tracker.link(to: id)
      tracked.workoutId = id
    }
    if let ended = CardioMatch.ended(tracked, in: next) {
      tracker.end(discard: ended.discard)
    }
  }

  /// The app came back to the screen: catch up on anything missed meanwhile.
  func refresh() {
    if let current = sending, Date().timeIntervalSince(current.since) > sendPatience {
      sending = nil
    }
    reconnect()
    scheduleRestTick()
    tick += 1
  }

  // MARK: Talking to the phone

  private func enqueue(_ op: WatchOp, affectsRest: Bool = false) {
    pending.append(PendingOp(op: op, delivered: false, affectsRest: affectsRest))
    savePending()
    pump()
    scheduleRestTick()
  }

  /// Sends the oldest op not yet delivered, if nothing else is on its way.
  private func pump() {
    guard sending == nil, let next = pending.first(where: { !$0.delivered }) else { return }
    guard let data = try? JSONEncoder().encode(next.op),
          let json = String(data: data, encoding: .utf8) else { return }
    let op = next.op
    sending = (op.opId, Date())
    link.send(opId: op.opId, json: json, allowQueue: op.kind != .startTemplate) { [weak self] delivered in
      self?.settle(op, delivered: delivered)
    }
  }

  private func settle(_ op: WatchOp, delivered: Bool) {
    if sending?.opId == op.opId { sending = nil }
    if let index = pending.firstIndex(where: { $0.op.opId == op.opId }) {
      if delivered {
        pending[index].delivered = true
      } else if op.kind == .startTemplate {
        // A start is never queued for later, so not reaching the phone now
        // means it didn't happen.
        pending.remove(at: index)
        if start?.opId == op.opId {
          stopWaitingForStart()
          start?.failure = .unreachable
        }
      }
      savePending()
    }
    // An op that couldn't go out waits for the link to come back (reconnect)
    // rather than letting the ones behind it overtake it.
    if delivered || op.kind == .startTemplate { pump() }
  }

  private func reconnect() {
    pump()
    link.requestSnapshot()
  }

  private func receive(_ json: String) {
    guard let next = Self.decodeSnapshot(json) else { return }
    // A reply to "hello" can overtake a newer context, or trail one.
    if let current = snapshot, current.sentAt > next.sentAt { return }
    snapshot = next
    defaults.set(json, forKey: Keys.snapshot)

    let applied = Set(next.applied)
    let cutoff = Date().ms - pendingLifetimeMs
    pending.removeAll { item in
      // Signed out: whatever was pending belonged to the last account.
      !next.isSignedIn || applied.contains(item.op.opId) || item.op.at < cutoff
    }
    savePending()

    if next.workout != nil || !next.isSignedIn {
      stopWaitingForStart()
      start = nil
    }
    reconcileCardio(with: next)
    if let run = timedRun, !workoutHasSet(run.setId) {
      setTimedRun(nil)
    }
    scheduleRestTick()
  }

  // MARK: Helpers

  /// Re-renders once the rest deadline passes, so the rest screen gives way to
  /// the next set without a tap.
  private func scheduleRestTick() {
    restTimer?.invalidate()
    restTimer = nil
    guard let deadline = restDeadline else { return }
    let timer = Timer(fire: deadline.addingTimeInterval(0.05), interval: 0, repeats: false) { [weak self] _ in
      self?.tick += 1
    }
    RunLoop.main.add(timer, forMode: .common)
    restTimer = timer
  }

  private func locate(_ setId: String, in workout: WatchWorkout) -> (exercise: WatchExercise, set: WatchSet)? {
    for exercise in workout.exercises {
      if let set = exercise.sets.first(where: { $0.id == setId }) {
        return (exercise, set)
      }
    }
    return nil
  }

  private func workoutHasSet(_ setId: String) -> Bool {
    guard let workout else { return false }
    return locate(setId, in: workout) != nil
  }

  private func savePending() {
    if let data = try? JSONEncoder().encode(pending) {
      defaults.set(data, forKey: Keys.pending)
    }
  }

  private func setTimedRun(_ run: TimedRun?) {
    timedRun = run
    if let run, let data = try? JSONEncoder().encode(run) {
      defaults.set(data, forKey: Keys.timedRun)
    } else {
      defaults.removeObject(forKey: Keys.timedRun)
    }
  }

  private static func decodeSnapshot(_ json: String) -> WatchSnapshot? {
    guard let data = json.data(using: .utf8),
          let snapshot = try? JSONDecoder().decode(WatchSnapshot.self, from: data),
          snapshot.v == 1 else { return nil }
    return snapshot
  }
}
