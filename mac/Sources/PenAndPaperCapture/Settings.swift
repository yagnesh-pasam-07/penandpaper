import Core
import Foundation

/// Small settings kept in UserDefaults: the server and the two shortcuts.
final class Settings {
    static let shared = Settings()
    private let defaults = UserDefaults.standard
    static let changed = Notification.Name("PenAndPaperSettingsChanged")

    var server: String {
        get { serverOrDefault(defaults.string(forKey: "server")) }
        set {
            defaults.set(normalizeServer(newValue) ?? defaultServer, forKey: "server")
            NotificationCenter.default.post(name: Settings.changed, object: nil)
        }
    }

    var quickKey: HotKeyCombo {
        get { HotKeyCombo.decode(defaults.string(forKey: "quickKey")) ?? .quickDefault }
        set {
            defaults.set(newValue.encoded(), forKey: "quickKey")
            NotificationCenter.default.post(name: Settings.changed, object: nil)
        }
    }

    var voiceKey: HotKeyCombo {
        get { HotKeyCombo.decode(defaults.string(forKey: "voiceKey")) ?? .voiceDefault }
        set {
            defaults.set(newValue.encoded(), forKey: "voiceKey")
            NotificationCenter.default.post(name: Settings.changed, object: nil)
        }
    }

    /// The last paper name the site told us a note would land on, so the box can say it before any network call.
    var cachedPaperName: String? {
        get { defaults.string(forKey: "paperName") }
        set { defaults.set(newValue, forKey: "paperName") }
    }

    /// A typed-but-unsent box leaves its words here for next time.
    var draft: String {
        get { defaults.string(forKey: "draft") ?? "" }
        set { defaults.set(newValue, forKey: "draft") }
    }
}
