const fs = require("fs");
const path = require("path");

const { withDangerousMod } = require("expo/config-plugins");

/**
 * Changes the home screen icon without the system alert.
 *
 * Picking an accent also swaps the app icon, and iOS answers every icon change
 * with "You have changed the icon for Plato" — presented by the system, from
 * inside `setAlternateIconName`, with no public way to opt out. Flipping through
 * seven swatches meant seven alerts to dismiss.
 *
 * The only lever is that the alert is presented into *our* app, through
 * `UIViewController.present(_:animated:completion:)` like any other. So that
 * method is swizzled, and for a one-second window around the icon change a
 * single UIAlertController is swallowed. The icon still changes — only the
 * confirmation is dropped.
 *
 * What this is not: `_setAlternateIconName:` and friends are private API and
 * would risk the binary being rejected outright. Nothing here calls anything
 * private; it intercepts our own view controller presenting our own alert.
 *
 * Two deliberate limits on the blast radius:
 *
 *  - Only a UIAlertController is ever swallowed, and only one.
 *  - The window disarms itself after a second whether or not the alert arrived.
 *    Leaving it armed would mean the *next* alert the app shows — a delete
 *    confirmation, say — silently never appearing.
 *
 * The trade this carries: it is an unsanctioned use of a sanctioned API, so a
 * future iOS could present the alert by some other route and it would simply
 * stop working. The failure mode is the alert coming back, not a crash.
 */

const MODULE = "expo-alternate-app-icons/ios/ExpoAlternateAppIconsModule.swift";

/** Marker that says the file already carries the patch. */
const APPLIED = "PlatoSilentIconChange";

const IMPORT_ANCHOR = `import ExpoModulesCore`;
const IMPORT_PATCHED = `import ExpoModulesCore
import ObjectiveC
import UIKit`;

const CALL_ANCHOR = `            do {
                try await UIApplication.shared.setAlternateIconName(icon);`;
const CALL_PATCHED = `            do {
                PlatoSilentIconChange.begin()
                try await UIApplication.shared.setAlternateIconName(icon);`;

const HELPER = `

// ── Plato ────────────────────────────────────────────────────────────────────
// Added by plugins/with-silent-icon-change.js — see that file for the why.

@MainActor
enum PlatoSilentIconChange {
    private static var armed = false

    private static let install: Void = {
        guard
            let original = class_getInstanceMethod(
                UIViewController.self,
                #selector(UIViewController.present(_:animated:completion:))
            ),
            let replacement = class_getInstanceMethod(
                UIViewController.self,
                #selector(UIViewController.plato_present(_:animated:completion:))
            )
        else { return }
        method_exchangeImplementations(original, replacement)
    }()

    /// Swallow the next alert, for one second.
    static func begin() {
        _ = install
        armed = true
        // A Task rather than DispatchQueue.asyncAfter so the disarm stays on the
        // main actor: \`armed\` is isolated to it, and a bare dispatch closure
        // touching it is a data race the compiler is entitled to reject.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            armed = false
        }
    }

    static func shouldSwallow(_ presented: UIViewController) -> Bool {
        guard armed, presented is UIAlertController else { return false }
        armed = false
        return true
    }
}

extension UIViewController {
    @objc fileprivate func plato_present(
        _ viewControllerToPresent: UIViewController,
        animated: Bool,
        completion: (() -> Void)?
    ) {
        if PlatoSilentIconChange.shouldSwallow(viewControllerToPresent) {
            completion?()
            return
        }
        // Not recursion: the implementations were exchanged, so this call lands
        // on the original present(_:animated:completion:).
        self.plato_present(viewControllerToPresent, animated: animated, completion: completion)
    }
}
`;

/** Exported for the unit test, which runs it over the real installed source. */
function patchSource(source) {
  if (source.includes(APPLIED)) return source;

  for (const [what, anchor] of [
    ["the ObjectiveC import", IMPORT_ANCHOR],
    ["the setAlternateIconName call", CALL_ANCHOR],
  ]) {
    if (!source.includes(anchor)) {
      throw new Error(
        `[with-silent-icon-change] could not find ${what} in ${MODULE}. ` +
          `expo-alternate-app-icons has probably changed — re-read that file and ` +
          `update the anchors. Failing here rather than shipping a build where ` +
          `every accent tap raises an alert again.`
      );
    }
  }

  return source.replace(IMPORT_ANCHOR, IMPORT_PATCHED).replace(CALL_ANCHOR, CALL_PATCHED) + HELPER;
}

module.exports = function withSilentIconChange(config) {
  // The Swift is a Pod source read straight out of node_modules, so this patches
  // it there rather than in the generated project — before `pod install`, which
  // is what a dangerous mod gets. `npm ci` re-installs it clean on CI every
  // time, so there is nothing to undo between builds.
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const file = path.join(cfg.modRequest.projectRoot, "node_modules", MODULE);

      if (!fs.existsSync(file)) {
        throw new Error(`[with-silent-icon-change] ${MODULE} not found at ${file}.`);
      }

      const source = fs.readFileSync(file, "utf8");
      const patched = patchSource(source);
      if (patched !== source) fs.writeFileSync(file, patched);

      return cfg;
    },
  ]);
};

module.exports.patchSource = patchSource;
module.exports.MODULE = MODULE;
module.exports.APPLIED = APPLIED;
