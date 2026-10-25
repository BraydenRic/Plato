import Foundation
import WatchConnectivity

/// The watch's end of the link to the phone (modules/plato-watch on the
/// other side). Callbacks arrive on the main thread.
final class PhoneLink: NSObject, WCSessionDelegate {
  var onSnapshot: ((String) -> Void)?
  var onReady: (() -> Void)?

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  var isActivated: Bool {
    WCSession.default.activationState == .activated
  }

  /// Asks the phone for its newest snapshot instead of waiting for the next
  /// change to bring one.
  func requestSnapshot() {
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return }
    session.sendMessage(["kind": "hello"], replyHandler: { [weak self] reply in
      guard let json = reply["snapshot"] as? String, !json.isEmpty else { return }
      DispatchQueue.main.async { self?.onSnapshot?(json) }
    }, errorHandler: { _ in })
  }

  /// A tracked session's live numbers, while the phone is in reach. Not an
  /// op: nothing to store, nothing to retry — the next one is seconds away.
  func sendLive(_ json: String) {
    let session = WCSession.default
    guard session.activationState == .activated, session.isReachable else { return }
    session.sendMessage(["kind": "live", "live": json], replyHandler: nil, errorHandler: { _ in })
  }

  /// Sends one op. `completion(true)` once the phone has it on disk, or once
  /// the system has queued it for delivery — which survives this app closing.
  ///
  /// A message gets an answer, and wakes the phone app if it isn't running,
  /// so that's tried first. When the phone is out of reach the op goes in the
  /// system queue instead, unless `allowQueue` is false: that's for a start,
  /// which is pointless if it lands an hour later.
  ///
  /// Each way keeps its own order, but nothing orders one against the other,
  /// so once anything is waiting in the queue, everything after it goes the
  /// same way. Otherwise a Finish sent as a message could reach the phone
  /// before the sets queued ahead of it.
  ///
  /// A start, which can't be queued, isn't sent past the queue either: it
  /// would land before a finish still waiting there, find the old workout
  /// running, and be dropped without a word. It fails instead, and the watch
  /// says it couldn't reach the phone, to try again once it's caught up.
  func send(opId: String, json: String, allowQueue: Bool, completion: @escaping (Bool) -> Void) {
    let session = WCSession.default
    guard session.activationState == .activated, allowQueue || session.outstandingUserInfoTransfers.isEmpty else {
      completion(false)
      return
    }
    let payload: [String: Any] = ["opId": opId, "op": json]
    let fallBack: () -> Void = {
      if allowQueue {
        session.transferUserInfo(payload)
        completion(true)
      } else {
        completion(false)
      }
    }
    guard session.isReachable, !(allowQueue && !session.outstandingUserInfoTransfers.isEmpty) else {
      fallBack()
      return
    }
    session.sendMessage(payload, replyHandler: { reply in
      let stored = reply["ok"] as? Bool ?? false
      DispatchQueue.main.async {
        if stored {
          completion(true)
        } else {
          fallBack()
        }
      }
    }, errorHandler: { _ in
      DispatchQueue.main.async { fallBack() }
    })
  }

  // MARK: WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    let context = session.receivedApplicationContext
    DispatchQueue.main.async {
      if let json = context["snapshot"] as? String { self.onSnapshot?(json) }
      self.onReady?()
    }
  }

  /// The same snapshot, sent as a message while this app is open so it
  /// arrives straight away rather than when the system delivers the context.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let json = message["snapshot"] as? String else { return }
    DispatchQueue.main.async { self.onSnapshot?(json) }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    guard let json = applicationContext["snapshot"] as? String else { return }
    DispatchQueue.main.async { self.onSnapshot?(json) }
  }

  /// A queued op that failed on the way goes back in the queue. The op was
  /// marked delivered when it was queued, so nothing else would send it again.
  func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
    guard error != nil else { return }
    session.transferUserInfo(userInfoTransfer.userInfo)
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    DispatchQueue.main.async { self.onReady?() }
  }
}
