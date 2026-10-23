import SwiftUI

/// The workout in progress: one page per exercise, swiped sideways (the crown
/// is kept free for the numbers), then a last page to finish. A running rest
/// takes the whole screen until it's over or skipped.
struct LoggerView: View {
  @EnvironmentObject private var store: WatchStore
  let workout: WatchWorkout
  @State private var page = ""

  var body: some View {
    Group {
      if let deadline = store.restDeadline {
        RestView(deadline: deadline, workout: workout, exerciseId: page)
      } else {
        TabView(selection: $page) {
          ForEach(workout.exercises) { exercise in
            ExercisePage(
              exercise: exercise,
              workout: workout,
              isActive: page == exercise.id,
              onExerciseDone: advance
            )
            .tag(exercise.id)
          }
          FinishPage(workout: workout)
            .tag(FinishPage.tag)
        }
        .tabViewStyle(.page)
      }
    }
    .onAppear { settle() }
    .onChange(of: workout.id) { settle() }
  }

  /// Opens on the first exercise with a set left, and lands somewhere real
  /// again if the page it was on stops existing.
  private func settle() {
    let pages = workout.exercises.map { $0.id } + [FinishPage.tag]
    if pages.contains(page) { return }
    page = Logbook.firstOpenExercise(in: workout) ?? workout.exercises.first?.id ?? FinishPage.tag
  }

  /// The last set of an exercise went in: move on to the next one with sets
  /// left, or to Finish when there are none.
  private func advance(from exerciseId: String) {
    guard let latest = store.workout else { return }
    let next = Logbook.nextOpenExercise(in: latest, after: exerciseId) ?? FinishPage.tag
    withAnimation { page = next }
  }
}

struct RestView: View {
  @EnvironmentObject private var store: WatchStore
  let deadline: Date
  let workout: WatchWorkout
  let exerciseId: String

  var body: some View {
    let next = Logbook.nextUp(in: workout, from: exerciseId)
    VStack(spacing: 4) {
      Text("REST")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(store.accent)
      Text(timerInterval: min(Date(), deadline)...deadline, countsDown: true)
        .font(.plateNumber(44))
        .multilineTextAlignment(.center)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      if let next {
        Text("Next: \(next.exercise.name)")
          .font(.footnote)
          .lineLimit(1)
        Text(nextSummary(next))
          .font(.footnote)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 4)
      HStack(spacing: 8) {
        Button("+15s") { store.extendRest(of: workout) }
        Button("Skip") { store.skipRest(of: workout) }
      }
    }
  }

  private func nextSummary(_ next: (exercise: WatchExercise, index: Int)) -> String {
    let draft = Logbook.draft(for: next.index, in: next.exercise)
    let set = "Set \(next.index + 1)"
    switch next.exercise.kind {
    case .timed:
      return set
    case .weight:
      return "\(set) \u{00B7} \(Logbook.draftSummary(draft, kind: .weight)) \(store.unit)"
    case .bodyweight:
      return "\(set) \u{00B7} \(Logbook.draftSummary(draft, kind: .bodyweight))"
    }
  }
}

struct FinishPage: View {
  static let tag = "plato.finish"

  @EnvironmentObject private var store: WatchStore
  let workout: WatchWorkout
  @State private var confirming = false

  var body: some View {
    let counts = Logbook.setCounts(in: workout)
    VStack(spacing: 6) {
      Text(workout.name)
        .font(.headline)
        .lineLimit(2)
        .multilineTextAlignment(.center)
      Text(Date(ms: workout.startedAt), style: .timer)
        .font(.plateNumber(28))
      Text(workout.exercises.isEmpty ? "Add exercises in Plato on your iPhone." : "\(counts.done) of \(counts.total) sets")
        .font(.footnote)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      Button {
        confirming = true
      } label: {
        Text("Finish")
          .font(.headline)
          .foregroundStyle(store.onAccent)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
    }
    .confirmationDialog("Finish \(workout.name)?", isPresented: $confirming, titleVisibility: .visible) {
      Button("Finish") {
        Haptics.confirm()
        store.finish(workout)
      }
      Button("Cancel", role: .cancel) {}
    }
  }
}
