import AppKit
import Carbon.HIToolbox
import Core
import ServiceManagement
import Speech
import SwiftUI

/// Click it, then press the shortcut you want. Needs ⌘, ⌃ or ⌥; Esc cancels.
final class RecorderField: NSView {
    var combo: HotKeyCombo { didSet { needsDisplay = true } }
    var onChange: (HotKeyCombo) -> Void = { _ in }
    private var recording = false { didSet { needsDisplay = true } }

    init(combo: HotKeyCombo) {
        self.combo = combo
        super.init(frame: NSRect(x: 0, y: 0, width: 150, height: 26))
        wantsLayer = true
    }

    required init?(coder: NSCoder) { nil }

    override var acceptsFirstResponder: Bool { true }
    override var intrinsicContentSize: NSSize { NSSize(width: 150, height: 26) }

    override func mouseDown(with event: NSEvent) {
        recording = true
        window?.makeFirstResponder(self)
    }

    override func resignFirstResponder() -> Bool {
        recording = false
        return super.resignFirstResponder()
    }

    override func keyDown(with event: NSEvent) {
        guard recording else { return super.keyDown(with: event) }
        if event.keyCode == 53 { recording = false; return }
        var mask: UInt32 = 0
        let flags = event.modifierFlags
        if flags.contains(.command) { mask |= HotKeyCombo.command }
        if flags.contains(.option) { mask |= HotKeyCombo.option }
        if flags.contains(.control) { mask |= HotKeyCombo.control }
        if flags.contains(.shift) { mask |= HotKeyCombo.shift }
        let next = HotKeyCombo(keyCode: UInt32(event.keyCode), modifiers: mask)
        guard next.isUsable else { NSSound.beep(); return }
        combo = next
        recording = false
        onChange(next)
    }

    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5), xRadius: 6, yRadius: 6)
        (recording ? NSColor.controlAccentColor.withAlphaComponent(0.12) : NSColor.controlBackgroundColor).setFill()
        path.fill()
        (recording ? NSColor.controlAccentColor : NSColor.separatorColor).setStroke()
        path.stroke()
        let text = recording ? "Press the keys…" : combo.display
        let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 13), .foregroundColor: NSColor.labelColor]
        let size = text.size(withAttributes: attributes)
        text.draw(at: NSPoint(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2), withAttributes: attributes)
    }
}

private struct HotKeyField: NSViewRepresentable {
    @Binding var combo: HotKeyCombo
    func makeNSView(context: Context) -> RecorderField {
        let field = RecorderField(combo: combo)
        field.onChange = { combo = $0 }
        return field
    }
    func updateNSView(_ field: RecorderField, context: Context) { field.combo = combo }
}

private struct SettingsView: View {
    @State private var server = Settings.shared.server
    @State private var quick = Settings.shared.quickKey
    @State private var voice = Settings.shared.voiceKey
    @State private var signedIn = Keychain.token() != nil
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    @State private var testResult = ""
    @State private var testing = false
    @State private var serverNote = ""
    @State private var speechOptions = SpeechLocale.options(supported: SFSpeechRecognizer.supportedLocales().map(\.identifier))
    @State private var speechLocale = SettingsView.initialLocale()
    @State private var serverVoice = Settings.shared.useServerTranscription

