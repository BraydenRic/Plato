const fs = require("fs");
const path = require("path");

// Internals of @bacons/apple-targets, which is pinned to an exact version in
// package.json for exactly this reason.
const withWidget = require("@bacons/apple-targets/build/with-widget").default;
const { withPodTargetExtension } = require("@bacons/apple-targets/build/with-pod-target-extension");
const { withXcodeProjectBetaBaseMod } = require("@bacons/apple-targets/build/with-bacons-xcode");

/**
 * @bacons/apple-targets' own entry point, with the targets in a fixed order.
 *
 * Its entry point finds targets/* with glob, which returns them in whatever
 * order the file system does. That matters once there's a watch extension
 * (the complication) as well as the watch app: an extension is embedded in
 * the watch app only if the watch app's target already exists when the
 * extension's target is made, and otherwise it falls back to the phone app —
 * a build that can't work. Tried both ways: one order is right, the other
 * logs "could not find watchOS app target, falling back to main app".
 *
 * Expo runs mods newest-first, so the target registered last is made first.
 * The watch app is registered last.
 */
module.exports = function withWatchTargets(config, { appleTeamId, root = "targets" } = {}) {
  const projectRoot = config._internal.projectRoot;
  const targetsDir = path.join(projectRoot, root);
  const targets = fs
    .readdirSync(targetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(targetsDir, entry.name, "expo-target.config.js"))
    .filter((configPath) => fs.existsSync(configPath))
    .map((configPath) => {
      const exported = require(configPath);
      return { configPath, target: typeof exported === "function" ? exported(config) : exported };
    })
    .sort(
      (a, b) =>
        Number(a.target.type === "watch") - Number(b.target.type === "watch") ||
        a.configPath.localeCompare(b.configPath)
    );

  for (const { configPath, target } of targets) {
    config = withWidget(config, {
      appleTeamId,
      ...target,
      directory: path.relative(projectRoot, path.dirname(configPath)),
      configPath,
    });
  }

  withPodTargetExtension(config);
  withXcodeProjectBetaBaseMod(config);
  return config;
};
