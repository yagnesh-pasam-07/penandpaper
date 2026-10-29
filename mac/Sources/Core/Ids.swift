import Foundation

/// The site accepts ids of 6 to 40 characters of a–z, 0–9 and "-". "mac-" plus a
/// lower-case UUID is exactly 40.
public func newThoughtId(uuid: String = UUID().uuidString) -> String {
    String("mac-\(uuid.lowercased())".prefix(40))
}

public func isValidThoughtId(_ id: String) -> Bool {
    guard (6...40).contains(id.count) else { return false }
    return id.unicodeScalars.allSatisfy { ($0.value >= 97 && $0.value <= 122) || ($0.value >= 48 && $0.value <= 57) || $0 == "-" }
}
