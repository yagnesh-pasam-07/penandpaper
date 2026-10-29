import AppKit
import Core
import Foundation
import Network

/// Saving: typed notes and voice notes both go through the outbox, so they are
/// on disk before the first request and retried until the site has them.
@MainActor
final class Capture {
    static let shared = Capture()
    private let store = OutboxStore.shared
    private var flushing = false
    private var timer: Timer?
    private let monitor = NWPathMonitor()

    /// Undo needs `DELETE /api/drop/thoughts/<id>` to accept the token. It only accepts a
    /// browser session today, so the toast doesn't offer Undo. Flip this when the site does.
    static let undoSupported = false

    func start() {
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in Task { @MainActor in await self?.flush() } }
        monitor.pathUpdateHandler = { [weak self] path in
            if path.status == .satisfied { Task { @MainActor in await self?.flush() } }
        }
        monitor.start(queue: DispatchQueue(label: "pp.network"))
        Task { await flush() }
    }

    // MARK: Typed notes

    /// Optimistic: the box has already closed. Queue it, then try at once.
    func saveTyped(_ text: String) {
        let words = cleanedThought(text)
        guard !words.isEmpty else { return }
        let id = newThoughtId()
        store.add(OutboxItem(id: id, kind: .text, text: words, createdAt: Date().timeIntervalSince1970 * 1000))
        Task { await flush(force: id, announce: id) }
    }

    // MARK: Voice notes

    /// `file` is the finished recording; it moves into the outbox folder and is sent.
    func saveVoice(file: URL) {
        let id = newThoughtId()
        let name = "\(id).m4a"
        let destination = store.audioFolder.appendingPathComponent(name)
        try? FileManager.default.removeItem(at: destination)
        do { try FileManager.default.moveItem(at: file, to: destination) } catch {
            Toast.show("Couldn't keep that recording.")
            return
        }
        store.add(OutboxItem(id: id, kind: .audio, audioFile: name, createdAt: Date().timeIntervalSince1970 * 1000))
        Task { await flush(force: id, announce: id) }
    }

    // MARK: Sending

    /// Tries what is due. `announce` is an id whose result should be said out loud in a toast.
    func flush(force: String? = nil, announce: String? = nil) async {
        if flushing { return }
        flushing = true
        defer { flushing = false }
        guard let token = Keychain.token() else {
            if let announce { Toast.show("Saved on this Mac. Sign in from the menu to sync."); _ = announce }
            return
        }
        let server = Settings.shared.server
        for item in store.due(force: force) {
            let answer = await send(item, server: server, token: token)
            let outcome = item.kind == .text ? Outcomes.typed(status: answer.status, response: answer.response) : Outcomes.voice(status: answer.status, response: answer.response)
            if outcome.kind == .saved {
                if let name = answer.response.paperName, !name.isEmpty { Settings.shared.cachedPaperName = name }
                store.remove(id: item.id)
            } else if outcome.keep {
                store.markFailed(id: item.id)
            } else {
                store.remove(id: item.id)
            }
            if item.id == announce { Toast.show(outcome.message) }
        }
    }

    private func send(_ item: OutboxItem, server: String, token: String) async -> Answer {
        switch item.kind {
        case .text:
            return await Net.send(API.capture(server: server, token: token, id: item.id, text: item.text ?? ""))
        case .audio:
            guard let url = store.audioURL(item), let audio = try? Data(contentsOf: url) else { return Answer(status: 400, response: CaptureResponse(error: "That recording is gone.")) }
            let boundary = Multipart.newBoundary()
            let body = Multipart.body(boundary: boundary, fields: [("save", "1"), ("id", item.id)], file: (name: "audio", filename: "voice.m4a", mime: "audio/mp4", data: audio))
            return await Net.send(API.transcribe(server: server, token: token, id: item.id, boundary: boundary), body: body)
        }
    }

    /// Asks the site where the next note will land, to show "to <paper>".
    func refreshTarget() async {
        guard let token = Keychain.token() else { return }
        let answer = await Net.send(API.target(server: Settings.shared.server, token: token))
        if answer.status == 200, let name = answer.response.paperName, !name.isEmpty { Settings.shared.cachedPaperName = name }
    }
}
