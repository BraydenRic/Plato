import Foundation

// The watch's half of the contract in src/lib/watch-protocol.ts. Field names
// and meanings match that file exactly; change one, change both.

enum SetKind: String, Codable {
  /// weight × reps
  case weight
  /// added load × reps — 0 is plain bodyweight, negative is assistance
  case bodyweight
  /// a stopwatch
  case timed
}

struct WatchSet: Codable, Identifiable, Equatable {
  let id: String
  var done: Bool
  /// In the snapshot's unit. Added load for bodyweight sets.
  var weight: Double?
  var reps: Int?
  /// Seconds.
  var duration: Int?
  /// Last session's numbers for this set position.
  var lastWeight: Double?
  var lastReps: Int?
  var lastDuration: Int?

  static func empty(id: String) -> WatchSet {
    WatchSet(id: id, done: false, weight: nil, reps: nil, duration: nil, lastWeight: nil, lastReps: nil, lastDuration: nil)
  }
}

struct WatchExercise: Codable, Identifiable, Equatable {
  let id: String
  let name: String
  let kind: SetKind
  var sets: [WatchSet]
}

struct WatchWorkout: Codable, Identifiable, Equatable {
  let id: String
  let name: String
  /// ms since epoch
  let startedAt: Double
  var exercises: [WatchExercise]
  /// Set when it's a cardio session, which gets its own screen. Absent from
  /// phones older than sessions, which reads as nil.
  var cardio: WatchCardio? = nil
}

/// A cardio session, as far as the watch needs to know it.
struct WatchCardio: Codable, Equatable {
  /// A CardioKind's raw value.
  let kind: String
  let indoor: Bool
  /// ms since epoch, while paused; nil while moving.
  let pausedAtMs: Double?
  let pausedSeconds: Double
  /// A watch is tracking it.
  let watch: Bool
  /// The watch's start op, when the watch started it.
  let startOpId: String?
}

struct WatchTemplate: Codable, Identifiable, Equatable, Hashable {
  let id: String
  let name: String
  let exercises: [String]
  let exerciseCount: Int
  let setCount: Int
}

struct WatchSnapshot: Codable, Equatable {
  let v: Int
  /// ms since epoch
  let sentAt: Double
  /// "signedIn" or "none"
  let account: String
  /// "lbs" or "kg"
  let unit: String
  let restSeconds: Int
  /// ms since epoch
  let restEndsAt: Double?
  let accent: String
  let onAccent: String
  let workout: WatchWorkout?
  let templates: [WatchTemplate]
  let applied: [String]
  /// Sessions ended or thrown away on the phone that a watch may still be
  /// tracking. Absent from older phones.
  var endedCardio: [EndedCardio]? = nil

  var isSignedIn: Bool { account == "signedIn" }
}

/// A session ended on the phone, described every way the watch might know it.
struct EndedCardio: Codable, Equatable {
  let id: String
  let startOpId: String?
  /// A CardioKind's raw value.
  let kind: String
  /// ms since epoch
  let startedAt: Double
  /// Thrown away: keep nothing, Health included.
  let discard: Bool
  /// When it was ended or thrown away, ms since epoch. Absent from older
  /// phones.
  var at: Double? = nil
}

/// One change made on the watch, sent to the phone to apply.
struct WatchOp: Codable, Identifiable, Equatable {
  enum Kind: String, Codable {
    case logSet, undoSet, addSet, startTemplate, finish, extendRest, endRest
    case startCardio, pauseCardio, resumeCardio, finishCardio
  }

  let opId: String
  let kind: Kind
  /// ms since epoch
  let at: Double
  var workoutId: String?
  var exerciseId: String?
  var setId: String?
  var templateId: String?
  var weight: Double?
  var reps: Int?
  /// Seconds: a timed set's stopwatch, or a finished session's moving time.
  var duration: Int?
  var unit: String?
  var seconds: Int?
  // Cardio sessions (see src/lib/watch-protocol.ts).
  /// A CardioKind's raw value.
  var session: String?
  var indoor: Bool?
  /// The session's start op, for one the watch started.
  var startOpId: String?
  /// On startCardio: the phone woke the watch for this session, so it's one
  /// the phone already has. False for one started on the watch itself, which
  /// can't be mistaken for a phone session by kind and time.
  var fromPhone: Bool?
  /// ms since epoch
  var startedAt: Double?
  /// Metres.
  var distance: Double?
  var activeCalories: Double?
  var avgHeartRate: Double?
  var maxHeartRate: Double?
  /// The workout saved to Apple Health.
  var healthId: String?
  /// Metres and moving seconds, alternating.
  var curve: [Double]?

  var id: String { opId }

  init(kind: Kind, at: Double, workoutId: String? = nil, exerciseId: String? = nil, setId: String? = nil) {
    self.opId = UUID().uuidString
    self.kind = kind
    self.at = at
    self.workoutId = workoutId
    self.exerciseId = exerciseId
    self.setId = setId
  }
}

/// An op that hasn't shown up in a snapshot's `applied` list yet.
struct PendingOp: Codable, Equatable {
  var op: WatchOp
  /// The phone, or the system's delivery queue, has it.
  var delivered: Bool
  /// It moves the rest countdown, so the watch's own copy of the rest wins
  /// until the phone has caught up.
  var affectsRest: Bool
}

/// A stopwatch running on a timed set.
struct TimedRun: Codable, Equatable {
  let setId: String
  /// ms since epoch, backdated by any time the set already had.
  let startedAt: Double
}

extension Date {
  var ms: Double { timeIntervalSince1970 * 1000 }

  init(ms: Double) {
    self.init(timeIntervalSince1970: ms / 1000)
  }
}
