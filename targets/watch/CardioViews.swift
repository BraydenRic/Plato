import SwiftUI

/// The routes into cardio from the Start list.
enum CardioRoute: Hashable {
  case picker
  case kind(CardioKind)
}

/// What kind of session: one row each, then a screen to start it on — so a
/// brush against the list can't set a session going.
struct CardioPickerView: View {
  var body: some View {
    List(CardioKind.allCases) { kind in
      NavigationLink(value: CardioRoute.kind(kind)) {
        Label(kind.label, systemImage: kind.symbol(indoor: kind.places[0]))
          .font(.headline)
      }
    }
    .navigationTitle("Cardio")
  }
}

/// Indoors or out, where that's a choice, and Start.
struct CardioStartView: View {
  @EnvironmentObject private var store: WatchStore
  let kind: CardioKind

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: kind.symbol(indoor: kind.places[0]))
          .font(.system(size: 34))
          .foregroundStyle(store.accent)
        Text(kind.label)
          .font(.title3.weight(.semibold))
        ForEach(Array(kind.places.enumerated()), id: \.offset) { index, indoor in
          if index == 0 {
            Button {
              store.startCardio(kind, indoor: indoor)
            } label: {
              Text(kind.places.count > 1 ? kind.placeLabel(indoor: indoor) : "Start")
                .font(.headline)
                .foregroundStyle(store.onAccent)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .handGestureShortcut(.primaryAction)
          } else {
            Button {
              store.startCardio(kind, indoor: indoor)
            } label: {
              Text(kind.placeLabel(indoor: indoor))
                .font(.headline)
                .frame(maxWidth: .infinity)
            }
          }
        }
      }
    }
  }
}

/// The session as it happens. Three pages: the controls to the left, the
/// numbers in the middle (where it opens), the splits to the right.
struct CardioLiveView: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker
  @State private var page = 1

  var body: some View {
    TabView(selection: $page) {
      CardioControlsPage()
        .tag(0)
      CardioMetricsPage()
        .tag(1)
      if tracker.kind.hasSplits {
        CardioSplitsPage()
          .tag(2)
      }
    }
    .tabViewStyle(.page)
  }
}

/// Time, distance, pace and heart rate — big enough to read mid-stride.
///
/// Pace is a figure in its own right, as big as distance and on the page from
/// the first second: a small grey line under the distance, there only once
/// it had enough to go on, read as no pace at all.
///
/// Sized for the smallest watch it runs on, 40 mm, where a page has about
/// 160 points of height: clock 34 + two figures 26 + the heart-rate row with
/// a 34-point pause button comes to about 140. PAUSED sits beside the clock,
/// not under it, so pausing doesn't push the page past the bottom edge.
struct CardioMetricsPage: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let elapsed = tracker.elapsed(at: context.date)
      VStack(alignment: .leading, spacing: 0) {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(Logbook.clock(Int(elapsed)))
            .font(.plateNumber(34))
            .foregroundStyle(tracker.state == .paused ? Color.secondary : store.accent)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          if tracker.state == .paused {
            Text("PAUSED")
              .font(.caption2.weight(.semibold))
              .foregroundStyle(.secondary)
              .fixedSize()
          }
        }
        if tracker.kind.tracksDistance {
          CardioFigure(
            value: CardioFormat.distance(tracker.distance, kind: tracker.kind, weightUnit: store.unit),
            unit: CardioFormat.unitLabel(kind: tracker.kind, weightUnit: store.unit)
          )
          CardioPaceFigure(elapsed: elapsed)
        }
        HStack(spacing: 4) {
          Image(systemName: "heart.fill")
            .foregroundStyle(.red)
          Text(tracker.heartRate.map { String(Int($0.rounded())) } ?? "--")
            .font(.plateNumber(22))
          Spacer(minLength: 0)
          // Here as well as on the controls page, so double tap pauses from
          // the page you're looking at mid-run. A fixed 34-point circle: a
          // standard watch button is taller, and on a 40 mm watch the page
          // ran out of room.
          Button {
            Haptics.click()
            if tracker.state == .paused { tracker.resume() } else { tracker.pause() }
          } label: {
            Image(systemName: tracker.state == .paused ? "play.fill" : "pause.fill")
              .font(.system(size: 14, weight: .semibold))
              .frame(width: 34, height: 34)
              .background(RoundedRectangle(cornerRadius: 17).fill(Color.white.opacity(0.18)))
          }
          .buttonStyle(.plain)
          .handGestureShortcut(.primaryAction)
          .accessibilityLabel(tracker.state == .paused ? "Resume" : "Pause")
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

/// A figure on the run page: the number, and its unit small beside it.
private struct CardioFigure: View {
  let value: String
  let unit: String

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 3) {
      Text(value)
        .font(.plateNumber(26))
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text(unit)
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
    }
  }
}

