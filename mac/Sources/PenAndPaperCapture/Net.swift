import Core
import Foundation

/// One answer from the site: the status (0 when no answer came at all) and what it said.
struct Answer {
    var status: Int
    var response: CaptureResponse
}

enum Net {
    static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.waitsForConnectivity = false
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()

    static func send(_ request: URLRequest, body: Data? = nil) async -> Answer {
        do {
            let (data, response) = try await (body != nil ? session.upload(for: request, from: body!) : session.data(for: request))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            return Answer(status: status, response: CaptureResponse.decode(data))
        } catch {
            return Answer(status: 0, response: CaptureResponse())
        }
    }
}
