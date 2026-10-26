const fs = require("fs");
const path = require("path");

const { withXcodeProject } = require("expo/config-plugins");

/**
 * Gives the Live Activity extension the app's build number.
 *
 * Every extension inside the app has to carry the app's CFBundleVersion, and
 * the build says so when one doesn't: "The CFBundleVersion of an app
 * extension ('1') must match that of its containing parent app ('73')" (builds
 * 71 to 73). EAS hands out the build number (appVersionSource: remote) by
 * writing it into each signed target's Info.plist file after prebuild. But
 * expo-live-activity turns on GENERATE_INFOPLIST_FILE for its extension, with
 * CURRENT_PROJECT_VERSION set from app.json's buildNumber, "1", and the "1"
 * is what reached the build.
 *
 * The same cure as the watch's (with-watch-plist-only.js): generation off, so
 * the Info.plist file, with EAS's number written into it, is the only source.
 * Upstream's file declares only the extension point, Xcode having generated the
 * rest, so it's replaced with a complete one: the keys Xcode would generate,
 * the same set the watch complication's own Info.plist ships with.
 *
 * withXcodeProject, listed before expo-live-activity in app.json so it runs
 * after that plugin has added the target and copied its files in.
 */

const TARGET_NAME = "LiveActivity";

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>${TARGET_NAME}</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>
`;

/** Generation off for the extension's build configurations. Returns how many it changed. */
function useOwnInfoPlist(project, bundleIdentifier) {
  let changed = 0;
  for (const configuration of Object.values(project.pbxXCBuildConfigurationSection())) {
    const settings = configuration?.buildSettings;
    if (!settings) continue;
    if (String(settings.PRODUCT_BUNDLE_IDENTIFIER ?? "").replace(/"/g, "") !== bundleIdentifier) continue;
    settings.GENERATE_INFOPLIST_FILE = "NO";
    changed += 1;
  }
  // Better a failed prebuild than a build that quietly goes back to the "1".
  if (changed === 0) {
    throw new Error(`[with-live-activity-plist] No build configurations found for ${bundleIdentifier}`);
  }
  return changed;
}

/** Replaces upstream's one-key Info.plist with the complete one. */
function writeInfoPlist(widgetDir) {
  const file = path.join(widgetDir, "Info.plist");
  if (!fs.existsSync(file)) {
    throw new Error(`[with-live-activity-plist] ${file} not found; has expo-live-activity moved its files?`);
  }
  // Only ever a widget extension's plist: anything else means upstream changed
  // shape, and overwriting it blind could drop something it now needs.
  if (!fs.readFileSync(file, "utf8").includes("com.apple.widgetkit-extension")) {
    throw new Error(`[with-live-activity-plist] ${file} isn't a widget extension's Info.plist any more`);
  }
  fs.writeFileSync(file, INFO_PLIST);
}

module.exports = function withLiveActivityPlist(config) {
  return withXcodeProject(config, (cfg) => {
    useOwnInfoPlist(cfg.modResults, `${cfg.ios.bundleIdentifier}.${TARGET_NAME}`);
    writeInfoPlist(path.join(cfg.modRequest.platformProjectRoot, TARGET_NAME));
    return cfg;
  });
};

module.exports.useOwnInfoPlist = useOwnInfoPlist;
module.exports.writeInfoPlist = writeInfoPlist;
module.exports.INFO_PLIST = INFO_PLIST;
