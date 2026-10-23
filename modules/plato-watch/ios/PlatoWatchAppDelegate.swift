import ExpoModulesCore

/**
 Starts the watch session as the app launches.

 When the watch sends a set while this app isn't running, iOS launches it in
 the background to deliver the message — and it can only be delivered to a
 session that is already active. Waiting for the module to be created by
 JavaScript would be too late for that first message.
 */
public class PlatoWatchAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    PlatoWatchSession.shared.start()
    return true
  }
}
