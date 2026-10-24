/**
 * Plato as a watch face complication: the logo, one tap from the face to the
 * watch app. Complications are WidgetKit widgets, and on watchOS a widget has
 * to live in its own extension inside the watch app — it can't be part of the
 * app itself, hence this second target.
 *
 * Keep this folder to Swift sources and Info.plist, like targets/watch (see
 * the note there about privacy manifests).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "watch-widget",
  name: "PlatoComplication",
  displayName: "Plato",
  // Under the watch app's id, as Apple requires for anything embedded in it.
  // Not ".complication": Apple reserves <watch app id>.complication as the
  // push topic for complication updates, and won't register it as an App ID.
  bundleIdentifier: ".watchkitapp.widgets",
  deploymentTarget: "11.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  images: {
    // Its own small copy (80 px). Complications won't draw a large image —
    // the 512 px splash logo left the slot blank, as it once did the Live
    // Activity's.
    logo: "../../assets/watch/complication-logo.png",
  },
});
