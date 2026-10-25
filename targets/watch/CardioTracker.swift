import Combine
import Foundation
import HealthKit

/// A session's results, handed to the store when it ends.
struct CardioResult: Equatable {
  let kind: CardioKind
  let indoor: Bool
  let startedAt: Date
  /// Seconds moving, pauses left out.
  let duration: Int
  /// Metres; nil for kinds the watch can't measure the distance of.
  let distance: Double?
  let activeCalories: Double?
  let avgHeartRate: Double?
  let maxHeartRate: Double?
  /// The workout saved to Apple Health, if it saved.
  let healthId: String?
  let curve: [Double]
  let workoutId: String?
  let startOpId: String?
}

/// What a session's identity is, kept on disk while it runs so a relaunch
/// mid-run (the system can end the app; the workout session carries on)
/// still knows which Plato session it belongs to.
private struct TrackerIdentity: Codable {
  let kind: CardioKind
  let indoor: Bool
  let startOpId: String?
  var workoutId: String?
  let fromPhone: Bool
}

/// Tracks a cardio session with the watch's sensors: GPS, heart rate, energy.
///
/// Apple's workout session does the measuring and keeps the app running with
/// the screen down; this turns what it collects into the numbers on screen and
/// the record the phone gets at the end. Saved to Apple Health when it ends,
/// so it counts toward the Activity rings like any workout.
final class CardioTracker: NSObject, ObservableObject, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
  static let shared = CardioTracker()

  enum State: Equatable {
    case idle, starting, running, paused, ending
  }

  enum Event {
    case started
    case paused(Date)
    case resumed(Date)
    case finished(CardioResult)
    /// It never got going: Health said no, or the sensors couldn't start.
    case failed
  }

  @Published private(set) var state: State = .idle
  @Published private(set) var kind: CardioKind = .run
  @Published private(set) var indoor = false
  @Published private(set) var startedAt: Date?
  /// Metres.
  @Published private(set) var distance: Double = 0
  @Published private(set) var heartRate: Double?
  @Published private(set) var curve = CurveRecorder()
  /// The phone's id for this session, once known.
  @Published private(set) var workoutId: String?

  /// The start op's id, for a session started on the watch.
  private(set) var startOpId: String?
  /// Started by the phone waking the app, not from the watch's own picker.
  private(set) var fromPhone = false

  var onEvent: ((Event) -> Void)?

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var activeCalories: Double = 0
  private var avgHeartRate: Double?
  private var maxHeartRate: Double?
  private let identityKey = "plato.watch.cardio.v1"

  var isActive: Bool { state != .idle }

  /// Seconds moving at `date`, pauses left out — the workout builder keeps it.
  func elapsed(at date: Date) -> TimeInterval {
    return builder?.elapsedTime(at: date) ?? 0
  }

  // MARK: Starting

  /// From the watch's picker. `startOpId` is the op the phone hears about it by.
  func start(kind: CardioKind, indoor: Bool, startOpId: String?, linkTo workoutId: String? = nil) {
    begin(kind: kind, indoor: indoor, configuration: Self.configuration(kind: kind, indoor: indoor),
          startOpId: startOpId, workoutId: workoutId, fromPhone: workoutId != nil)
  }

  /// The phone started a session and woke this app to track it.
  func startFromPhone(_ configuration: HKWorkoutConfiguration) {
    let (kind, indoor) = Self.kind(of: configuration)
    begin(kind: kind, indoor: indoor, configuration: configuration, startOpId: nil, workoutId: nil, fromPhone: true)
  }

  private func begin(kind: CardioKind, indoor: Bool, configuration: HKWorkoutConfiguration,
                     startOpId: String?, workoutId: String?, fromPhone: Bool) {
    guard state == .idle else { return }
    state = .starting
    self.kind = kind
    self.indoor = indoor
    self.startOpId = startOpId
    self.workoutId = workoutId
    self.fromPhone = fromPhone
    distance = 0
    heartRate = nil
    curve = CurveRecorder()
    activeCalories = 0
    avgHeartRate = nil
    maxHeartRate = nil

    // Asks only the first time; the phone usually asked already, and the two
    // share Plato's Health access.
    healthStore.requestAuthorization(toShare: Self.shareTypes, read: Self.readTypes) { [weak self] _, _ in
      DispatchQueue.main.async { self?.open(configuration) }
    }
  }

  private func open(_ configuration: HKWorkoutConfiguration) {
    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
      session.delegate = self
      builder.delegate = self
      self.session = session
      self.builder = builder
      let start = Date()
      session.startActivity(with: start)
      builder.beginCollection(withStart: start) { _, _ in }
      startedAt = start
      state = .running
      saveIdentity()
      onEvent?(.started)
    } catch {
      reset()
      onEvent?(.failed)
    }
  }

  /// The app was relaunched while a session it started was still running.
  func recover() {
    healthStore.recoverActiveWorkoutSession { [weak self] session, _ in
      DispatchQueue.main.async {
        guard let self, let session else { return }
        let identity = self.loadIdentity()
        let builder = session.associatedWorkoutBuilder()
        session.delegate = self
        builder.delegate = self
        self.session = session
        self.builder = builder
        let (kind, indoor) = Self.kind(of: session.workoutConfiguration)
        self.kind = identity?.kind ?? kind
        self.indoor = identity?.indoor ?? indoor
        self.startOpId = identity?.startOpId
        self.workoutId = identity?.workoutId
        self.fromPhone = identity?.fromPhone ?? false
        self.startedAt = session.startDate ?? Date()
        self.state = session.state == .paused ? .paused : .running
        // The readings before the relaunch are gone from here; the distance
        // so far starts the record again, so splits carry on from it.
        self.curve = CurveRecorder()
        self.collect(from: builder)
      }
    }
  }

  /// The phone told us which of its sessions this is.
  func link(to workoutId: String) {
    guard self.workoutId == nil else { return }
    self.workoutId = workoutId
    saveIdentity()
  }

  // MARK: Pausing and ending

  func pause() {
    guard state == .running else { return }
    session?.pause()
  }

  func resume() {
    guard state == .paused else { return }
    session?.resume()
  }

  func end() {
    guard state == .running || state == .paused else { return }
    state = .ending
    session?.end()
  }

  // MARK: HKWorkoutSessionDelegate

  func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                      from fromState: HKWorkoutSessionState, date: Date) {
    DispatchQueue.main.async {
      switch toState {
      case .paused:
        self.state = .paused
        self.onEvent?(.paused(date))
      case .running where fromState == .paused:
        self.state = .running
        self.onEvent?(.resumed(date))
      case .ended:
        self.finish(at: date)
      default:
        break
      }
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    DispatchQueue.main.async {
      // Ended underneath us. If it got going, what it measured is still worth
      // sending; if not, there's nothing to keep.
      if self.startedAt != nil, self.state != .idle, self.state != .ending {
        self.state = .ending
        self.finish(at: Date())
      } else if self.state == .starting {
        self.reset()
        self.onEvent?(.failed)
      }
    }
  }

  // MARK: HKLiveWorkoutBuilderDelegate

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    DispatchQueue.main.async { self.collect(from: workoutBuilder) }
  }

  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  /// Reads the builder's running totals into what the screen shows and the
  /// curve the phone will get.
  private func collect(from builder: HKLiveWorkoutBuilder) {
    if let type = Self.distanceType(for: kind),
       let metres = builder.statistics(for: type)?.sumQuantity()?.doubleValue(for: HKUnit.meter()) {
      distance = metres
      curve.record(metres: metres, seconds: builder.elapsedTime(at: Date()))
    }
    if let type = HKObjectType.quantityType(forIdentifier: .heartRate), let stats = builder.statistics(for: type) {
      let bpm = HKUnit.count().unitDivided(by: HKUnit.minute())
      heartRate = stats.mostRecentQuantity()?.doubleValue(for: bpm) ?? heartRate
      avgHeartRate = stats.averageQuantity()?.doubleValue(for: bpm) ?? avgHeartRate
      maxHeartRate = stats.maximumQuantity()?.doubleValue(for: bpm) ?? maxHeartRate
    }
    if let type = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
       let kcal = builder.statistics(for: type)?.sumQuantity()?.doubleValue(for: HKUnit.kilocalorie()) {
      activeCalories = kcal
    }
  }

  private func finish(at date: Date) {
    guard let builder, let startedAt else {
      reset()
      return
    }
    collect(from: builder)
    let moving = Int(builder.elapsedTime(at: date))
    builder.endCollection(withEnd: date) { [weak self] _, _ in
      builder.finishWorkout { workout, _ in
        DispatchQueue.main.async {
          guard let self else { return }
          self.curve.close(metres: self.distance, seconds: Double(moving))
          let result = CardioResult(
            kind: self.kind,
            indoor: self.indoor,
            startedAt: startedAt,
            duration: moving,
            distance: self.kind.tracksDistance && self.distance > 0 ? self.distance : nil,
            activeCalories: self.activeCalories > 0 ? self.activeCalories : nil,
            avgHeartRate: self.avgHeartRate,
            maxHeartRate: self.maxHeartRate,
            healthId: workout?.uuid.uuidString,
            curve: self.kind.tracksDistance ? self.curve.flat() : [],
            workoutId: self.workoutId,
            startOpId: self.startOpId
          )
          self.reset()
          self.onEvent?(.finished(result))
        }
      }
    }
  }

  private func reset() {
    session = nil
    builder = nil
    startedAt = nil
    workoutId = nil
    startOpId = nil
    fromPhone = false
    state = .idle
    UserDefaults.standard.removeObject(forKey: identityKey)
  }

  // MARK: Identity on disk

  private func saveIdentity() {
    let identity = TrackerIdentity(kind: kind, indoor: indoor, startOpId: startOpId, workoutId: workoutId, fromPhone: fromPhone)
    if let data = try? JSONEncoder().encode(identity) {
      UserDefaults.standard.set(data, forKey: identityKey)
    }
  }

  private func loadIdentity() -> TrackerIdentity? {
    guard let data = UserDefaults.standard.data(forKey: identityKey) else { return nil }
    return try? JSONDecoder().decode(TrackerIdentity.self, from: data)
  }

  // MARK: HealthKit mapping

  static let shareTypes: Set<HKSampleType> = [HKObjectType.workoutType()]

  static var readTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = [HKObjectType.workoutType()]
    let quantities: [HKQuantityTypeIdentifier] = [
      .heartRate, .activeEnergyBurned, .distanceWalkingRunning, .distanceCycling, .distanceSwimming,
    ]
    for id in quantities {
      if let type = HKObjectType.quantityType(forIdentifier: id) { types.insert(type) }
    }
    return types
  }

  /// The same mapping as modules/plato-health on the phone; keep them matching.
  static func configuration(kind: CardioKind, indoor: Bool) -> HKWorkoutConfiguration {
    let configuration = HKWorkoutConfiguration()
    switch kind {
    case .run: configuration.activityType = .running
    case .walk: configuration.activityType = .walking
    case .hike: configuration.activityType = .hiking
    case .bike: configuration.activityType = .cycling
    case .swim: configuration.activityType = .swimming
    case .row: configuration.activityType = .rowing
    case .elliptical: configuration.activityType = .elliptical
    case .stairs: configuration.activityType = .stairClimbing
    }
    if kind == .swim {
      configuration.swimmingLocationType = indoor ? .pool : .openWater
      if indoor {
        configuration.lapLength = HKQuantity(unit: HKUnit.meter(), doubleValue: 25)
      }
    } else {
      configuration.locationType = indoor ? .indoor : .outdoor
    }
    return configuration
  }

  static func kind(of configuration: HKWorkoutConfiguration) -> (CardioKind, Bool) {
    let kind: CardioKind
    switch configuration.activityType {
    case .walking: kind = .walk
    case .hiking: kind = .hike
    case .cycling: kind = .bike
    case .swimming: kind = .swim
    case .rowing: kind = .row
    case .elliptical: kind = .elliptical
    case .stairClimbing: kind = .stairs
    default: kind = .run
    }
    let indoor = kind == .swim
      ? configuration.swimmingLocationType != .openWater
      : configuration.locationType == .indoor
    return (kind, indoor)
  }

  static func distanceType(for kind: CardioKind) -> HKQuantityType? {
    switch kind {
    case .run, .walk, .hike: return HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
    case .bike: return HKObjectType.quantityType(forIdentifier: .distanceCycling)
    case .swim: return HKObjectType.quantityType(forIdentifier: .distanceSwimming)
    case .row, .elliptical, .stairs: return nil
    }
  }
}
