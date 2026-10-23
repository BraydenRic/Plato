/**
 * The Apple Watch app — a logger for the workout in progress, and a list of
 * templates to start one when nothing is running. It is not the whole app: the
 * phone stays the source of truth and the watch only ever talks to the phone
 * (see src/components/watch-sync.tsx), never to Firestore.
 *
 * Everything in this folder except this file and Info.plist is compiled into
 * the watch target, so keep it to Swift sources.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "watch",
  name: "PlatoWatch",
  displayName: "Plato",
  // com.plato.workouts.watchkitapp — Apple expects the watch app's id to sit
  // under the phone app's.
  bundleIdentifier: ".watchkitapp",
  // Series 6 and later, SE (2nd gen), every Ultra — and the first release with
  // double tap's handGestureShortcut, so it needs no version fencing.
  deploymentTarget: "11.0",
  icon: "../../assets/watch/icon.png",
  frameworks: ["SwiftUI", "WatchConnectivity"],
  images: {
    logo: "../../assets/images/splash-icon.png",
  },
});
