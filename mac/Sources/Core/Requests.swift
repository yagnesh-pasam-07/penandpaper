import Foundation

public let defaultServer = "https://penandpaper-app.vercel.app"
/// The site keeps a thought to this many characters.
public let maxThought = 1000

/// The server's origin exactly as it should be used: https, or http only for this
/// computer (localhost, 127.0.0.1), with no path, query or trailing slash. nil if it isn't usable.
public func normalizeServer(_ value: String?) -> String? {
    var raw = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.isEmpty { return nil }
    if !raw.contains("://") { raw = "https://\(raw)" }
    guard let url = URL(string: raw), let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased(), !host.isEmpty else { return nil }
    let local = host == "localhost" || host == "127.0.0.1"
    guard scheme == "https" || (scheme == "http" && local) else { return nil }
    var origin = "\(scheme)://\(host)"
    if let port = url.port { origin += ":\(port)" }
    return origin
}

public func serverOrDefault(_ value: String?) -> String { normalizeServer(value) ?? defaultServer }

/// Words trimmed and kept to the site's limit.
public func cleanedThought(_ text: String) -> String {
    String(Outbox.keptDraft(text).prefix(maxThought)).trimmingCharacters(in: .whitespacesAndNewlines)
}

/// The requests the app sends. Every one carries the token in the `Authorization`
/// header, never in the address.
public enum API {
    private static func authorized(_ url: URL, method: String, token: String) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 30
        return request
    }

    /// `POST /api/drop/capture`, `{ id, text }` → `{ id, paperId, paperName }`.
    public static func capture(server: String, token: String, id: String, text: String) -> URLRequest {
        let url = URL(string: "\(serverOrDefault(server))/api/drop/capture")!
        var request = authorized(url, method: "POST", token: token)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = ["id": id, "text": cleanedThought(text)]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        return request
    }

    /// `GET /api/drop/capture` → `{ paperId, paperName }`: where the next note will land.
    public static func target(server: String, token: String) -> URLRequest {
        authorized(URL(string: "\(serverOrDefault(server))/api/drop/capture")!, method: "GET", token: token)
    }

    /// `POST /api/drop/transcribe` (multipart: `audio`, `save=1`, `id`) → `{ text, id, paperId, paperName }`.
    public static func transcribe(server: String, token: String, id: String, boundary: String) -> URLRequest {
        let url = URL(string: "\(serverOrDefault(server))/api/drop/transcribe")!
        var request = authorized(url, method: "POST", token: token)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 90
        return request
    }

    /// `DELETE /api/drop/thoughts/<id>?paper=<paperId>`: crumples a note (204). A Bearer token is accepted.
    public static func undo(server: String, token: String, paperId: String, id: String) -> URLRequest? {
        guard var parts = URLComponents(string: "\(serverOrDefault(server))/api/drop/thoughts/\(id)") else { return nil }
        parts.queryItems = [URLQueryItem(name: "paper", value: paperId)]
        guard let url = parts.url else { return nil }
        return authorized(url, method: "DELETE", token: token)
    }
}

/// Builds a `multipart/form-data` body: text fields, then one file.
public enum Multipart {
    public static func newBoundary() -> String { "pp-\(UUID().uuidString.lowercased())" }

    public static func body(boundary: String, fields: [(name: String, value: String)], file: (name: String, filename: String, mime: String, data: Data)) -> Data {
        var data = Data()
        func add(_ string: String) { data.append(Data(string.utf8)) }
        for field in fields {
            add("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(field.name)\"\r\n\r\n\(field.value)\r\n")
        }
        add("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(file.name)\"; filename=\"\(file.filename)\"\r\nContent-Type: \(file.mime)\r\n\r\n")
        data.append(file.data)
        add("\r\n--\(boundary)--\r\n")
        return data
    }
}

/// What the site answers to a save.
public struct CaptureResponse: Decodable, Equatable {
    public var id: String?
    public var paperId: String?
    public var paperName: String?
    public var text: String?
    public var error: String?

    public init(id: String? = nil, paperId: String? = nil, paperName: String? = nil, text: String? = nil, error: String? = nil) {
        self.id = id
        self.paperId = paperId
        self.paperName = paperName
        self.text = text
        self.error = error
    }

    public static func decode(_ data: Data) -> CaptureResponse {
        (try? JSONDecoder().decode(CaptureResponse.self, from: data)) ?? CaptureResponse()
    }
}
