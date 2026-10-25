import ExpoModulesCore
import HealthKit

// Apple Health on the phone, for cardio sessions the Apple Watch tracks.
//
// Two jobs and no more. Asking once for the access the watch needs — to save
// the sessions it tracks to Health, so they count toward the Activity rings,
// and to read the heart rate, energy and distance it records along the way;
// the watch app shares this app's Health access. And waking the watch app into
// a session started here. The tracking itself, and everything it measures,
// happens on the watch and comes back over the watch link, not from here.
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

    AsyncFunction("startWatchWorkout") { (kind: String, indoor: Bool, poolMetres: Double) async throws -> Bool in
      return try await self.startWatchWorkout(kind: kind, indoor: indoor, poolMetres: poolMetres)
    }
  }

  // ── Access ────────────────────────────────────────────────────────────────

  private var shareTypes: Set<HKSampleType> {
    return [HKObjectType.workoutType()]
  }

  private var readTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = [HKObjectType.workoutType()]
    let quantities: [HKQuantityTypeIdentifier] = [
      .heartRate, .activeEnergyBurned, .distanceWalkingRunning, .distanceCycling, .distanceSwimming,
    ]
    for id in quantities {
      if let type = HKObjectType.quantityType(forIdentifier: id) { types.insert(type) }
    }
    return types
  }

  /// Shows iOS's Health sheet the first time; afterwards returns at once.
  private func requestAccess() async throws {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      store.requestAuthorization(toShare: shareTypes, read: readTypes) { _, error in
        if let error = error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  // ── The watch ─────────────────────────────────────────────────────────────

  /// Wakes Plato's watch app into a session of this kind. False when there's
  /// no watch to wake — none paired, or not on a wrist.
  private func startWatchWorkout(kind: String, indoor: Bool, poolMetres: Double) async throws -> Bool {
    guard HKHealthStore.isHealthDataAvailable() else { return false }
    let configuration = Self.configuration(kind: kind, indoor: indoor, poolMetres: poolMetres)
    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
      store.startWatchApp(toHandle: configuration) { started, error in
        if let error = error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: started)
        }
      }
    }
  }

  /// The same mapping as the watch's CardioKind.configuration — two copies,
  /// because the phone and the watch are separate apps; keep them matching.
  private static func configuration(kind: String, indoor: Bool, poolMetres: Double) -> HKWorkoutConfiguration {
    let configuration = HKWorkoutConfiguration()
    switch kind {
    case "walk": configuration.activityType = .walking
    case "hike": configuration.activityType = .hiking
    case "bike": configuration.activityType = .cycling
    case "swim": configuration.activityType = .swimming
    case "row": configuration.activityType = .rowing
    case "elliptical": configuration.activityType = .elliptical
    case "stairs": configuration.activityType = .stairClimbing
    default: configuration.activityType = .running
    }
    if kind == "swim" {
      configuration.swimmingLocationType = indoor ? .pool : .openWater
      if indoor {
        configuration.lapLength = HKQuantity(unit: HKUnit.meter(), doubleValue: poolMetres > 0 ? poolMetres : 25)
      }
    } else {
      configuration.locationType = indoor ? .indoor : .outdoor
    }
    return configuration
  }
}
