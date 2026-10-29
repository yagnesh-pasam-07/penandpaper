import AppKit
import Core
import ServiceManagement

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    static weak var shared: AppDelegate?
    private var statusItem: NSStatusItem!
    private let quickItem = NSMenuItem(title: "", action: #selector(quickThought), keyEquivalent: "")
    private let voiceItem = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let signInItem = NSMenuItem(title: "", action: #selector(signIn), keyEquivalent: "")
    private let loginItem = NSMenuItem(title: "Launch at login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
    private let waitingItem = NSMenuItem(title: "", action: nil, keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        NSApp.setActivationPolicy(.accessory)
        buildMainMenu()
        buildStatusItem()
        registerHotKeys()
        NotificationCenter.default.addObserver(forName: Settings.changed, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.registerHotKeys() }
        }
        Capture.shared.start()
        if Keychain.token() == nil { askForToken() }
    }

    // MARK: Menu bar

    private func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            let image = NSImage(systemSymbolName: "square.and.pencil", accessibilityDescription: "Pen & Paper")
            image?.isTemplate = true
            button.image = image
        }
        let menu = NSMenu()
        menu.delegate = self
        quickItem.target = self
        signInItem.target = self
        loginItem.target = self
        voiceItem.isEnabled = false
        waitingItem.isEnabled = false
        menu.addItem(quickItem)
        menu.addItem(voiceItem)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Open Pen & Paper", action: #selector(openSite), keyEquivalent: "").target = self
        menu.addItem(signInItem)
        menu.addItem(withTitle: "Settings…", action: #selector(openSettings), keyEquivalent: ",").target = self
        menu.addItem(loginItem)
        menu.addItem(waitingItem)
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Pen & Paper Capture", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        quickItem.title = "Quick thought…   \(Settings.shared.quickKey.display)"
        voiceItem.title = "Hold to talk   \(Settings.shared.voiceKey.display)"
        signInItem.title = Keychain.token() == nil ? "Sign in with token…" : "Change token…"
        loginItem.state = SMAppService.mainApp.status == .enabled ? .on : .off
        let waiting = OutboxStore.shared.count
        waitingItem.title = waiting > 0 ? "\(waiting) waiting to sync" : "Everything is synced"
    }

    // MARK: Main menu (so ⌘C/⌘V work in the settings window)

    private func buildMainMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Pen & Paper Capture", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)
        NSApp.mainMenu = main
    }

    // MARK: Shortcuts

    private func registerHotKeys() {
        let settings = Settings.shared
        let quickOK = HotKeyManager.shared.register(id: 1, combo: settings.quickKey, pressed: { QuickPanelController.shared.toggle() })
        let voiceOK = HotKeyManager.shared.register(id: 2, combo: settings.voiceKey, pressed: { VoiceRecorder.shared.pressed() }, released: { VoiceRecorder.shared.released() })
        if !quickOK { Toast.show("\(settings.quickKey.display) is taken by another app. Pick another in Settings.") }
        else if !voiceOK { Toast.show("\(settings.voiceKey.display) is taken by another app. Pick another in Settings.") }
    }

    // MARK: Actions

    @objc private func quickThought() { QuickPanelController.shared.show() }

    @objc private func openSite() {
        if let url = URL(string: Settings.shared.server + "/drop") { NSWorkspace.shared.open(url) }
    }

    @objc private func signIn() { askForToken() }
    @objc private func openSettings() { SettingsWindow.show() }
    @objc private func toggleLaunchAtLogin() { setLaunchAtLogin(SMAppService.mainApp.status != .enabled) }
    @objc private func quit() { NSApp.terminate(nil) }

    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            Toast.show("Couldn't change launch at login. Move the app to Applications first.")
        }
    }

    /// A small sheet that takes the token. It's kept in the Keychain, never shown again.
    func askForToken() {
        let alert = NSAlert()
        alert.messageText = "Sign in with a token"
        alert.informativeText = "In Pen & Paper, open Settings → Desktop app and create a token, then paste it here. It's kept in your Keychain."
        let field = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.placeholderString = "pp_…"
        alert.accessoryView = field
        alert.addButton(withTitle: "Save")
        alert.addButton(withTitle: "Cancel")
        NSApp.activate(ignoringOtherApps: true)
        alert.window.initialFirstResponder = field
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        let value = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.hasPrefix("pp_"), Keychain.save(token: value) else {
            Toast.show("That doesn't look like a Pen & Paper token. It starts with pp_.")
            return
        }
        Toast.show("Signed in.")
        Task {
            await Capture.shared.refreshTarget()
            await Capture.shared.flush()
        }
    }
}
