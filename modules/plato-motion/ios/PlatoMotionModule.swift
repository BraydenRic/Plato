import CoreMotion
import ExpoModulesCore

// The iPhone's step counter, for cardio sessions run with just a phone.
//
// The motion coprocessor counts steps all day whether Plato is open or not,
// and turns them into distance with a stride it calibrates against GPS on
// earlier walks and runs. So a session's distance is read back from it rather
// than measured by Plato: live while the screen is on, for the figure under
// the clock, and per minute when the session ends, for the distance it's
// saved with and its splits. Nothing here needs Plato to stay awake, and no
// location is involved.
public class PlatoMotionModule: Module {
  private let pedometer = CMPedometer()

  public func definition() -> ModuleDefinition {
    Name("PlatoMotion")

    Events("onDistance")

    Function("isAvailable") { () -> Bool in
      return CMPedometer.isDistanceAvailable()
    }

    Function("authorization") { () -> String in
      switch CMPedometer.authorizationStatus() {
      case .authorized: return "authorized"
      case .denied: return "denied"
      case .restricted: return "restricted"
      case .notDetermined: return "notDetermined"
      @unknown default: return "notDetermined"
      }
    }

    // Metres walked or run in each window, flat — from, to, from, to… in
    // epoch milliseconds — in the order given. Throws if the step counter
    // won't answer (Motion & Fitness turned off for Plato); the first time,
    // asking is what shows iOS's permission sheet.
    AsyncFunction("distances") { (windows: [Double]) async throws -> [Double] in
      var metres: [Double] = []
      var i = 0
      while i + 1 < windows.count {
        metres.append(try await self.distance(fromMs: windows[i], toMs: windows[i + 1]))
        i += 2
      }
      return metres
    }

    // Distance since `fromMs`, sent as onDistance every few seconds while
    // Plato is open. Starting again replaces whatever was running.
    Function("startUpdates") { (fromMs: Double) in
      self.pedometer.stopUpdates()
      self.pedometer.startUpdates(from: Date(timeIntervalSince1970: fromMs / 1000)) { [weak self] data, error in
        guard let self else { return }
        if let error = error {
          self.sendEvent("onDistance", ["error": (error as NSError).code])
          return
        }
        guard let data = data else { return }
        self.sendEvent("onDistance", [
          "distance": data.distance?.doubleValue ?? 0,
          "at": data.endDate.timeIntervalSince1970 * 1000,
        ])
      }
    }

    Function("stopUpdates") {
      self.pedometer.stopUpdates()
    }
  }

  private func distance(fromMs: Double, toMs: Double) async throws -> Double {
    let from = Date(timeIntervalSince1970: fromMs / 1000)
    let to = Date(timeIntervalSince1970: toMs / 1000)
    return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Double, Error>) in
      pedometer.queryPedometerData(from: from, to: to) { data, error in
        if let error = error {
          continuation.resume(throwing: error)
        } else {
          // No data for a window is a window with no steps in it.
          continuation.resume(returning: data?.distance?.doubleValue ?? 0)
        }
      }
    }
  }
}
