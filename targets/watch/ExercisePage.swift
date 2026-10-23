import SwiftUI

/// One exercise: the set to do now, its numbers ready to adjust with the
/// crown, and one big Done.
struct ExercisePage: View {
  @EnvironmentObject private var store: WatchStore
  let exercise: WatchExercise
  let workout: WatchWorkout
  /// The page on screen. Only it may hold focus — an offscreen page that kept
  /// it would let the crown change numbers nobody can see.
  let isActive: Bool
  let onExerciseDone: (String) -> Void

  /// A set picked from the list to fix; otherwise the editor follows the next
  /// set to do.
  @State private var chosenSetId: String?
  @State private var draft = Draft(weight: 0, reps: 0, duration: 0)
  @State private var draftSetId: String?
  @State private var showingSets = false
  @FocusState private var focus: Field?

  enum Field: Hashable {
    case weight, reps
  }

  private var editingIndex: Int? {
    if let id = chosenSetId, let index = exercise.sets.firstIndex(where: { $0.id == id }) {
      return index
    }
    return Logbook.currentSetIndex(in: exercise)
  }

  private var editingSetId: String? {
    editingIndex.map { exercise.sets[$0].id }
  }

  var body: some View {
    VStack(spacing: 6) {
      header
      if let index = editingIndex {
        if exercise.kind == .timed {
          timedEditor(index)
        } else {
          liftEditor(index)
        }
      } else {
        allDone
      }
    }
    .sheet(isPresented: $showingSets) {
      NavigationStack {
        SetListView(exercise: exercise, workout: workout) { setId in
          chosenSetId = setId
          showingSets = false
        }
      }
      .environmentObject(store)
    }
    .onAppear {
      syncDraft()
      claimFocus()
    }
    .onChange(of: editingSetId) {
      syncDraft()
      claimFocus()
    }
    .onChange(of: isActive) {
      claimFocus()
    }
  }

  // MARK: Pieces

