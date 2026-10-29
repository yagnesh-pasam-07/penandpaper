import Foundation

/// Choosing the language the recogniser listens for. Pure, so it can be tested without the Speech framework.
public enum SpeechLocale {
    /// Offered first, whenever this Mac supports them.
    public static let preferred = ["en-IN", "en-US", "hi-IN", "te-IN"]

    /// Locale identifiers come as `en_IN` or `en-IN`; the app keeps the hyphen form.
    public static func normalize(_ identifier: String) -> String {
        identifier.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "_", with: "-")
    }

    private static func language(_ identifier: String) -> String {
        normalize(identifier).split(separator: "-").first.map { String($0).lowercased() } ?? ""
    }

    /// A supported identifier that matches `wanted`: the exact one, else the same language
    /// (preferring the curated regions, then the first supported).
    static func match(_ wanted: String, in supported: [String]) -> String? {
        let wanted = normalize(wanted)
        if wanted.isEmpty { return nil }
        if let exact = supported.first(where: { $0.lowercased() == wanted.lowercased() }) { return exact }
        let lang = language(wanted)
        if lang.isEmpty { return nil }
        let same = supported.filter { language($0) == lang }
        return preferred.compactMap { p in same.first { $0.lowercased() == p.lowercased() } }.first ?? same.first
    }

    /// The locale to listen for: the saved choice when this Mac supports it, else the Mac's own
    /// language, else Indian or US English, else whatever is supported. nil when nothing is.
    public static func choose(saved: String?, current: String, supported rawSupported: [String]) -> String? {
        let supported = rawSupported.map(normalize)
        if supported.isEmpty { return nil }
        for candidate in [saved ?? "", current] {
            if let found = match(candidate, in: supported) { return found }
        }
        return match("en-IN", in: supported) ?? match("en-US", in: supported) ?? supported.first
    }

    /// What the picker lists: the curated languages this Mac supports, then every other supported one, A to Z.
    public static func options(supported rawSupported: [String]) -> [String] {
        var seen = Set<String>()
        let supported = rawSupported.map(normalize).filter { seen.insert($0.lowercased()).inserted }
        let first = preferred.compactMap { p in supported.first { $0.lowercased() == p.lowercased() } }
        let rest = supported.filter { id in !first.contains(id) }.sorted { $0.lowercased() < $1.lowercased() }
        return first + rest
    }
}

/// Where a hold-to-talk is: idle, listening since a moment, or waiting for the last words after the key came up.
public enum VoicePhase: Equatable {
    case idle
    case listening(startedMs: Int)
    case finishing
}

public enum VoiceEvent: Equatable {
    case pressed(nowMs: Int)
    case released(nowMs: Int)
    case tick(nowMs: Int)
    /// The recogniser's last words (nil or empty when it heard nothing, or gave up).
    case result(String?)
}

/// What the app should do as a result of an event.
public enum VoiceAction: Equatable {
    case none
    case startListening
    /// A tap too short to count: throw it away quietly.
    case cancel
    /// The key came up (or the limit hit): stop the microphone and wait for the final words.
    case stopAndFinish
    case save(String)
    case nothingHeard
}

public struct VoiceStep: Equatable {
    public var phase: VoicePhase
    public var action: VoiceAction
}

/// The rules of a hold-to-talk, with no microphone in sight: a hold under 0.3 s is ignored,
/// one past 60 s stops by itself, and the words are kept to a thought's length.
public enum VoiceFlow {
    public static func reduce(_ phase: VoicePhase, _ event: VoiceEvent) -> VoiceStep {
        switch (phase, event) {
        case (.idle, .pressed(let now)):
            return VoiceStep(phase: .listening(startedMs: now), action: .startListening)
        case (.listening(let started), .released(let now)):
            if VoiceHold.verdict(durationMs: VoiceHold.clamped(durationMs: now - started)) == .tooShort {
                return VoiceStep(phase: .idle, action: .cancel)
            }
            return VoiceStep(phase: .finishing, action: .stopAndFinish)
        case (.listening(let started), .tick(let now)):
            if now - started >= VoiceHold.maximumMs { return VoiceStep(phase: .finishing, action: .stopAndFinish) }
            return VoiceStep(phase: phase, action: .none)
        case (.finishing, .result(let text)):
            let words = cleanedThought(text ?? "")
            return words.isEmpty ? VoiceStep(phase: .idle, action: .nothingHeard) : VoiceStep(phase: .idle, action: .save(words))
        default:
            return VoiceStep(phase: phase, action: .none)
        }
    }
}
