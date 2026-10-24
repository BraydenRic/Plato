import SwiftUI

/// Typing a number instead of turning the crown: a jump like 135 → 225, or an
/// exact 8 reps, in a few taps.
struct KeypadView: View {
  let title: String
  /// The current value, shown greyed out until something is typed.
  let placeholder: String
  @State var entry: KeypadEntry
  /// nil when nothing was typed — the value stays as it was.
  let onDone: (Double?) -> Void
  let onCancel: () -> Void

  var body: some View {
    VStack(spacing: 4) {
      Text(entry.isEmpty ? placeholder : entry.display)
        .font(.plateNumber(28))
        .foregroundStyle(entry.isEmpty ? .secondary : .primary)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
        .frame(maxWidth: .infinity)
      ForEach(0..<4, id: \.self) { row in
        HStack(spacing: 4) {
          ForEach(0..<3, id: \.self) { column in
            key(at: row, column)
          }
        }
      }
    }
    .navigationTitle(title)
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button {
          onCancel()
        } label: {
          Image(systemName: "xmark")
        }
      }
      ToolbarItem(placement: .confirmationAction) {
        Button {
          onDone(entry.value)
        } label: {
          Image(systemName: "checkmark")
        }
      }
    }
  }

  /// 1 2 3 / 4 5 6 / 7 8 9 / extra 0 ⌫ — the extra key is the decimal point
  /// for kilos, ± for a bodyweight load, and nothing for whole pounds and reps.
  private func keyFor(_ row: Int, _ column: Int) -> KeypadKey? {
    if row < 3 { return .digit(row * 3 + column + 1) }
    switch column {
    case 0:
      if entry.allowsSign { return .sign }
      return entry.allowsDecimal ? .point : nil
    case 1:
      return .digit(0)
    default:
      return .delete
    }
  }

  @ViewBuilder
  private func key(at row: Int, _ column: Int) -> some View {
    if let key = keyFor(row, column) {
      Button {
        entry.press(key)
      } label: {
        keyLabel(key)
          .font(.title3.weight(.medium))
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(RoundedRectangle(cornerRadius: 8).fill(Color.gray.opacity(0.25)))
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
    } else {
      Color.clear
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  @ViewBuilder
  private func keyLabel(_ key: KeypadKey) -> some View {
    switch key {
    case .digit(let digit):
      Text("\(digit)")
    case .point:
      Text(".")
    case .sign:
      Text("\u{00B1}")
    case .delete:
      Image(systemName: "delete.left")
    }
  }
}
