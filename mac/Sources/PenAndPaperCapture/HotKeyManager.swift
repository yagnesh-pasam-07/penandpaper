import Carbon.HIToolbox
import Core
import Foundation

/// System-wide shortcuts through Carbon's RegisterEventHotKey, which needs no
/// Accessibility permission. It reports both the press and the release, which
/// hold-to-talk needs.
@MainActor
final class HotKeyManager {
    static let shared = HotKeyManager()

    typealias Handler = (pressed: @MainActor () -> Void, released: @MainActor () -> Void)
    private var handlers: [UInt32: Handler] = [:]
    private var refs: [UInt32: EventHotKeyRef] = [:]
    private var installed = false
    private static let signature: OSType = 0x5050_4350 // "PPCP"

    /// Registers (or replaces) a shortcut. Returns false when the system refuses it, e.g. another app owns it.
    @discardableResult
    func register(id: UInt32, combo: HotKeyCombo, pressed: @escaping @MainActor () -> Void, released: @escaping @MainActor () -> Void = {}) -> Bool {
        installHandlerIfNeeded()
        unregister(id: id)
        guard combo.isUsable else { return false }
        var ref: EventHotKeyRef?
        let hotKeyID = EventHotKeyID(signature: HotKeyManager.signature, id: id)
        let status = RegisterEventHotKey(combo.keyCode, combo.modifiers, hotKeyID, GetApplicationEventTarget(), 0, &ref)
        guard status == noErr, let ref else { return false }
        refs[id] = ref
        handlers[id] = (pressed, released)
        return true
    }

    func unregister(id: UInt32) {
        if let ref = refs[id] { UnregisterEventHotKey(ref) }
        refs[id] = nil
        handlers[id] = nil
    }

    private func installHandlerIfNeeded() {
        guard !installed else { return }
        installed = true
        var spec = [
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)),
            EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased)),
        ]
        InstallEventHandler(GetApplicationEventTarget(), { _, event, userData in
            guard let event, let userData else { return OSStatus(eventNotHandledErr) }
            var hotKeyID = EventHotKeyID()
            let status = GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hotKeyID)
            guard status == noErr else { return status }
            let manager = Unmanaged<HotKeyManager>.fromOpaque(userData).takeUnretainedValue()
            let kind = GetEventKind(event)
            let id = hotKeyID.id
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    guard let handler = manager.handlers[id] else { return }
                    if kind == UInt32(kEventHotKeyPressed) { handler.pressed() } else { handler.released() }
                }
            }
            return noErr
        }, 2, &spec, Unmanaged.passUnretained(self).toOpaque(), nil)
    }
}
