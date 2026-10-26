import fs from "fs";
import os from "os";
import path from "path";

/**
 * The Live Activity extension's Info.plist, which has to carry the app's build
 * number. Nothing here can show the number itself, which EAS only writes in at
 * build time; the build log's "CFBundleVersion of an app extension" line going
 * away is the proof. What can be checked: generation goes off for this target
 * only, and the file left behind is a complete, valid plist with every key the
 * extension needs and the version keys left for EAS to fill.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useOwnInfoPlist, writeInfoPlist, INFO_PLIST } = require("../with-live-activity-plist") as {
  useOwnInfoPlist: (project: { pbxXCBuildConfigurationSection: () => Record<string, unknown> }, bundleIdentifier: string) => number;
  writeInfoPlist: (widgetDir: string) => void;
  INFO_PLIST: string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plist = require("@expo/plist").default as { parse: (xml: string) => Record<string, unknown> };

const ROOT = path.join(__dirname, "..", "..");
const UPSTREAM_PLIST = path.join(ROOT, "node_modules", "expo-live-activity", "ios-files", "Info.plist");
const COMPLICATION_PLIST = path.join(ROOT, "targets", "watch-complication", "Info.plist");

/** Build configurations as the project holds them, ids mapping to settings. */
function project(configurations: Record<string, { buildSettings?: Record<string, string> } | string>) {
  return { pbxXCBuildConfigurationSection: () => configurations };
}

describe("the extension's build configurations", () => {
  it("turns generation off for the Live Activity's, and nothing else's", () => {
    const configs = {
      a: { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: '"com.plato.workouts.LiveActivity"', GENERATE_INFOPLIST_FILE: '"YES"' } },
      b: { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: '"com.plato.workouts.LiveActivity"', GENERATE_INFOPLIST_FILE: '"YES"' } },
      app: { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: "com.plato.workouts" } },
      watch: { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: "com.plato.workouts.watchkitapp", GENERATE_INFOPLIST_FILE: "YES" } },
      comment: "Debug",
    };
    expect(useOwnInfoPlist(project(configs), "com.plato.workouts.LiveActivity")).toBe(2);
    expect(configs.a.buildSettings.GENERATE_INFOPLIST_FILE).toBe("NO");
    expect(configs.b.buildSettings.GENERATE_INFOPLIST_FILE).toBe("NO");
    expect(configs.app.buildSettings).not.toHaveProperty("GENERATE_INFOPLIST_FILE");
    expect(configs.watch.buildSettings.GENERATE_INFOPLIST_FILE).toBe("YES");
  });

  it("fails the prebuild when the target isn't there", () => {
    expect(() => useOwnInfoPlist(project({}), "com.plato.workouts.LiveActivity")).toThrow("No build configurations");
  });
});

describe("the extension's Info.plist", () => {
  let widgetDir: string;
  beforeEach(() => {
    // What prebuild leaves in ios/LiveActivity before this plugin runs.
    widgetDir = fs.mkdtempSync(path.join(os.tmpdir(), "live-activity-plist-"));
    fs.copyFileSync(UPSTREAM_PLIST, path.join(widgetDir, "Info.plist"));
  });
  afterEach(() => fs.rmSync(widgetDir, { recursive: true, force: true }));

  it("replaces upstream's one key with a complete plist, versions left to EAS", () => {
    writeInfoPlist(widgetDir);
    const written = plist.parse(fs.readFileSync(path.join(widgetDir, "Info.plist"), "utf8"));

    expect(written).toMatchObject({
      CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
      CFBundleExecutable: "$(EXECUTABLE_NAME)",
      CFBundlePackageType: "XPC!",
      CFBundleShortVersionString: "$(MARKETING_VERSION)",
      CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
      NSExtension: { NSExtensionPointIdentifier: "com.apple.widgetkit-extension" },
    });
  });

  // The complication is a widget extension too, and its plist has shipped in
  // every build since the watch app: the same keys, its own display name.
  it("has the same keys as the watch complication's, which ships", () => {
    const complication = plist.parse(fs.readFileSync(COMPLICATION_PLIST, "utf8"));
    const ours = plist.parse(INFO_PLIST);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(complication).sort());
    expect({ ...ours, CFBundleDisplayName: "" }).toEqual({ ...complication, CFBundleDisplayName: "" });
  });

  it("refuses to overwrite a plist that isn't a widget extension's", () => {
    fs.writeFileSync(path.join(widgetDir, "Info.plist"), "<plist><dict/></plist>");
    expect(() => writeInfoPlist(widgetDir)).toThrow("isn't a widget extension");
  });

  it("fails the prebuild when upstream's plist has moved", () => {
    fs.rmSync(path.join(widgetDir, "Info.plist"));
    expect(() => writeInfoPlist(widgetDir)).toThrow("not found");
  });
});
