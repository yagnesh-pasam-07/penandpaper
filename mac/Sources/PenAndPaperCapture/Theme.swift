import AppKit
import SwiftUI

/// The paper and ink palette of the web app, light and dark.
enum Theme {
    private static func dynamic(light: UInt32, dark: UInt32) -> NSColor {
        NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSColor(hex: isDark ? dark : light)
        }
    }

    static let bg = Color(nsColor: dynamic(light: 0xFAF8F3, dark: 0x151412))
    static let sheet = Color(nsColor: dynamic(light: 0xFFFFFF, dark: 0x1E1D1A))
    static let ink = Color(nsColor: dynamic(light: 0x1D1C1A, dark: 0xECE9E2))
    static let mute = Color(nsColor: dynamic(light: 0x6D6A63, dark: 0xA29E94))
    static let line = Color(nsColor: dynamic(light: 0xE6E1D7, dark: 0x34312C))
    static let red = Color(nsColor: dynamic(light: 0xC0392B, dark: 0xE07A6B))

    /// A handwriting-style face that ships with macOS; falls back to the system font.
    static func hand(_ size: CGFloat, bold: Bool = false) -> Font {
        .custom(bold ? "Noteworthy-Bold" : "Noteworthy-Light", size: size)
    }

    static func handNS(_ size: CGFloat) -> NSFont { NSFont(name: "Noteworthy-Light", size: size) ?? .systemFont(ofSize: size) }
}

extension NSColor {
    convenience init(hex: UInt32) {
        self.init(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}
