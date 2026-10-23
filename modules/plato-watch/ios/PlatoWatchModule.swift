import ExpoModulesCore

private let onInbox = "onInbox"

public class PlatoWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlatoWatch")

    Events(onInbox)

    OnCreate {
      // The app delegate has normally started it already; this covers a launch
      // where it hasn't.
      PlatoWatchSession.shared.start()
    }

    OnStartObserving(onInbox) {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.inboxDidChange),
        name: PlatoWatchSession.inboxChanged,
        object: nil
      )
    }

    OnStopObserving(onInbox) {
      NotificationCenter.default.removeObserver(self, name: PlatoWatchSession.inboxChanged, object: nil)
    }

    Function("updateContext") { (json: String) in
      PlatoWatchSession.shared.updateContext(json)
    }

    Function("takeInbox") { () -> [[String: String]] in
      return PlatoWatchSession.shared.inboxEntries()
    }

    Function("ackInbox") { (ids: [String]) in
      PlatoWatchSession.shared.removeFromInbox(ids)
    }
  }

  @objc func inboxDidChange() {
    sendEvent(onInbox, [:])
  }
}
