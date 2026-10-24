import SwiftUI
import WidgetKit

// Plato on the watch face. It only ever shows the logo and opens the watch
// app, so it has one entry and never needs refreshing — which also means it
// needs nothing from the app, and no shared storage to get it.

struct PlatoEntry: TimelineEntry {
  let date: Date
}

struct PlatoProvider: TimelineProvider {
  func placeholder(in context: Context) -> PlatoEntry {
    PlatoEntry(date: Date())
  }

  func getSnapshot(in context: Context, completion: @escaping (PlatoEntry) -> Void) {
    completion(PlatoEntry(date: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<PlatoEntry>) -> Void) {
    completion(Timeline(entries: [PlatoEntry(date: Date())], policy: .never))
  }
}

struct PlatoComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: PlatoEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        logo.padding(7)
      }
    case .accessoryCorner:
      logo
        .padding(2)
        .widgetLabel("Plato")
    case .accessoryInline:
      Text("Plato")
    case .accessoryRectangular:
      HStack(spacing: 8) {
        logo.frame(width: 30, height: 30)
        VStack(alignment: .leading, spacing: 0) {
          Text("Plato")
            .font(.headline)
          Text("Log a workout")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
      }
    default:
      logo
    }
  }

  /// A template image, so the face can tint it like its other complications.
  private var logo: some View {
    Image("logo")
      .renderingMode(.template)
      .resizable()
      .scaledToFit()
      .widgetAccentable()
  }
}

@main
struct PlatoComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "PlatoComplication", provider: PlatoProvider()) { entry in
      PlatoComplicationView(entry: entry)
        .containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName("Plato")
    .description("Open Plato from your watch face.")
    .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline])
  }
}
