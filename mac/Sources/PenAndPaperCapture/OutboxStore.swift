import Core
import Foundation

/// The on-disk outbox: `outbox.json` plus an `audio/` folder in Application Support.
/// Every change is written before anything is sent, so a quit or a crash loses nothing.
final class OutboxStore {
    static let shared = OutboxStore()

    private let folder: URL
    private let file: URL
    let audioFolder: URL
    private var items: [OutboxItem] = []
    private let lock = NSLock()

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        folder = support.appendingPathComponent("PenAndPaperCapture", isDirectory: true)
        audioFolder = folder.appendingPathComponent("audio", isDirectory: true)
        file = folder.appendingPathComponent("outbox.json")
        try? FileManager.default.createDirectory(at: audioFolder, withIntermediateDirectories: true)
        if let data = try? Data(contentsOf: file), let saved = try? JSONDecoder().decode([OutboxItem].self, from: data) { items = saved }
    }

    var all: [OutboxItem] {
        lock.lock(); defer { lock.unlock() }
        return items
    }

    var count: Int { all.count }

    func audioURL(_ item: OutboxItem) -> URL? { item.audioFile.map { audioFolder.appendingPathComponent($0) } }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) { try? data.write(to: file, options: .atomic) }
    }

    func add(_ item: OutboxItem) {
        lock.lock(); defer { lock.unlock() }
        let result = Outbox.enqueue(items, item)
        items = result.list
        for gone in result.dropped { delete(audioOf: gone) }
        persist()
    }

    func remove(id: String) {
        lock.lock(); defer { lock.unlock() }
        if let item = items.first(where: { $0.id == id }) { delete(audioOf: item) }
        items = Outbox.remove(items, id: id)
        persist()
    }

    func markFailed(id: String) {
        lock.lock(); defer { lock.unlock() }
        items = Outbox.failed(items, id: id, now: Date().timeIntervalSince1970 * 1000)
        persist()
    }

    func due(force: String? = nil) -> [OutboxItem] {
        lock.lock(); defer { lock.unlock() }
        return Outbox.due(items, now: Date().timeIntervalSince1970 * 1000, force: force)
    }

    private func delete(audioOf item: OutboxItem) {
        if let url = item.audioFile.map({ audioFolder.appendingPathComponent($0) }) { try? FileManager.default.removeItem(at: url) }
    }
}
