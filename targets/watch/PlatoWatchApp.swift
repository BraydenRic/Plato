import HealthKit
import SwiftUI
import WatchKit

@main
struct PlatoWatchApp: App {
  @WKApplicationDelegateAdaptor(WatchAppDelegate.self) private var delegate
  @StateObject private var store = WatchStore.shared
  @StateObject private var tracker = CardioTracker.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
        .environmentObject(tracker)
    }
  }
}

/// The two ways the system starts this app for a session rather than for a
/// person tapping it: the phone starting a session and waking the watch to
/// track it, and a relaunch while one was already running.
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    // Made first, so the session's ops have a queue to go into.
    _ = WatchStore.shared
    CardioTracker.shared.startFromPhone(workoutConfiguration)
  }

  func handleActiveWorkoutRecovery() {
    _ = WatchStore.shared
    CardioTracker.shared.recover()
  }
}

/// One screen at a time, decided by what's going on: a workout to log, one
/// starting, templates to start, or the phone still to be set up.
struct RootView: View {
  @EnvironmentObject private var store: WatchStore
  @EnvironmentObject private var tracker: CardioTracker
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    content
      .tint(store.accent)
      .onChange(of: scenePhase) { _, phase in
        if phase == .active { store.refresh() }
      }
  }

  @ViewBuilder
  private var content: some View {
    if let result = store.cardioFinished {
      CardioFinishedView(result: result)
    } else if tracker.isActive {
      CardioLiveView()
    } else if let summary = store.finished {
      FinishedView(summary: summary)
    } else if let session = store.phoneSession {
      PhoneSessionView(workout: session)
    } else if let workout = store.workout {
      LoggerView(workout: workout)
    } else if let request = store.start {
      StartingView(request: request)
    } else if let snapshot = store.snapshot, snapshot.isSignedIn {
      TemplatesView(templates: snapshot.templates)
    } else {
      ConnectView(signedOut: store.snapshot != nil)
    }
  }
}

/// Before the phone has said anything, or while it's signed out.
struct ConnectView: View {
  let signedOut: Bool

  var body: some View {
    VStack(spacing: 10) {
      Image("logo")
        .resizable()
        .scaledToFit()
        .frame(width: 48, height: 48)
      Text(signedOut ? "Sign in to Plato on your iPhone." : "Open Plato on your iPhone to get started.")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding(.horizontal)
  }
}

struct StartingView: View {
  @EnvironmentObject private var store: WatchStore
  let request: StartRequest

  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        if let failure = request.failure {
          Text(failure == .unreachable ? "Couldn't reach your iPhone" : "Your iPhone hasn't started it")
            .font(.headline)
            .multilineTextAlignment(.center)
          Text(failure == .unreachable ? "Keep it nearby, then try again." : "Open Plato on your iPhone, then try again.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
          Button {
            store.retryStart()
          } label: {
            Text("Try Again")
              .font(.headline)
              .foregroundStyle(store.onAccent)
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          Button("Cancel") {
            store.cancelStart()
          }
        } else {
          ProgressView()
          Text("Starting \(request.template.name)\u{2026}")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
        }
      }
      .padding(.top, 8)
    }
  }
}

/// Shown for a few seconds after finishing on the watch.
struct FinishedView: View {
  @EnvironmentObject private var store: WatchStore
  let summary: FinishedSummary

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 40))
        .foregroundStyle(store.accent)
      Text("Workout saved")
        .font(.headline)
      Text(summary.setsDone == 1 ? "\(summary.name) \u{00B7} 1 set" : "\(summary.name) \u{00B7} \(summary.setsDone) sets")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .lineLimit(2)
    }
    .padding(.horizontal)
    .contentShape(Rectangle())
    .onTapGesture { store.dismissFinished() }
    .onAppear {
      // The store itself, not the view's handle on it: this runs after the
      // view may already be gone.
      let owner = store
      let shown = summary
      DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
        if owner.finished == shown { owner.dismissFinished() }
      }
    }
  }
}
