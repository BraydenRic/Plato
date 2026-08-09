import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../with-silent-icon-change");
const { patchSource, MODULE, APPLIED } = plugin as {
  patchSource: (source: string) => string;
  MODULE: string;
  APPLIED: string;
};

/**
 * The icon-alert patch, checked against the real installed Swift.
 *
 * This exists because the patch is anchored to source that belongs to someone
 * else. If expo-alternate-app-icons is ever upgraded and the anchors stop
 * matching, the right outcome is a red test here — the alternative is finding
 * out from a build failure on CI, or worse, from an alert reappearing on a
 * phone. Nothing else in the suite can see Swift at all.
 */

const installed = () =>
  fs.readFileSync(path.join(__dirname, "..", "..", "node_modules", MODULE), "utf8");

describe("the installed module", () => {
  it("is still the file the patch expects", () => {
    // Not a snapshot of the whole file — just the two things anchored to.
    const source = installed();
    expect(source).toContain("import ExpoModulesCore");
    expect(source).toContain("try await UIApplication.shared.setAlternateIconName(icon);");
  });

  it("has not already been patched in the checked-out tree", () => {
    // node_modules is reinstalled clean on CI, so a marker here means a local
    // prebuild wrote into it and the working copy is no longer pristine.
    expect(installed()).not.toContain(APPLIED);
  });
});

describe("patchSource", () => {
  it("arms the suppression before the icon actually changes", () => {
    // Ordering is the whole trick: armed after the call, the alert is already
    // on its way and gets through.
    const out = patchSource(installed());
    const armed = out.indexOf("PlatoSilentIconChange.begin()");
    const changed = out.indexOf("try await UIApplication.shared.setAlternateIconName(icon);");
    expect(armed).toBeGreaterThan(-1);
    expect(armed).toBeLessThan(changed);
  });

  it("still changes the icon", () => {
    // The point is to drop the confirmation, not the icon change with it.
    expect(patchSource(installed())).toContain(
      "try await UIApplication.shared.setAlternateIconName(icon);"
    );
  });

  it("brings in the runtime it swizzles with", () => {
    expect(patchSource(installed())).toContain("import ObjectiveC");
  });

  it("only ever swallows an alert, and only while armed", () => {
    // The guard that keeps this from eating a delete confirmation.
    const out = patchSource(installed());
    expect(out).toContain("guard armed, presented is UIAlertController else { return false }");
  });

  it("disarms itself even if no alert arrives", () => {
    // Otherwise the window stays open and the next unrelated alert is the one
    // that vanishes.
    const out = patchSource(installed());
    expect(out).toContain("Task.sleep(nanoseconds: 1_000_000_000)");
    expect(out).toContain("armed = false");
  });

  it("keeps the disarm on the main actor", () => {
    // `armed` is MainActor-isolated, so the timer that clears it has to be too
    // — a bare dispatch closure touching it is a data race the Swift compiler
    // is entitled to reject, and the compiler here is on a CI runner.
    const out = patchSource(installed());
    expect(out).toContain("Task { @MainActor in");
    expect(out).not.toContain("DispatchQueue.main.asyncAfter");
  });

  it("is safe to run twice, because prebuild re-runs", () => {
    const once = patchSource(installed());
    expect(patchSource(once)).toBe(once);
  });

  it("refuses to patch source it doesn't recognise", () => {
    // Loud rather than silent: a quietly skipped patch ships a build where
    // every accent tap raises an alert again.
    expect(() => patchSource("import ExpoModulesCore\n// nothing else\n")).toThrow(
      /setAlternateIconName call/
    );
    expect(() => patchSource("// no imports at all\n")).toThrow(/ObjectiveC import/);
  });

  it("names the likely cause in the error, since it is someone else's file", () => {
    expect(() => patchSource("// no imports at all\n")).toThrow(/expo-alternate-app-icons/);
  });
});
