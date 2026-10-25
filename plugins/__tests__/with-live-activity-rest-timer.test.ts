import fs from "fs";
import os from "os";
import path from "path";

/**
 * The Swift patches, run over expo-live-activity's real widget sources.
 *
 * None of this can be seen working short of a device build: the widget runs in
 * its own process on the lock screen. What can be checked here is that every
 * anchor still matches the pinned upstream files, and that the tap URL gets a
 * scheme — without one the widget silently attaches no link at all.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchWidgetSources } = require("../with-live-activity-rest-timer") as {
  patchWidgetSources: (widgetDir: string, scheme: unknown) => void;
};

const UPSTREAM = path.join(__dirname, "..", "..", "node_modules", "expo-live-activity", "ios-files");

let widgetDir: string;
beforeEach(() => {
  // What prebuild leaves in ios/LiveActivity before this plugin runs.
  widgetDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-activity-"));
  for (const file of fs.readdirSync(UPSTREAM).filter((name) => name.endsWith(".swift"))) {
    fs.copyFileSync(path.join(UPSTREAM, file), path.join(widgetDir, file));
  }
});
afterEach(() => fs.rmSync(widgetDir, { recursive: true, force: true }));

const read = (file: string) => fs.readFileSync(path.join(widgetDir, file), "utf8");

it("gives the widget the app's scheme, which it can't find in its own bundle", () => {
  patchWidgetSources(widgetDir, "plato");

  const source = read("View+applyWidgetURL.swift");
  expect(source).toContain('private let cachedScheme: String? = "plato"');
  expect(source).not.toContain("Bundle.main.infoDictionary");
  // The URL is still built the way upstream builds it: plato:///workout/<id>.
  expect(source).toContain('URL(string: scheme + "://" + string)');
});

it("still applies both timer patches to the current upstream files", () => {
  patchWidgetSources(widgetDir, "plato");

  expect(read("LiveActivityMediumView.swift")).toContain("restEndDate");
  expect(read("LiveActivityWidget.swift")).toContain("Rest wins the island");
});

it("can run again over files it already patched, as prebuild does", () => {
  patchWidgetSources(widgetDir, "plato");
  const once = ["View+applyWidgetURL.swift", "LiveActivityMediumView.swift", "LiveActivityWidget.swift"].map(read);

  patchWidgetSources(widgetDir, "plato");

  expect(["View+applyWidgetURL.swift", "LiveActivityMediumView.swift", "LiveActivityWidget.swift"].map(read)).toEqual(
    once
  );
});

it("fails the build rather than ship a widget with nowhere to link", () => {
  expect(() => patchWidgetSources(widgetDir, undefined)).toThrow(/scheme/);
});
