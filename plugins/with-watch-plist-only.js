const fs = require("fs");

const { IOSConfig, withFinalizedMod } = require("expo/config-plugins");

/**
 * Makes the watch app read its Info.plist only from targets/watch/Info.plist.
 *
 * Xcode refuses to embed a watch app whose version or build number differs from
 * the phone app's — the build stops at ValidateEmbeddedBinary. EAS sets the
 * build number (appVersionSource: remote) by writing it into every signed
 * target's Info.plist file after prebuild, so that file has the right number.
 *
 * The problem is that @bacons/apple-targets also turns on
 * GENERATE_INFOPLIST_FILE, which has Xcode build a second plist from build
 * settings, including CFBundleVersion from CURRENT_PROJECT_VERSION. That
 * setting is app.json's buildNumber ("1"), because the real number doesn't
 * exist until EAS hands it out. With both in play the outcome depends on which
 * one Xcode lets win, which nobody documents. Switching generation off for the
 * watch target leaves one source, EAS's.
 *
 * It runs as a finalized mod because the target doesn't exist until
 * apple-targets' own Xcode mod has run, and that mod refuses anything added
 * after it.
 */
module.exports = function withWatchPlistOnly(config, { bundleIdSuffix = ".watchkitapp" } = {}) {
  return withFinalizedMod(config, [
    "ios",
    async (config) => {
      const watchBundleId = config.ios.bundleIdentifier + bundleIdSuffix;
      const project = IOSConfig.XcodeUtils.getPbxproj(config.modRequest.projectRoot);
      const configurations = project.pbxXCBuildConfigurationSection();

      let changed = 0;
      for (const configuration of Object.values(configurations)) {
        const settings = configuration?.buildSettings;
        if (!settings) continue;
        const bundleId = String(settings.PRODUCT_BUNDLE_IDENTIFIER ?? "").replace(/"/g, "");
        if (bundleId !== watchBundleId) continue;
        settings.GENERATE_INFOPLIST_FILE = "NO";
        changed += 1;
      }

      // Better a failed prebuild than a build that dies an hour in on a version
      // mismatch, or ships with the generated plist after all.
      if (changed === 0) {
        throw new Error(`[with-watch-plist-only] No build configurations found for ${watchBundleId}`);
      }

      fs.writeFileSync(project.filepath, project.writeSync());
      return config;
    },
  ]);
};
