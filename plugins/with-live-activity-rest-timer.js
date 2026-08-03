const fs = require("fs");
const path = require("path");

const { withXcodeProject } = require("expo/config-plugins");

/**
 * Lets the Live Activity show the workout timer and the rest countdown at once.
 *
 * expo-live-activity's lock-screen view picks exactly one timer:
 *
 *   if      let startDate = ...elapsedTimerStartDateInMilliseconds  { ...counts up   }
 *   else if let date      = ...timerEndDateInMilliseconds           { ...counts down }
 *
 * The `else` is the only thing in the way. Its ContentState already carries the
 * two as independent fields, and the native module reads them independently
 * (`state.progressBar?.date` and `state.progressBar?.elapsedTimer?.startDate`),
 * so sending both populates both — the exclusivity is a TypeScript union and
 * this one keyword, nothing deeper.
 *
 * The elapsed timer already renders as `.frame(maxWidth: .infinity, alignment:
 * .leading)`, so it claims the full row and sits at the left, leaving the right
 * end of that same row empty. The rest countdown goes there, which is why this
 * costs no extra height.
 *
 * Rest is drawn in progressViewTint (the theme accent) against the workout
 * timer's plain label colour. That difference is fixed when the activity starts
 * — which is fine, because unlike a colour that has to *change* at zero, this
 * one never needs an update to arrive.
 *
 * Only the medium view is touched. `.small` is the Apple Watch Smart Stack and
 * the Dynamic Island has a 60pt slot that two timers would not fit, so both
 * keep the upstream behaviour of showing the workout timer.
 */

const TARGET = "LiveActivityMediumView.swift";

const ANCHOR = `        } else if let startDate = contentState.elapsedTimerStartDateInMilliseconds {
          ElapsedTimerText(
            startTimeMilliseconds: startDate,
            color: attributes.progressViewLabelColor.map { Color(hex: $0) }
          )
          .font(.title2)
          .fontWeight(.semibold)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 4)
        } else if let date = contentState.timerEndDateInMilliseconds {`;

const PATCHED = `        } else if let startDate = contentState.elapsedTimerStartDateInMilliseconds {
          HStack(alignment: .firstTextBaseline) {
            ElapsedTimerText(
              startTimeMilliseconds: startDate,
              color: attributes.progressViewLabelColor.map { Color(hex: $0) }
            )
            .font(.title2)
            .fontWeight(.semibold)

            if let restEndDate = contentState.timerEndDateInMilliseconds {
              Spacer(minLength: 8)
              Text(timerInterval: Date.toTimerInterval(miliseconds: restEndDate))
                .font(.title3)
                .fontWeight(.semibold)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 76, alignment: .trailing)
                .modifier(ConditionalForegroundViewModifier(color: attributes.progressViewTint))
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 4)
        } else if let date = contentState.timerEndDateInMilliseconds {`;

module.exports = function withLiveActivityRestTimer(config) {
  // withXcodeProject, not withDangerousMod: dangerous mods run first in the iOS
  // chain, before expo-live-activity has copied its widget sources in.
  return withXcodeProject(config, (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, "LiveActivity", TARGET);

    // Loud rather than silent. If this ever stops matching — an
    // expo-live-activity upgrade is the likely cause, since the version is
    // pinned exactly — the build must fail here. The alternative is an app
    // that ships looking fine and quietly drops the rest timer.
    if (!fs.existsSync(file)) {
      throw new Error(
        `[with-live-activity-rest-timer] ${TARGET} not found at ${file}. ` +
          `This plugin has to run after expo-live-activity copies its widget ` +
          `sources — check the plugin order in app.json.`
      );
    }

    const source = fs.readFileSync(file, "utf8");

    // Prebuild is re-runnable, so a second pass over an already-patched file
    // is expected rather than a problem.
    if (source.includes("restEndDate")) return cfg;

    if (!source.includes(ANCHOR)) {
      throw new Error(
        `[with-live-activity-rest-timer] the timer branch in ${TARGET} no longer ` +
          `matches what this patch expects. expo-live-activity has probably ` +
          `changed; re-read its medium view and update ANCHOR/PATCHED.`
      );
    }

    fs.writeFileSync(file, source.replace(ANCHOR, PATCHED));
    return cfg;
  });
};
