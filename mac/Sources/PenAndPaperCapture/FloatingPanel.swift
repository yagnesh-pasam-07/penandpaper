import AppKit
import SwiftUI

/// A borderless panel that floats over everything, including full-screen apps, without
/// taking the app out of the background. It can still become the key window so typing works.
final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { acceptsKey }
    override var canBecomeMain: Bool { false }
    private let acceptsKey: Bool

    init(size: NSSize, acceptsKey: Bool, content: NSView) {
        self.acceptsKey = acceptsKey
        super.init(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless, .nonactivatingPanel, .fullSizeContentView], backing: .buffered, defer: false)
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        animationBehavior = .utilityWindow
        contentView = content
    }

    /// The screen the mouse is on, where the box should appear.
    static var activeScreen: NSScreen {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main ?? NSScreen.screens[0]
    }
}