    var body: some View {
        Form {
            Section("Pen & Paper") {
                TextField("Server", text: $server, onCommit: commitServer)
                    .textFieldStyle(.roundedBorder)
                Text(serverNote.isEmpty ? "Use http://localhost:3000 to try it against a local copy." : serverNote)
                    .font(.caption).foregroundColor(.secondary)
                HStack {
                    Text(signedIn ? "Signed in with a token." : "Not signed in.")
                    Spacer()
                    Button(signedIn ? "Change token…" : "Sign in with token…") { AppDelegate.shared?.askForToken(); signedIn = Keychain.token() != nil }
                    if signedIn { Button("Sign out") { Keychain.clear(); signedIn = false } }
                }
                HStack {
                    Button(testing ? "Testing…" : "Test connection") { test() }.disabled(testing)
                    Text(testResult).font(.caption).foregroundColor(.secondary)
                }
            }
            Section("Shortcuts") {
                HStack { Text("Quick thought"); Spacer(); HotKeyField(combo: $quick).frame(width: 150, height: 26) }
                HStack { Text("Hold to talk"); Spacer(); HotKeyField(combo: $voice).frame(width: 150, height: 26) }
                Text("Each needs ⌘, ⌃ or ⌥. Click a box, then press the keys.").font(.caption).foregroundColor(.secondary)
            }
            Section("Voice") {
                Picker("Language", selection: $speechLocale) {
                    ForEach(speechOptions, id: \.self) { id in Text(SettingsView.name(of: id)).tag(id) }
                }
                Text(speechNote()).font(.caption).foregroundColor(.secondary)
                Toggle("Use server transcription (needs an OpenAI key on the server)", isOn: $serverVoice)
                Text("Off by default. Voice is turned into text on this Mac, so it needs no key and no account.")
                    .font(.caption).foregroundColor(.secondary)
            }
            Section {
                Toggle("Launch at login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { enabled in AppDelegate.shared?.setLaunchAtLogin(enabled) }
            }
        }
        .formStyle(.grouped)
        .onChange(of: quick) { Settings.shared.quickKey = $0 }
        .onChange(of: voice) { Settings.shared.voiceKey = $0 }
        .onChange(of: speechLocale) { Settings.shared.speechLocale = $0 }
        .onChange(of: serverVoice) { Settings.shared.useServerTranscription = $0 }
        .padding(8)
        .frame(width: 460)
        .onDisappear { commitServer() }
    }

    /// The language shown first: the saved one, else what hold-to-talk would pick on its own.
    private static func initialLocale() -> String {
        let supported = SFSpeechRecognizer.supportedLocales().map(\.identifier)
        return SpeechLocale.choose(saved: Settings.shared.speechLocale, current: Locale.current.identifier, supported: supported) ?? "en-US"
    }

    private static func name(of id: String) -> String {
        let locale = Locale.current
        return "\(locale.localizedString(forIdentifier: id) ?? id) (\(id))"
    }

    /// Whether the chosen language is understood on this Mac or by Apple's servers.
    private func speechNote() -> String {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: speechLocale)) else { return "This Mac can't recognise that language." }
        return recognizer.supportsOnDeviceRecognition
            ? "Recognised on this Mac: your voice doesn't leave it."
            : "This language isn't available on this Mac, so Apple's servers do the listening. Download it in System Settings → Keyboard → Dictation to keep it on this Mac."
    }

    private func commitServer() {
        if let normalized = normalizeServer(server) {
            server = normalized
            Settings.shared.server = normalized
            serverNote = ""
        } else {
            serverNote = "That isn't a usable address. Use https://… (http only for localhost)."
            server = Settings.shared.server
        }
    }

    private func test() {
        commitServer()
        guard let token = Keychain.token() else { testResult = "Sign in first."; return }
        testing = true
        testResult = ""
        Task {
            let answer = await Net.send(API.target(server: Settings.shared.server, token: token))
            testing = false
            switch answer.status {
            case 200: testResult = "Connected. Notes go to “\(answer.response.paperName ?? "your latest paper")”."
            case 401: testResult = "The token was refused. Make a new one in the web app."
            case 0: testResult = "Couldn't reach the server."
            default: testResult = "The server answered \(answer.status)."
            }
        }
    }
}

@MainActor
enum SettingsWindow {
    private static var window: NSWindow?

    static func show() {
        if window == nil {
            let host = NSHostingController(rootView: SettingsView())
            let w = NSWindow(contentViewController: host)
            w.title = "Pen & Paper Capture"
            w.styleMask = [.titled, .closable]
            w.isReleasedWhenClosed = false
            w.center()
            window = w
        }
        NSApp.activate(ignoringOtherApps: true)
        window?.makeKeyAndOrderFront(nil)
    }
}
