import AppKit
import SwiftUI

private struct ToastView: View {
    var message: String
    var undo: (() -> Void)?
    var body: some View {
        HStack(spacing: 12) {
            Text(message).font(.system(size: 13, weight: .medium)).foregroundColor(Theme.ink).lineLimit(2)
            if let undo {
                Button("Undo", action: undo).buttonStyle(.plain).font(.system(size: 13, weight: .semibold)).foregroundColor(Theme.red)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Capsule().fill(Theme.bg))
        .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
        .fixedSize()
    }
}

/// A small confirmation near the bottom of the screen: where a note went, or why it didn't.
@MainActor
enum Toast {
    private static var panel: FloatingPanel?
    private static var hideTask: Task<Void, Never>?

    /// `undo` shows an Undo button and keeps the toast up longer; pass nil when there's nothing to undo.
    static func show(_ message: String, undo: (() -> Void)? = nil) {
        hideTask?.cancel()
        panel?.orderOut(nil)
        let host = NSHostingView(rootView: ToastView(message: message, undo: undo))
        host.setFrameSize(host.fittingSize)
        let panel = FloatingPanel(size: host.fittingSize, acceptsKey: false, content: host)
        panel.ignoresMouseEvents = undo == nil
        let frame = FloatingPanel.activeScreen.visibleFrame
        panel.setFrameOrigin(NSPoint(x: frame.midX - panel.frame.width / 2, y: frame.minY + 80))
        panel.alphaValue = 0
        panel.orderFrontRegardless()
        panel.animator().alphaValue = 1
        self.panel = panel
        let seconds: UInt64 = undo == nil ? 3 : 5
        hideTask = Task {
            try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
            if Task.isCancelled { return }
            panel.animator().alphaValue = 0
            try? await Task.sleep(nanoseconds: 250_000_000)
            panel.orderOut(nil)
        }
    }
}
