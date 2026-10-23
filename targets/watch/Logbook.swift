import Foundation

/// The numbers the editor starts from for a set.
struct Draft: Equatable {
  var weight: Double
  var reps: Int
  var duration: Int
}

/// Pure logic for the logger: no UI, no connectivity, so it reads (and tests)
/// on its own.
enum Logbook {
  /// The phone's rule for a finished set (SetRow.commit): weight and positive
  /// reps, positive reps alone for bodyweight, a positive time for timed.
  static func isDone(kind: SetKind, weight: Double?, reps: Int?, duration: Int?) -> Bool {
    switch kind {
    case .timed: return (duration ?? 0) > 0
    case .bodyweight: return (reps ?? 0) > 0
    case .weight: return weight != nil && (reps ?? 0) > 0
    }
  }

  /// The workout as the watch should show it: the phone's snapshot with the
  /// watch's own not-yet-applied changes laid over it, so a set logged here
  /// shows as logged straight away rather than when the phone answers.
  static func overlay(_ ops: [WatchOp], on workout: WatchWorkout?) -> WatchWorkout? {
    guard var result = workout else { return nil }
    for op in ops where op.workoutId == result.id {
      switch op.kind {
      case .finish:
        return nil
      case .logSet, .undoSet, .addSet:
        guard let exerciseId = op.exerciseId, let setId = op.setId,
              let e = result.exercises.firstIndex(where: { $0.id == exerciseId }) else { continue }
        var exercise = result.exercises[e]
        if op.kind == .addSet {
          if !exercise.sets.contains(where: { $0.id == setId }) {
            exercise.sets.append(WatchSet.empty(id: setId))
          }
        } else if let s = exercise.sets.firstIndex(where: { $0.id == setId }) {
          if op.kind == .undoSet {
            exercise.sets[s].weight = nil
            exercise.sets[s].reps = nil
            exercise.sets[s].duration = nil
            exercise.sets[s].done = false
          } else {
            exercise.sets[s].weight = op.weight
            exercise.sets[s].reps = op.reps
            exercise.sets[s].duration = op.duration
            exercise.sets[s].done = isDone(kind: exercise.kind, weight: op.weight, reps: op.reps, duration: op.duration)
          }
        }
        result.exercises[e] = exercise
      case .startTemplate, .extendRest, .endRest:
        continue
      }
    }
    return result
  }

  /// The set to log next: the first one not done.
  static func currentSetIndex(in exercise: WatchExercise) -> Int? {
    exercise.sets.firstIndex { !$0.done }
  }

  /// What the editor starts from.
  ///
  /// The set's own numbers if it has any, then the set you just did in this
  /// exercise — straight sets are the common case, and it already includes
  /// today's change in weight — then last session's numbers for this set,
  /// then nothing.
  static func draft(for index: Int, in exercise: WatchExercise) -> Draft {
    let set = exercise.sets[index]
    let earlier = exercise.sets[..<index].last(where: { $0.done })
    return Draft(
      weight: set.weight ?? earlier?.weight ?? set.lastWeight ?? 0,
      reps: set.reps ?? earlier?.reps ?? set.lastReps ?? 0,
      duration: set.duration ?? earlier?.duration ?? set.lastDuration ?? 0
    )
  }

  /// Whether this exercise already has a set done before `index` — the
  /// editor starts on reps then, since the weight is usually settled.
  static func hasEarlierDoneSet(before index: Int, in exercise: WatchExercise) -> Bool {
    exercise.sets[..<index].contains { $0.done }
  }

  /// The exercise to open on: the first with a set left to do.
  static func firstOpenExercise(in workout: WatchWorkout) -> String? {
    workout.exercises.first(where: { currentSetIndex(in: $0) != nil })?.id
  }

  /// Where to go once an exercise is finished: the next exercise after it
  /// with sets left, then any earlier one that was skipped, else nowhere.
  static func nextOpenExercise(in workout: WatchWorkout, after exerciseId: String) -> String? {
    guard let start = workout.exercises.firstIndex(where: { $0.id == exerciseId }) else {
      return firstOpenExercise(in: workout)
    }
    let after = workout.exercises[(start + 1)...]
    let before = workout.exercises[..<start]
    return (after + before).first(where: { currentSetIndex(in: $0) != nil })?.id
  }

  /// The next set to do, starting from `exerciseId` — for "Next:" during rest.
  static func nextUp(in workout: WatchWorkout, from exerciseId: String) -> (exercise: WatchExercise, index: Int)? {
    if let exercise = workout.exercises.first(where: { $0.id == exerciseId }),
       let index = currentSetIndex(in: exercise) {
      return (exercise, index)
    }
    guard let nextId = nextOpenExercise(in: workout, after: exerciseId),
          let exercise = workout.exercises.first(where: { $0.id == nextId }),
          let index = currentSetIndex(in: exercise) else { return nil }
    return (exercise, index)
  }

  /// One crown detent of weight: a pair of the smallest common plates.
  static func weightStep(unit: String) -> Double {
    unit == "kg" ? 2.5 : 5
  }

  static func number(_ value: Double) -> String {
    if value == value.rounded() && abs(value) < 100_000 {
      return String(Int(value))
    }
    return String(format: "%.1f", value)
  }

  /// "185", or for bodyweight "BW", "+25", "−20".
  static func weightText(_ weight: Double, kind: SetKind) -> String {
    guard kind == .bodyweight else { return number(weight) }
    if weight == 0 { return "BW" }
    return weight > 0 ? "+" + number(weight) : "\u{2212}" + number(-weight)
  }

  /// "0:45", "12:03", "1:02:03"
  static func clock(_ seconds: Int) -> String {
    let s = max(0, seconds)
    let hours = s / 3600
    let minutes = (s % 3600) / 60
    let rest = s % 60
    if hours > 0 {
      return String(format: "%d:%02d:%02d", hours, minutes, rest)
    }
    return String(format: "%d:%02d", minutes, rest)
  }

  /// A set in one line, for the set list: "185 × 5", "BW × 12", "0:45", or a
  /// dash for one with nothing in it.
  static func summary(of set: WatchSet, kind: SetKind) -> String {
    switch kind {
    case .timed:
      guard let duration = set.duration else { return "\u{2014}" }
      return clock(duration)
    case .weight, .bodyweight:
      guard set.weight != nil || set.reps != nil else { return "\u{2014}" }
      let weight = set.weight.map { weightText($0, kind: kind) } ?? (kind == .bodyweight ? "BW" : "\u{2014}")
      let reps = set.reps.map(String.init) ?? "\u{2014}"
      return "\(weight) \u{00D7} \(reps)"
    }
  }

  /// "185 × 5" for what the editor would start a set at.
  static func draftSummary(_ draft: Draft, kind: SetKind) -> String {
    if kind == .timed { return clock(draft.duration) }
    return "\(weightText(draft.weight, kind: kind)) \u{00D7} \(draft.reps)"
  }

  /// "5 exercises · 16 sets"
  static func templateMeta(_ template: WatchTemplate) -> String {
    let exercises = template.exerciseCount == 1 ? "1 exercise" : "\(template.exerciseCount) exercises"
    let sets = template.setCount == 1 ? "1 set" : "\(template.setCount) sets"
    return "\(exercises) \u{00B7} \(sets)"
  }

  static func setCounts(in workout: WatchWorkout) -> (done: Int, total: Int) {
    let sets = workout.exercises.flatMap { $0.sets }
    return (sets.filter { $0.done }.count, sets.count)
  }
}
