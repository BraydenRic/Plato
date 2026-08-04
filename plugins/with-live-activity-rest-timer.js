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


// ── Dynamic Island ───────────────────────────────────────────────────────────
// Its compact slot is `.frame(maxWidth: 60)` — one number, not two — so this is
// a swap rather than the side-by-side the lock screen gets. Both the compact
// and minimal presentations reorder the same way.

const ISLAND_TRAILING_ANCHOR = `        if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          ElapsedTimerText(
            startTimeMilliseconds: startDate,
            color: nil
          )
          .font(.system(size: 15))
          .minimumScaleFactor(0.8)
          .fontWeight(.semibold)
          .frame(maxWidth: 60)
          .multilineTextAlignment(.trailing)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let progress = context.state.progress {`;

const ISLAND_TRAILING_PATCHED = `        // Rest wins the island while it is running: the slot fits one number,
        // and the one you are waiting on is the countdown, not the elapsed time.
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          ElapsedTimerText(
            startTimeMilliseconds: startDate,
            color: nil
          )
          .font(.system(size: 15))
          .minimumScaleFactor(0.8)
          .fontWeight(.semibold)
          .frame(maxWidth: 60)
          .multilineTextAlignment(.trailing)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let progress = context.state.progress {`;

const ISLAND_MINIMAL_ANCHOR = `        if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          ElapsedTimerText(
            startTimeMilliseconds: startDate,
            color: context.attributes.progressViewTint.map { Color(hex: $0) }
          )
          .font(.system(size: 11))
          .minimumScaleFactor(0.6)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let progress = context.state.progress {`;

const ISLAND_MINIMAL_PATCHED = `        // Rest wins the island while it is running: the slot fits one number,
        // and the one you are waiting on is the countdown, not the elapsed time.
        if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let startDate = context.state.elapsedTimerStartDateInMilliseconds {
          ElapsedTimerText(
            startTimeMilliseconds: startDate,
            color: context.attributes.progressViewTint.map { Color(hex: $0) }
          )
          .font(.system(size: 11))
          .minimumScaleFactor(0.6)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let progress = context.state.progress {`;

/** Every file this plugin rewrites, with the marker that says it already has. */
const PATCHES = [
  {
    file: "LiveActivityMediumView.swift",
    applied: "restEndDate",
    what: "the side-by-side timers on the lock screen",
    replacements: [[ANCHOR, PATCHED]],
  },
  {
    file: "LiveActivityWidget.swift",
    applied: "Rest wins the island",
    what: "the Dynamic Island timer priority",
    replacements: [
      [ISLAND_TRAILING_ANCHOR, ISLAND_TRAILING_PATCHED],
      [ISLAND_MINIMAL_ANCHOR, ISLAND_MINIMAL_PATCHED],
    ],
  },
];

module.exports = function withLiveActivityRestTimer(config) {
  // withXcodeProject, not withDangerousMod: dangerous mods run first in the iOS
  // chain, before expo-live-activity has copied its widget sources in.
  return withXcodeProject(config, (cfg) => {
    for (const patch of PATCHES) {
      const file = path.join(cfg.modRequest.platformProjectRoot, "LiveActivity", patch.file);

      // Loud rather than silent. If any of this stops matching — an
      // expo-live-activity upgrade is the likely cause, since the version is
      // pinned exactly — the build must fail here. The alternative is an app
      // that ships looking fine and quietly drops a timer.
      if (!fs.existsSync(file)) {
        throw new Error(
          `[with-live-activity-rest-timer] ${patch.file} not found at ${file}. ` +
            `This plugin has to run after expo-live-activity copies its widget ` +
            `sources — check the plugin order in app.json.`
        );
      }

      let source = fs.readFileSync(file, "utf8");

      // Prebuild is re-runnable, so a second pass over an already-patched file
      // is expected rather than a problem.
      if (source.includes(patch.applied)) continue;

      for (const [anchor, patched] of patch.replacements) {
        if (!source.includes(anchor)) {
          throw new Error(
            `[with-live-activity-rest-timer] ${patch.file} no longer matches what ` +
              `this patch expects, so ${patch.what} cannot be applied. ` +
              `expo-live-activity has probably changed; re-read that file and ` +
              `update the anchors.`
          );
        }
        source = source.replace(anchor, patched);
      }

      fs.writeFileSync(file, source);
    }
    return cfg;
  });
};
