import Foundation

/// A shortcut: a Carbon key code and modifier mask, stored in UserDefaults as JSON.
public struct HotKeyCombo: Codable, Equatable {
    public var keyCode: UInt32
    /// Carbon modifier mask: cmdKey 256, shiftKey 512, optionKey 2048, controlKey 4096.
    public var modifiers: UInt32

    public init(keyCode: UInt32, modifiers: UInt32) {
        self.keyCode = keyCode
        self.modifiers = modifiers
    }

    public static let command: UInt32 = 256
    public static let shift: UInt32 = 512
    public static let option: UInt32 = 2048
    public static let control: UInt32 = 4096

    /// ⌥⇧N: type a quick thought.
    public static let quickDefault = HotKeyCombo(keyCode: 45, modifiers: option | shift)
    /// ⌥Space: hold to talk.
    public static let voiceDefault = HotKeyCombo(keyCode: 49, modifiers: option)

    /// A global shortcut needs at least one of ⌘ ⌃ ⌥ (a bare letter would be typed everywhere).
    public var isUsable: Bool { modifiers & (HotKeyCombo.command | HotKeyCombo.control | HotKeyCombo.option) != 0 }

    /// Like "⌥⇧N".
    public var display: String {
        var text = ""
        if modifiers & HotKeyCombo.control != 0 { text += "⌃" }
        if modifiers & HotKeyCombo.option != 0 { text += "⌥" }
        if modifiers & HotKeyCombo.shift != 0 { text += "⇧" }
        if modifiers & HotKeyCombo.command != 0 { text += "⌘" }
        return text + HotKeyCombo.keyName(keyCode)
    }

    private static let names: [UInt32: String] = [
        0: "A", 11: "B", 8: "C", 2: "D", 14: "E", 3: "F", 5: "G", 4: "H", 34: "I", 38: "J", 40: "K", 37: "L", 46: "M",
        45: "N", 31: "O", 35: "P", 12: "Q", 15: "R", 1: "S", 17: "T", 32: "U", 9: "V", 13: "W", 7: "X", 16: "Y", 6: "Z",
        18: "1", 19: "2", 20: "3", 21: "4", 23: "5", 22: "6", 26: "7", 28: "8", 25: "9", 29: "0",
        49: "Space", 36: "Return", 48: "Tab", 51: "Delete", 53: "Esc", 123: "←", 124: "→", 125: "↓", 126: "↑",
        122: "F1", 120: "F2", 99: "F3", 118: "F4", 96: "F5", 97: "F6", 98: "F7", 100: "F8", 101: "F9", 109: "F10", 103: "F11", 111: "F12",
        27: "-", 24: "=", 33: "[", 30: "]", 41: ";", 39: "'", 43: ",", 47: ".", 44: "/", 42: "\\", 50: "`",
    ]

    public static func keyName(_ code: UInt32) -> String { names[code] ?? "Key \(code)" }

    public func encoded() -> String? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public static func decode(_ json: String?) -> HotKeyCombo? {
        guard let json, let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(HotKeyCombo.self, from: data)
    }
}
