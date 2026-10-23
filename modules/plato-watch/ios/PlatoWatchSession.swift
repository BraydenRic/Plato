import Foundation
import WatchConnectivity

/**
 The phone's end of the link to the watch app.

 Native rather than JavaScript-only because of when the watch talks to us.
 A set logged on the watch wakes this app in the background, and the message
 arrives during launch — well before React has mounted anything that could
 listen for it. So whatever arrives is written to disk here first, and the
 watch is only told "got it" after that write. JavaScript then drains the
 inbox when it's ready (see src/components/watch-sync.tsx) and removes what it
 has applied, so nothing the watch logged depends on JavaScript being awake at
 the moment it was sent.
 */
final class PlatoWatchSession: NSObject, WCSessionDelegate {
  static let shared = PlatoWatchSession()
  static let inboxChanged = Notification.Name("PlatoWatchInboxChanged")

  private let queue = DispatchQueue(label: "com.plato.workouts.watch-session")
  private let inboxKey = "plato.watch.inbox.v1"
  /** Far more than a session produces; only here so a phone signed out for weeks can't grow it forever. */
  private let inboxLimit = 500
  private var started = false
  /** The newest snapshot JavaScript asked to send, kept until the watch side can take it. */
  private var pendingContext: String?
  /** The newest snapshot sent, for a watch that asks for it directly. */
  private var lastContext: String?

  func start() {
    guard WCSession.isSupported() else { return }
    let shouldStart: Bool = queue.sync {
      if started { return false }
      started = true
      return true
    }
    guard shouldStart else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  // MARK: Phone → watch

  func updateContext(_ json: String) {
    guard WCSession.isSupported() else { return }
    start()
    queue.async {
      self.pendingContext = json
      self.lastContext = json
      self.flushContext()
    }
  }

  /** Must run on `queue`. */
  private func flushContext() {
    guard let json = pendingContext else { return }
    let session = WCSession.default
    // Not paired, or the watch app isn't installed: nothing to send to yet.
    // The snapshot stays pending and goes out from sessionWatchStateDidChange
    // once it is.
    guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    do {
      try session.updateApplicationContext(["snapshot": json])
      pendingContext = nil
    } catch {
      // Left pending; the next change, or the next state change, retries it.
    }
  }

  // MARK: Watch → phone

  func inboxEntries() -> [[String: String]] {
    return queue.sync { loadInbox() }
  }

  func removeFromInbox(_ ids: [String]) {
    let done = Set(ids)
    queue.sync {
      var entries = loadInbox()
      entries.removeAll { done.contains($0["id"] ?? "") }
      saveInbox(entries)
    }
  }

  /** Stores one op from the watch. Returns whether it was well-formed. */
  private func receive(_ payload: [String: Any]) -> Bool {
    guard let opId = payload["opId"] as? String, !opId.isEmpty,
          let op = payload["op"] as? String, !op.isEmpty else { return false }
    queue.sync {
      var entries = loadInbox()
      // The watch resends anything it didn't hear back about, so the same op
      // can arrive twice. Once is enough.
      if !entries.contains(where: { $0["id"] == opId }) {
        entries.append(["id": opId, "json": op])
        if entries.count > inboxLimit {
          entries.removeFirst(entries.count - inboxLimit)
        }
        saveInbox(entries)
      }
    }
    DispatchQueue.main.async {
      NotificationCenter.default.post(name: PlatoWatchSession.inboxChanged, object: nil)
    }
    return true
  }

  private func loadInbox() -> [[String: String]] {
    return UserDefaults.standard.array(forKey: inboxKey) as? [[String: String]] ?? []
  }

  private func saveInbox(_ entries: [[String: String]]) {
    UserDefaults.standard.set(entries, forKey: inboxKey)
  }

  // MARK: WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    queue.async { self.flushContext() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Switching to another watch deactivates the session; activating again
    // connects it to the new one.
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    queue.async { self.flushContext() }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    if message["kind"] as? String == "hello" {
      // A watch app that just opened asks for the latest state straight away
      // rather than waiting on the next change.
      // Before JavaScript has sent one this launch, the session still holds
      // the last snapshot from the previous launch.
      let snapshot: String? = queue.sync { lastContext } ?? session.applicationContext["snapshot"] as? String
      replyHandler(["snapshot": snapshot ?? ""])
      return
    }
    replyHandler(["ok": receive(message)])
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    _ = receive(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    _ = receive(userInfo)
  }
}
