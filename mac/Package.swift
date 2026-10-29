// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PenAndPaperCapture",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "PenAndPaperCapture", targets: ["PenAndPaperCapture"]),
    ],
    targets: [
        // Pure logic (no AppKit): outbox rules, ids, requests, error messages, hotkey model.
        .target(name: "Core"),
        .executableTarget(name: "PenAndPaperCapture", dependencies: ["Core"]),
        .testTarget(name: "CoreTests", dependencies: ["Core"]),
    ]
)