/// Average pace (speed, on a bike), moved every few seconds. Worked out every
/// second from a distance that arrives in jumps and a clock that ticks, it
/// twitched — the same as on the phone, which moves it at the same pace.
///
/// Moved when the session's moving time crosses each 5-second mark. Build 69
/// used a 5-second TimelineView instead, but it sat inside the page's
/// 1-second one, so its schedule began again every second and the pace
/// still moved every second. The moving time can't be reset by a redraw,
/// and it stands still while paused — as the average pace should.
private struct CardioPaceFigure: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker
  /// The session's moving seconds now, from the page's clock.
  let elapsed: Double
  @State private var shown: String?

  var body: some View {
    let parts = CardioFormat.rateParts(shown, kind: tracker.kind, weightUnit: store.unit)
    CardioFigure(value: parts.value, unit: parts.unit)
      .onAppear { shown = current() }
      .onChange(of: Self.mark(elapsed)) { shown = current() }
      // The first pace shows as soon as there's one, not at the next mark.
      .onChange(of: tracker.distance) {
        if shown == nil { shown = current() }
      }
  }

  /// Which 5-second stretch of moving time it is.
  static func mark(_ seconds: Double) -> Int { Int(seconds / 5) }

  private func current() -> String? {
    CardioFormat.rate(metres: tracker.distance, seconds: elapsed, kind: tracker.kind, weightUnit: store.unit)
  }
}

/// Each mile (or kilometre) done so far, and how far into the next.
struct CardioSplitsPage: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker

  var body: some View {
    let unit = CardioFormat.unitMetres(kind: tracker.kind, weightUnit: store.unit)
    let label = CardioFormat.unitLabel(kind: tracker.kind, weightUnit: store.unit)
    let splits = tracker.curve.splits(unitMetres: unit)
    let into = tracker.distance / unit - Double(splits.count)
    List {
      HStack {
        Text("\(label == "MI" ? "Mile" : "Km") \(splits.count + 1)")
          .font(.headline)
        Spacer()
        Text(String(format: "%.2f", max(0, into)))
          .font(.plateNumber(17))
          .foregroundStyle(store.accent)
      }
      ForEach(Array(splits.enumerated().reversed()), id: \.offset) { index, seconds in
        HStack {
          Text("\(index + 1)")
            .foregroundStyle(.secondary)
          Spacer()
          Text(Logbook.clock(Int(seconds.rounded())))
            .font(.plateNumber(17))
        }
      }
    }
  }
}

/// Pause or resume, and End, after a check.
struct CardioControlsPage: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker
  @State private var confirmingEnd = false

  var body: some View {
    VStack(spacing: 8) {
      Text(tracker.kind.name(indoor: tracker.indoor))
        .font(.headline)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Button {
        Haptics.click()
        if tracker.state == .paused { tracker.resume() } else { tracker.pause() }
      } label: {
        Label(tracker.state == .paused ? "Resume" : "Pause", systemImage: tracker.state == .paused ? "play.fill" : "pause.fill")
          .font(.headline)
          .foregroundStyle(store.onAccent)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      Button(role: .destructive) {
        confirmingEnd = true
      } label: {
        Label("End", systemImage: "xmark")
          .font(.headline)
          .frame(maxWidth: .infinity)
      }
    }
    .confirmationDialog("End \(tracker.kind.name(indoor: tracker.indoor))?", isPresented: $confirmingEnd, titleVisibility: .visible) {
      Button("End", role: .destructive) { tracker.end() }
      Button("Cancel", role: .cancel) {}
    }
  }
}

/// Tracking didn't start: why, and what to do — instead of silently going
/// back to the list as if the tap had missed.
struct CardioErrorView: View {
  @EnvironmentObject private var store: WatchStore
  let message: String

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: "exclamationmark.circle")
          .font(.system(size: 34))
          .foregroundStyle(.secondary)
        Text("Couldn't start tracking")
          .font(.headline)
          .multilineTextAlignment(.center)
        Text(message)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
        Button("OK") { store.dismissCardioError() }
      }
      .padding(.horizontal)
    }
  }
}

/// A few seconds of "saved", with what it came to.
struct CardioFinishedView: View {
  @EnvironmentObject private var store: WatchStore
  let result: CardioResult

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 40))
        .foregroundStyle(store.accent)
      Text("\(result.kind.label) saved")
        .font(.headline)
      Text(summary)
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding(.horizontal)
    .contentShape(Rectangle())
    .onTapGesture { store.dismissCardioFinished() }
    .onAppear {
      let owner = store
      let shown = result
      DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
        if owner.cardioFinished == shown { owner.dismissCardioFinished() }
      }
    }
  }

  private var summary: String {
    let time = Logbook.clock(result.duration)
    guard let metres = result.distance else { return time }
    let distance = CardioFormat.distance(metres, kind: result.kind, weightUnit: store.unit)
    return "\(distance) \(CardioFormat.unitLabel(kind: result.kind, weightUnit: store.unit).lowercased()) \u{00B7} \(time)"
  }
}

/// A session going on the phone that this watch isn't tracking — started
/// with the watch off a wrist, say. Just its clock: tracking half a run here
/// would make a session that's half measured.
struct PhoneSessionView: View {
  @EnvironmentObject private var store: WatchStore
  let workout: WatchWorkout

  var body: some View {
    let cardio = workout.cardio
    let kind = cardio.flatMap { CardioKind(rawValue: $0.kind) } ?? .run
    ScrollView {
      VStack(spacing: 8) {
        Text(workout.name)
          .font(.headline)
        TimelineView(.periodic(from: .now, by: 1)) { context in
          Text(Logbook.clock(movingSeconds(at: context.date)))
            .font(.plateNumber(34))
        }
        Label("On your iPhone", systemImage: kind.symbol(indoor: cardio?.indoor ?? false))
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  private func movingSeconds(at date: Date) -> Int {
    let pausedMs = (workout.cardio?.pausedSeconds ?? 0) * 1000
      + (workout.cardio?.pausedAtMs.map { max(0, date.ms - $0) } ?? 0)
    return max(0, Int((date.ms - workout.startedAt - pausedMs) / 1000))
  }
}
