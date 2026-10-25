import ExpoModulesCore

private let onInbox = "onInbox"
private let onLive = "onLive"

public class PlatoWatchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlatoWatch")

    Events(onInbox, onLive)

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

    OnStartObserving(onLive) {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.liveDidArrive(_:)),
        name: PlatoWatchSession.liveReceived,
        object: nil
      )
    }

    OnStopObserving(onLive) {
      NotificationCenter.default.removeObserver(self, name: PlatoWatchSession.liveReceived, object: nil)
    }

    Function("isWatchAppInstalled") { () -> Bool in
      return PlatoWatchSession.shared.watchAppInstalled()
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

  @objc func liveDidArrive(_ notification: Notification) {
    guard let json = notification.userInfo?["json"] as? String else { return }
    sendEvent(onLive, ["json": json])
  }
}
