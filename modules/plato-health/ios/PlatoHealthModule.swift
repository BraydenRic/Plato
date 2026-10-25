import ExpoModulesCore
import HealthKit

// Reads cardio workouts out of Apple Health for src/lib/health-import.ts.
//
// Deliberately thin: it reads, and hands JavaScript plain numbers. Everything
// that decides what a workout *means* — splits, fastest mile, which exercise —
// is worked out on the JavaScript side, where the tests can reach it.
//
// Read-only. Plato asks to write nothing, so nothing it does can change what's
// in someone's Health data.
public class PlatoHealthModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("PlatoHealth")

    Function("isAvailable") { () -> Bool in
      return HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("requestAccess") { () async throws -> Void in
      try await self.requestAccess()
    }

    AsyncFunction("getWorkouts") { (sinceMs: Double, activities: [String]) async throws -> [[String: Any]] in
      return try await self.workouts(since: Date(timeIntervalSince1970: sinceMs / 1000), activities: Set(activities))
    }

    AsyncFunction("getDistanceSamples") { (id: String) async throws -> [[String: Double]] in
      return try await self.distanceSamples(workoutId: id)
    }
  }

  // ── Access ────────────────────────────────────────────────────────────────

  private var readTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = [HKObjectType.workoutType()]
    let quantities: [HKQuantityTypeIdentifier] = [
      .distanceWalkingRunning, .distanceCycling, .distanceSwimming, .activeEnergyBurned, .heartRate,
    ]
    for id in quantities {
      if let type = HKObjectType.quantityType(forIdentifier: id) { types.insert(type) }
    }
    return types
  }

  private func requestAccess() async throws {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      store.requestAuthorization(toShare: nil, read: readTypes) { _, error in
        if let error = error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  // ── Workouts ──────────────────────────────────────────────────────────────

  private func workouts(since: Date, activities: Set<String>) async throws -> [[String: Any]] {
    let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
    let oldestFirst = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
    let samples = try await query(HKObjectType.workoutType(), predicate: predicate, sort: oldestFirst)
    return samples.compactMap { sample in
      guard let workout = sample as? HKWorkout,
        let activity = Self.activityName(workout.workoutActivityType),
        activities.contains(activity)
      else { return nil }
      return describe(workout, activity: activity)
    }
  }

  /// The names src/lib/health-import.ts maps to exercises. Anything else
  /// (strength, yoga, HIIT…) isn't cardio that Plato has an exercise for.
  private static func activityName(_ type: HKWorkoutActivityType) -> String? {
    switch type {
    case .running: return "running"
    case .walking: return "walking"
    case .hiking: return "hiking"
    case .cycling: return "cycling"
    case .rowing: return "rowing"
    case .elliptical: return "elliptical"
    case .stairClimbing: return "stairClimbing"
    case .swimming: return "swimming"
    case .jumpRope: return "jumpRope"
    default: return nil
    }
  }

  /// The quantity a workout's distance is recorded as, if it covers ground.
  private static func distanceType(_ type: HKWorkoutActivityType) -> HKQuantityType? {
    let id: HKQuantityTypeIdentifier
    switch type {
    case .running, .walking, .hiking: id = .distanceWalkingRunning
    case .cycling: id = .distanceCycling
    case .swimming: id = .distanceSwimming
    default: return nil
    }
    return HKObjectType.quantityType(forIdentifier: id)
  }

  private func describe(_ workout: HKWorkout, activity: String) -> [String: Any] {
    let source = workout.sourceRevision.source
    var out: [String: Any] = [
      "id": workout.uuid.uuidString,
      "activity": activity,
      "indoor": (workout.metadata?[HKMetadataKeyIndoorWorkout] as? NSNumber)?.boolValue ?? false,
      "startMs": workout.startDate.timeIntervalSince1970 * 1000,
      "endMs": workout.endDate.timeIntervalSince1970 * 1000,
      // Moving time: Health leaves paused stretches out of a workout's duration.
      "duration": workout.duration,
      "events": events(of: workout),
      "source": source.name,
      "sourceBundle": source.bundleIdentifier,
    ]
    // Absent rather than null when Health has no figure, so JavaScript reads
    // a missing reading as missing, not as zero.
    if let metres = distance(of: workout) { out["distance"] = metres }
    if let kcal = activeCalories(of: workout) { out["activeCalories"] = kcal }
    if #available(iOS 16.0, *),
      let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate),
      let stats = workout.statistics(for: heartRate)
    {
      let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
      if let average = stats.averageQuantity() { out["avgHeartRate"] = average.doubleValue(for: bpm) }
      if let maximum = stats.maximumQuantity() { out["maxHeartRate"] = maximum.doubleValue(for: bpm) }
    }
    return out
  }

  private func distance(of workout: HKWorkout) -> Double? {
    if #available(iOS 16.0, *),
      let type = Self.distanceType(workout.workoutActivityType),
      let metres = workout.statistics(for: type)?.sumQuantity()?.doubleValue(for: HKUnit.meter())
    {
      return metres
    }
    // Older iOS, and kinds whose distance has no statistic of its own (a rower).
    return workout.totalDistance?.doubleValue(for: HKUnit.meter())
  }

  private func activeCalories(of workout: HKWorkout) -> Double? {
    if #available(iOS 16.0, *),
      let type = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
      let kcal = workout.statistics(for: type)?.sumQuantity()?.doubleValue(for: HKUnit.kilocalorie())
    {
      return kcal
    }
    return workout.totalEnergyBurned?.doubleValue(for: HKUnit.kilocalorie())
  }

  /// Pauses and resumes, the automatic kind included, for working out moving time.
  private func events(of workout: HKWorkout) -> [[String: Any]] {
    return (workout.workoutEvents ?? []).compactMap { event in
      let type: String
      switch event.type {
      case .pause, .motionPaused: type = "pause"
      case .resume, .motionResumed: type = "resume"
      default: return nil
      }
      return ["type": type, "ms": event.dateInterval.start.timeIntervalSince1970 * 1000]
    }
  }

  // ── Distance readings ─────────────────────────────────────────────────────

  private func distanceSamples(workoutId: String) async throws -> [[String: Double]] {
    guard let uuid = UUID(uuidString: workoutId) else { return [] }
    let found = try await query(HKObjectType.workoutType(), predicate: HKQuery.predicateForObject(with: uuid), limit: 1)
    guard let workout = found.first as? HKWorkout,
      let type = Self.distanceType(workout.workoutActivityType)
    else { return [] }

    let oldestFirst = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
    var samples = try await query(type, predicate: HKQuery.predicateForObjects(from: workout), sort: oldestFirst)
    if samples.isEmpty {
      // Some apps save a workout without tying its readings to it. The same
      // app's readings over the same span are those readings — and keeping to
      // that one source leaves out the phone's pedometer counting the same
      // steps a second time.
      let span = HKQuery.predicateForSamples(
        withStart: workout.startDate, end: workout.endDate, options: [.strictStartDate, .strictEndDate])
      let sameSource = HKQuery.predicateForObjects(from: workout.sourceRevision.source)
      let both = NSCompoundPredicate(andPredicateWithSubpredicates: [span, sameSource])
      samples = try await query(type, predicate: both, sort: oldestFirst)
    }
    return samples.compactMap { sample in
      guard let reading = sample as? HKQuantitySample else { return nil }
      return [
        "startMs": reading.startDate.timeIntervalSince1970 * 1000,
        "endMs": reading.endDate.timeIntervalSince1970 * 1000,
        "metres": reading.quantity.doubleValue(for: HKUnit.meter()),
      ]
    }
  }

  private func query(
    _ type: HKSampleType,
    predicate: NSPredicate?,
    limit: Int = HKObjectQueryNoLimit,
    sort: [NSSortDescriptor]? = nil
  ) async throws -> [HKSample] {
    return try await withCheckedThrowingContinuation { continuation in
      let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: limit, sortDescriptors: sort) {
        _, results, error in
        if let error = error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: results ?? [])
        }
      }
      store.execute(query)
    }
  }
}
