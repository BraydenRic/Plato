import Foundation

// The pure half of cardio tracking: what each kind of session is, the record
// of distance against time kept as it goes, and how its numbers read. No
// HealthKit here, so the logic tests can build it anywhere (see
// scripts/watch-logic-tests).

/// The kinds of session, matching src/lib/cardio-session.ts — raw values and
/// names are the contract; change one, change both.
enum CardioKind: String, CaseIterable, Codable, Identifiable {
  case run, walk, hike, bike, swim, row, elliptical, stairs

  var id: String { rawValue }

  var label: String {
    switch self {
    case .run: return "Run"
    case .walk: return "Walk"
    case .hike: return "Hike"
    case .bike: return "Bike"
    case .swim: return "Swim"
    case .row: return "Row"
    case .elliptical: return "Elliptical"
    case .stairs: return "Stairs"
    }
  }

  /// Indoors or out — the usual one first. A rower is only ever in.
  var places: [Bool] {
    switch self {
    case .run, .walk, .bike: return [false, true]
    case .hike: return [false]
    case .swim: return [true, false]
    case .row, .elliptical, .stairs: return [true]
    }
  }

  /// What it's saved as, the Workout app's names.
  func name(indoor: Bool) -> String {
    switch self {
    case .run: return indoor ? "Indoor Run" : "Outdoor Run"
    case .walk: return indoor ? "Indoor Walk" : "Outdoor Walk"
    case .hike: return "Hike"
    case .bike: return indoor ? "Indoor Cycle" : "Outdoor Cycle"
    case .swim: return indoor ? "Pool Swim" : "Open Water Swim"
    case .row: return "Indoor Row"
    case .elliptical: return "Elliptical"
    case .stairs: return "Stair Stepper"
    }
  }

  func placeLabel(indoor: Bool) -> String {
    if self == .swim { return indoor ? "Pool" : "Open Water" }
    return indoor ? "Indoor" : "Outdoor"
  }

  func symbol(indoor: Bool) -> String {
    switch self {
    case .run: return "figure.run"
    case .walk: return "figure.walk"
    case .hike: return "figure.hiking"
    case .bike: return indoor ? "figure.indoor.cycle" : "figure.outdoor.cycle"
    case .swim: return indoor ? "figure.pool.swim" : "figure.open.water.swim"
    case .row: return "figure.rower"
    case .elliptical: return "figure.elliptical"
    case .stairs: return "figure.stair.stepper"
    }
  }

  /// Distance the watch itself can measure. A rower's and an elliptical's
  /// "distance" is the machine's to tell; a stair stepper has none.
  var tracksDistance: Bool {
    switch self {
    case .run, .walk, .hike, .bike, .swim: return true
    case .row, .elliptical, .stairs: return false
    }
  }

  /// A mile or a kilometre at a time is how these are compared.
  var hasSplits: Bool {
    switch self {
    case .run, .walk, .hike, .bike: return true
    default: return false
    }
  }
}

/// Distance against moving time, kept as the session goes, for the phone to
/// work splits and records out of. A point each time the distance has moved on
/// far enough to matter, so an hour's run is a thousand points, not a million.
struct CurveRecorder: Codable, Equatable {
  private(set) var metres: [Double] = [0]
  private(set) var seconds: [Double] = [0]

  /// How far between points. GPS is honest to about this much anyway.
  static let spacing: Double = 10

  var lastMetres: Double { metres[metres.count - 1] }
  var lastSeconds: Double { seconds[seconds.count - 1] }

  mutating func record(metres m: Double, seconds s: Double) {
    guard m.isFinite, s.isFinite, m >= 0, s >= 0, m - lastMetres >= Self.spacing else { return }
    metres.append(m)
    // Never backwards, whatever the clock it's read against says.
    seconds.append(max(s, lastSeconds))
  }

  /// The session's last reading, however close to the one before: the total
  /// has to be in the record, or the last stretch goes missing from splits.
  mutating func close(metres m: Double, seconds s: Double) {
    guard m.isFinite, s.isFinite, m > lastMetres else { return }
    metres.append(m)
    seconds.append(max(s, lastSeconds))
  }

