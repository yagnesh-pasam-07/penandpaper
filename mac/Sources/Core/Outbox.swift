import Foundation

/// What a waiting item is: words typed in the box, or a recording waiting to be transcribed.
public enum OutboxKind: String, Codable, Equatable {
    case text
    case audio
}

/// One thing kept on this Mac until the site has it, so a dropped connection,
/// an expired token or a server hiccup never loses a thought.
public struct OutboxItem: Codable, Equatable, Identifiable {
    public var id: String
    public var kind: OutboxKind
    public var text: String?
    /// File name inside the outbox's audio folder (audio items only).
    public var audioFile: String?
    /// Milliseconds since the epoch.
    public var createdAt: Double
    public var attempts: Int
    /// Not tried again before this time (milliseconds since the epoch).
    public var nextAt: Double

    public init(id: String, kind: OutboxKind, text: String? = nil, audioFile: String? = nil, createdAt: Double, attempts: Int = 0, nextAt: Double = 0) {
        self.id = id
        self.kind = kind
        self.text = text
        self.audioFile = audioFile
        self.createdAt = createdAt
        self.attempts = attempts
        self.nextAt = nextAt
    }
}

/// The outbox rules, ported from the browser extension's `outbox.js`: pure
/// functions over a plain list, so they can be tested without a disk or network.
public enum Outbox {
    /// More than this and the oldest waiting item is dropped to make room.
    public static let maxItems = 200
    public static let firstRetryMs: Double = 30_000
    public static let longestWaitMs: Double = 60 * 60_000

    /// How long to wait before the next try, after `attempts` failures (30 s, 1 min, 2 min … up to an hour).
    public static func backoffMs(_ attempts: Int) -> Double {
        let n = max(1, attempts)
        return min(firstRetryMs * pow(2, Double(n - 1)), longestWaitMs)
    }

    /// Adds an item (once: the same id is not added twice). Returns the new list and anything pushed out to make room.
    public static func enqueue(_ list: [OutboxItem], _ item: OutboxItem) -> (list: [OutboxItem], dropped: [OutboxItem]) {
        if list.contains(where: { $0.id == item.id }) { return (list, []) }
        var next = list
        next.append(OutboxItem(id: item.id, kind: item.kind, text: item.text, audioFile: item.audioFile, createdAt: item.createdAt, attempts: 0, nextAt: 0))
        guard next.count > maxItems else { return (next, []) }
        let overflow = next.count - maxItems
        return (Array(next.dropFirst(overflow)), Array(next.prefix(overflow)))
    }

    public static func remove(_ list: [OutboxItem], id: String) -> [OutboxItem] {
        list.contains(where: { $0.id == id }) ? list.filter { $0.id != id } : list
    }

    /// What is due to be tried, oldest first. `force` is an id to try even if its wait isn't over.
    public static func due(_ list: [OutboxItem], now: Double, force: String? = nil) -> [OutboxItem] {
        list.filter { $0.id == force || $0.nextAt <= now }.sorted { $0.createdAt < $1.createdAt }
    }

    /// A failed try: one more attempt counted and the next one pushed back.
    public static func failed(_ list: [OutboxItem], id: String, now: Double) -> [OutboxItem] {
        list.map { item in
            guard item.id == id else { return item }
            var copy = item
            copy.attempts += 1
            copy.nextAt = now + backoffMs(copy.attempts)
            return copy
        }
    }

    /// Whether a failed save is worth trying again. No answer at all (0), signed
    /// out (401), refused for now (403, 408, 429) and a broken server (5xx) are;
    /// a thought the site says it can never take (400 and the like) is not.
    public static func retryable(status: Int) -> Bool {
        status == 0 || status == 401 || status == 403 || status == 408 || status == 429 || status >= 500
    }

    /// What a typed-but-unsent box leaves behind for next time: its words, or nothing.
    public static func keptDraft(_ text: String?) -> String {
        (text ?? "").replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
