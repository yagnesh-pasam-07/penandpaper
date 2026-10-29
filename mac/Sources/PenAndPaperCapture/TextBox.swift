import AppKit
import SwiftUI

/// A text view that saves on Enter (Shift+Enter is a new line), closes on Esc, and
/// handles ⌘C/⌘V/⌘X/⌘A/⌘Z itself so editing works while the app is in the background.
final class KeyTextView: NSTextView {
    var onSave: (() -> Void)?
    var onCancel: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        let isReturn = event.keyCode == 36 || event.keyCode == 76
        if isReturn && !event.modifierFlags.contains(.shift) && !isComposing {
            onSave?()
            return
        }
        super.keyDown(with: event)
    }

    override func cancelOperation(_ sender: Any?) { onCancel?() }

    private var isComposing: Bool { hasMarkedText() }

    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command, let key = event.charactersIgnoringModifiers else {
            return super.performKeyEquivalent(with: event)
        }
        switch key {
        case "v": paste(nil)
        case "c": copy(nil)
        case "x": cut(nil)
        case "a": selectAll(nil)
        case "z": undoManager?.undo()
        default: return super.performKeyEquivalent(with: event)
        }
        return true
    }
}

/// The auto-growing text box of the quick-thought card.
struct TextBox: NSViewRepresentable {
    @Binding var text: String
    @Binding var height: CGFloat
    var onSave: () -> Void
    var onCancel: () -> Void

    static let minHeight: CGFloat = 60
    static let maxHeight: CGFloat = 170

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = false
        scroll.borderType = .noBorder
        let view = KeyTextView()
        view.drawsBackground = false
        view.isRichText = false
        view.allowsUndo = true
        view.font = Theme.handNS(20)
        view.textColor = NSColor.labelColor
        view.insertionPointColor = NSColor.labelColor
        view.textContainerInset = NSSize(width: 0, height: 4)
        view.isVerticallyResizable = true
        view.isHorizontallyResizable = false
        view.autoresizingMask = [.width]
        view.textContainer?.widthTracksTextView = true
        view.delegate = context.coordinator
        view.onSave = onSave
        view.onCancel = onCancel
        view.string = text
        scroll.documentView = view
        context.coordinator.view = view
        DispatchQueue.main.async {
            view.window?.makeFirstResponder(view)
            view.setSelectedRange(NSRange(location: (view.string as NSString).length, length: 0))
            context.coordinator.measure()
        }
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        guard let view = context.coordinator.view else { return }
        view.onSave = onSave
        view.onCancel = onCancel
        if view.string != text {
            view.string = text
            context.coordinator.measure()
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: TextBox
        weak var view: KeyTextView?
        init(_ parent: TextBox) { self.parent = parent }

        func textDidChange(_ notification: Notification) {
            guard let view else { return }
            parent.text = view.string
            measure()
        }

        func measure() {
            guard let view, let layout = view.layoutManager, let container = view.textContainer else { return }
            layout.ensureLayout(for: container)
            let used = layout.usedRect(for: container).height + view.textContainerInset.height * 2
            let target = min(max(used, TextBox.minHeight), TextBox.maxHeight)
            if abs(parent.height - target) > 0.5 {
                DispatchQueue.main.async { self.parent.height = target }
            }
        }
    }
}
