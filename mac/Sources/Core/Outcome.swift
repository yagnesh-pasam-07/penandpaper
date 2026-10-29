import Foundation

/// What to say about a save (a typed note or a voice note), and whether it is worth trying again.
public struct Outcome: Equatable {
    public enum Kind: Equatable { case saved, signIn, queued, rejected }
    public var kind: Kind
    public var message: String
    /// True when the item should stay in the outbox for another try.
    public var keep: Bool

    public init(kind: Kind, message: String, keep: Bool) {
        self.kind = kind
        self.message = message
        self.keep = keep
    }
}

public enum Outcomes {
    /// A typed note. `status` 0 means the request never got an answer.
    public static func typed(status: Int, response: CaptureResponse = CaptureResponse()) -> Outcome {
        switch status {
        case 200..<300:
            let name = (response.paperName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return Outcome(kind: .saved, message: "Saved to \(name.isEmpty ? "your paper" : name)", keep: false)
        case 401:
            return Outcome(kind: .signIn, message: "Saved on this Mac. Sign in again to sync.", keep: true)
        case 400:
            return Outcome(kind: .rejected, message: (response.error ?? "").isEmpty ? "Write something first." : response.error!, keep: false)
        case 429:
            return Outcome(kind: .queued, message: "Slow down a moment. Saved on this Mac, will sync.", keep: true)
        default:
            return Outcome(kind: .queued, message: "Saved on this Mac, will sync.", keep: Outbox.retryable(status: status))
        }
    }

    /// A voice note.
    public static func voice(status: Int, response: CaptureResponse = CaptureResponse()) -> Outcome {
        switch status {
        case 200..<300:
            let words = (response.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return Outcome(kind: .saved, message: words.isEmpty ? "Saved" : "Saved: \(preview(words))", keep: false)
        case 401:
            return Outcome(kind: .signIn, message: "Sign in again. Your recording is kept.", keep: true)
        case 422:
            return Outcome(kind: .rejected, message: "Didn't catch anything.", keep: false)
        case 503:
            return Outcome(kind: .queued, message: "Voice isn't set up on the server yet. Your recording is kept.", keep: true)
        case 429:
            return Outcome(kind: .queued, message: "Slow down a moment. Your recording is kept.", keep: true)
        case 413, 415:
            return Outcome(kind: .rejected, message: "That recording couldn't be used.", keep: false)
        case 400:
            return Outcome(kind: .rejected, message: (response.error ?? "").isEmpty ? "That recording couldn't be used." : response.error!, keep: false)
        default:
            return Outcome(kind: .queued, message: "Couldn't reach Pen & Paper. Your recording is kept.", keep: Outbox.retryable(status: status))
        }
    }

    /// Words said aloud and saved: "Saved: call the bank about…".
    public static func spoken(_ text: String) -> String {
        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return words.isEmpty ? "Saved" : "Saved: \(preview(words))"
    }

    public static let nothingHeard = "Didn't catch anything."

    /// The first few words of a transcript, for a toast.
    public static func preview(_ text: String, limit: Int = 48) -> String {
        let flat = text.split(whereSeparator: { $0.isNewline || $0 == " " }).joined(separator: " ")
        return flat.count <= limit ? flat : String(flat.prefix(limit)).trimmingCharacters(in: .whitespaces) + "…"
    }
}

/// How long a voice hold counts: a tap shorter than this is ignored, and a hold stops at the limit.
public enum VoiceHold {
    public static let minimumMs = 300
    public static let maximumMs = 60_000

    public enum Verdict: Equatable { case tooShort, ok }

    public static func verdict(durationMs: Int) -> Verdict { durationMs < minimumMs ? .tooShort : .ok }
    public static func clamped(durationMs: Int) -> Int { min(max(0, durationMs), maximumMs) }
    public static func clock(seconds: Int) -> String { "\(max(0, seconds) / 60):" + String(format: "%02d", max(0, seconds) % 60) }
}