  /// Flat — metres, seconds, metres, seconds… — and at most `limit` points:
  /// evenly thinned, the first and last always kept, so a marathon still fits
  /// in one message.
  ///
  /// Rounded to a tenth: GPS is honest to metres, not micrometres, and
  /// seventeen digits a number would make a marathon's record too big for one
  /// message.
  func flat(limit: Int = 1200) -> [Double] {
    let count = metres.count
    let step = max(1, Int((Double(count) / Double(max(limit - 1, 1))).rounded(.up)))
    let tenth = { (value: Double) in (value * 10).rounded() / 10 }
    var out: [Double] = []
    var i = 0
    while i < count {
      out.append(tenth(metres[i]))
      out.append(tenth(seconds[i]))
      i += step
    }
    if (count - 1) % step != 0 {
      out.append(tenth(metres[count - 1]))
      out.append(tenth(seconds[count - 1]))
    }
    return out
  }

  /// Seconds for each whole `unitMetres` so far — the phone's splits, done
  /// live, so the watch can show the mile you just finished.
  func splits(unitMetres: Double) -> [Double] {
    var out: [Double] = []
    var previous = 0.0
    var target = unitMetres
    var i = 1
    while i < metres.count {
      if metres[i] >= target {
        let span = metres[i] - metres[i - 1]
        let at = span > 0
          ? seconds[i - 1] + (target - metres[i - 1]) / span * (seconds[i] - seconds[i - 1])
          : seconds[i]
        out.append(at - previous)
        previous = at
        // The same stretch can cross more than one: don't move on yet.
        target += unitMetres
      } else {
        i += 1
      }
    }
    return out
  }
}

/// How a session's numbers read, in the unit the weight setting implies —
/// miles for lbs, kilometres for kg — as on the phone.
enum CardioFormat {
  static let mile = 1609.344
  static let yard = 0.9144

  /// The length one "unit" of distance is: a mile, a kilometre — or, in the
  /// pool, a hundred yards or metres, since that's what swims are read by.
  static func unitMetres(kind: CardioKind, weightUnit: String) -> Double {
    if kind == .swim { return weightUnit == "kg" ? 1 : yard }
    return weightUnit == "kg" ? 1000 : mile
  }

  static func unitLabel(kind: CardioKind, weightUnit: String) -> String {
    if kind == .swim { return weightUnit == "kg" ? "M" : "YD" }
    return weightUnit == "kg" ? "KM" : "MI"
  }

  /// "2.31" — two places in miles and kilometres, whole yards and metres.
  static func distance(_ metres: Double, kind: CardioKind, weightUnit: String) -> String {
    let value = metres / unitMetres(kind: kind, weightUnit: weightUnit)
    return kind == .swim ? String(Int(value.rounded())) : String(format: "%.2f", value)
  }

  /// "8:12 /MI" on foot, "15.2 MPH" on a bike, "1:45 /100YD" in the pool.
  /// Nil until there's enough of both to say.
  static func rate(metres: Double, seconds: Double, kind: CardioKind, weightUnit: String) -> String? {
    guard metres > 10, seconds > 0 else { return nil }
    let unit = rateUnit(kind: kind, weightUnit: weightUnit)
    switch kind {
    case .bike:
      let perHour = (metres / unitMetres(kind: kind, weightUnit: weightUnit)) / (seconds / 3600)
      return String(format: "%.1f %@", perHour, unit)
    case .swim:
      let per100 = seconds / (metres / unitMetres(kind: kind, weightUnit: weightUnit) / 100)
      return "\(Logbook.clock(Int(per100.rounded()))) \(unit)"
    default:
      let perUnit = seconds / (metres / unitMetres(kind: kind, weightUnit: weightUnit))
      return "\(Logbook.clock(Int(perUnit.rounded()))) \(unit)"
    }
  }

  /// What a pace or speed is per: "/MI", "MPH", "/100YD".
  static func rateUnit(kind: CardioKind, weightUnit: String) -> String {
    switch kind {
    case .bike: return weightUnit == "kg" ? "KM/H" : "MPH"
    case .swim: return "/100\(unitLabel(kind: kind, weightUnit: weightUnit))"
    default: return "/\(unitLabel(kind: kind, weightUnit: weightUnit))"
    }
  }

  /// A rate as a number and its unit, for two sizes of type — or, before
  /// there's enough to say, dashes in the number's place, so the figure is
  /// on the screen from the first second rather than appearing later.
  static func rateParts(_ rate: String?, kind: CardioKind, weightUnit: String) -> (value: String, unit: String) {
    if let rate, let space = rate.firstIndex(of: " ") {
      return (String(rate[..<space]), String(rate[rate.index(after: space)...]))
    }
    return (kind == .bike ? "--.-" : "--:--", rateUnit(kind: kind, weightUnit: weightUnit))
  }
}