  private var header: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(exercise.name)
        .font(.headline)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      Button {
        showingSets = true
      } label: {
        HStack(spacing: 3) {
          Text(caption)
          Image(systemName: "chevron.right")
            .font(.caption2)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
      .buttonStyle(.plain)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var caption: String {
    let total = exercise.sets.count
    guard let index = editingIndex else {
      return total == 0 ? "No sets" : "\(total) of \(total) done"
    }
    return "Set \(index + 1) of \(total)"
  }

  private func liftEditor(_ index: Int) -> some View {
    let set = exercise.sets[index]
    return VStack(spacing: 6) {
      HStack(alignment: .center, spacing: 4) {
        valueField(.weight, text: Logbook.weightText(draft.weight, kind: exercise.kind), caption: weightCaption)
        Text("\u{00D7}")
          .font(.title3)
          .foregroundStyle(.secondary)
        valueField(.reps, text: "\(draft.reps)", caption: "reps")
      }
      Button {
        logLift(set, at: index)
      } label: {
        Text(set.done ? "Save" : "Done")
          .font(.headline)
          .foregroundStyle(store.onAccent)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .disabled(draft.reps <= 0)
      .handGestureShortcut(.primaryAction)
    }
  }

  private var weightCaption: String {
    exercise.kind == .bodyweight ? "added \(store.unit)" : store.unit
  }

  private func valueField(_ field: Field, text: String, caption: String) -> some View {
    let focused = focus == field
    return VStack(spacing: 0) {
      Text(text)
        .font(.plateNumber(32))
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      Text(caption)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 4)
    .background(
      RoundedRectangle(cornerRadius: 10)
        .stroke(focused ? store.accent : Color.gray.opacity(0.35), lineWidth: focused ? 2 : 1)
    )
    .contentShape(Rectangle())
    .focusable(isActive)
    .focusEffectDisabled()
    .focused($focus, equals: field)
    .digitalCrownRotation(
      crownBinding(field),
      from: crownRange(field).lowerBound,
      through: crownRange(field).upperBound,
      by: crownStep(field),
      sensitivity: .medium,
      isContinuous: false,
      isHapticFeedbackEnabled: true
    )
    .onTapGesture { focus = field }
  }

  private func timedEditor(_ index: Int) -> some View {
    let set = exercise.sets[index]
    let run = store.timedRun?.setId == set.id ? store.timedRun : nil
    return VStack(spacing: 8) {
      Group {
        if let run {
          Text(Date(ms: run.startedAt), style: .timer)
        } else {
          Text(Logbook.clock(draft.duration))
            .foregroundStyle(set.duration == nil ? .secondary : .primary)
        }
      }
      .font(.plateNumber(40))
      .lineLimit(1)
      .minimumScaleFactor(0.6)

      Button {
        if run == nil {
          Haptics.click()
          store.startTimer(on: set, in: exercise, of: workout)
        } else {
          Haptics.confirm()
          let completesExercise = finishesExercise(set, at: index)
          store.stopTimer(on: set, in: exercise, of: workout)
          chosenSetId = nil
          if completesExercise { onExerciseDone(exercise.id) }
        }
      } label: {
        Label(run == nil ? "Start" : "Stop", systemImage: run == nil ? "play.fill" : "stop.fill")
          .font(.headline)
          .foregroundStyle(run == nil ? store.onAccent : .white)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .tint(run == nil ? store.accent : .red)
      .handGestureShortcut(.primaryAction)
    }
  }

  private var allDone: some View {
    VStack(spacing: 8) {
      if !exercise.sets.isEmpty {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 30))
          .foregroundStyle(store.accent)
      }
      Button {
        store.addSet(to: exercise, of: workout)
      } label: {
        Label("Add set", systemImage: "plus")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
    }
  }

  // MARK: Behaviour

  private func logLift(_ set: WatchSet, at index: Int) {
    Haptics.confirm()
    let completesExercise = finishesExercise(set, at: index)
    store.log(set, in: exercise, of: workout, weight: draft.weight, reps: draft.reps, duration: nil)
    chosenSetId = nil
    if completesExercise { onExerciseDone(exercise.id) }
  }

  /// Whether logging this set leaves nothing to do in the exercise. Fixing a
  /// set that was already done never moves the page — you're reviewing.
  private func finishesExercise(_ set: WatchSet, at index: Int) -> Bool {
    guard !set.done else { return false }
    return exercise.sets.indices.allSatisfy { $0 == index || exercise.sets[$0].done }
  }

  private func syncDraft() {
    guard let index = editingIndex else {
      draftSetId = nil
      return
    }
    let id = exercise.sets[index].id
    guard id != draftSetId else { return }
    draftSetId = id
    draft = Logbook.draft(for: index, in: exercise)
  }

  /// The crown goes to the number most likely to change: weight on an
  /// exercise's first set, reps once a set is in (and always reps for
  /// bodyweight, where the load rarely moves).
  private func claimFocus() {
    guard isActive, let index = editingIndex, exercise.kind != .timed else {
      focus = nil
      return
    }
    let weightSettled = exercise.kind == .bodyweight || Logbook.hasEarlierDoneSet(before: index, in: exercise)
    focus = weightSettled ? .reps : .weight
  }

  private func crownBinding(_ field: Field) -> Binding<Double> {
    switch field {
    case .weight:
      return $draft.weight
    case .reps:
      return Binding(
        get: { Double(draft.reps) },
        set: { draft.reps = max(0, Int($0.rounded())) }
      )
    }
  }

  private func crownRange(_ field: Field) -> ClosedRange<Double> {
    switch field {
    case .weight:
      return exercise.kind == .bodyweight ? -300...500 : 0...2000
    case .reps:
      return 0...100
    }
  }

  private func crownStep(_ field: Field) -> Double {
    field == .weight ? Logbook.weightStep(unit: store.unit) : 1
  }
}

/// Every set of an exercise: pick one to fix it, swipe a done one to clear it.
struct SetListView: View {
  @EnvironmentObject private var store: WatchStore
  let exercise: WatchExercise
  let workout: WatchWorkout
  let onPick: (String) -> Void

  var body: some View {
    List {
      ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { index, set in
        Button {
          onPick(set.id)
        } label: {
          HStack(spacing: 6) {
            Text("\(index + 1)")
              .foregroundStyle(.secondary)
              .frame(minWidth: 16, alignment: .leading)
            Text(Logbook.summary(of: set, kind: exercise.kind))
              .lineLimit(1)
            Spacer(minLength: 4)
            if set.done {
              Image(systemName: "checkmark")
                .foregroundStyle(store.accent)
            }
          }
        }
        .swipeActions {
          if set.done {
            Button("Clear", role: .destructive) {
              store.clear(set, in: exercise, of: workout)
            }
          }
        }
      }
      Button {
        store.addSet(to: exercise, of: workout)
      } label: {
        Label("Add set", systemImage: "plus")
      }
    }
    .navigationTitle(exercise.name)
  }
}
