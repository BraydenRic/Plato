import SwiftUI

/// No workout running: pick a template to start one.
struct TemplatesView: View {
  let templates: [WatchTemplate]

  var body: some View {
    NavigationStack {
      List {
        // First, so a run is one tap in from opening the app.
        NavigationLink(value: CardioRoute.picker) {
          Label("Cardio", systemImage: "figure.run")
            .font(.headline)
        }
        if templates.isEmpty {
          Text("Save a template in Plato on your iPhone and it will show up here.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .listRowBackground(Color.clear)
        } else {
          ForEach(templates) { template in
            NavigationLink(value: template) {
              VStack(alignment: .leading, spacing: 2) {
                Text(template.name)
                  .font(.headline)
                  .lineLimit(2)
                Text(Logbook.templateMeta(template))
                  .font(.footnote)
                  .foregroundStyle(.secondary)
              }
              .padding(.vertical, 2)
            }
          }
        }
        // Which build the watch is running — watch apps update on their own
        // schedule, a while after the phone, so "is this the new one?" comes up.
        Text(versionLabel)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .listRowBackground(Color.clear)
      }
      .navigationTitle("Start")
      .navigationDestination(for: WatchTemplate.self) { template in
        TemplateDetailView(template: template)
      }
      .navigationDestination(for: CardioRoute.self) { route in
        switch route {
        case .picker: CardioPickerView()
        case .kind(let kind): CardioStartView(kind: kind)
        }
      }
    }
  }
}

private var versionLabel: String {
  let info = Bundle.main.infoDictionary
  let version = info?["CFBundleShortVersionString"] as? String ?? "?"
  let build = info?["CFBundleVersion"] as? String ?? "?"
  return "Plato \(version) (\(build))"
}

/// A look at the template before starting it, so a stray tap on the list
/// can't start a workout by itself.
struct TemplateDetailView: View {
  @EnvironmentObject private var store: WatchStore
  let template: WatchTemplate

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Text(template.name)
          .font(.title3.weight(.semibold))
          .lineLimit(3)
        Text(Logbook.templateMeta(template))
          .font(.footnote)
          .foregroundStyle(.secondary)
        Button {
          store.startWorkout(template)
        } label: {
          Text("Start")
            .font(.headline)
            .foregroundStyle(store.onAccent)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .handGestureShortcut(.primaryAction)

        VStack(alignment: .leading, spacing: 4) {
          ForEach(Array(template.exercises.enumerated()), id: \.offset) { _, name in
            Text(name)
              .font(.footnote)
              .lineLimit(1)
          }
          if template.exerciseCount > template.exercises.count {
            Text("+\(template.exerciseCount - template.exercises.count) more")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }
}
