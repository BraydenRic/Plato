import SwiftUI
import WatchKit

extension Color {
  /// The default theme's accent, until the phone says which theme is on.
  static let platoViolet = Color(red: 0x8B / 255, green: 0x5C / 255, blue: 0xF6 / 255)

  /// "#8b5cf6" → a colour; nil for anything else.
  init?(hex: String?) {
    guard var digits = hex?.trimmingCharacters(in: .whitespaces) else { return nil }
    if digits.hasPrefix("#") { digits.removeFirst() }
    guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }
}

extension Font {
  /// The logged numbers: big, rounded, and fixed-width so they don't shuffle
  /// sideways as the crown turns them.
  static func plateNumber(_ size: CGFloat) -> Font {
    .system(size: size, weight: .semibold, design: .rounded).monospacedDigit()
  }
}

enum Haptics {
  /// A tap on the wrist confirming what you just did — never an interruption
  /// of its own.
  static func confirm() {
    WKInterfaceDevice.current().play(.success)
  }

  static func click() {
    WKInterfaceDevice.current().play(.click)
  }
}
