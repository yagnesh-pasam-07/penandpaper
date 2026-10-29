import AppKit
import Combine
import Core
import SwiftUI

final class QuickModel: ObservableObject {
    @Published var text = ""
    @Published var height: CGFloat = TextBox.minHeight
    @Published var paperName: String? = Settings.shared.cachedPaperName
}

private struct QuickCard: View {
    @ObservedObject var model: QuickModel
    var onSave: () -> Void
    var onCancel: () -> Void

    private var empty: Bool { model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Quick thought").font(Theme.hand(26, bold: true)).foregroundColor(Theme.ink)
                Spacer()
                Text(model.paperName.map { "to “\($0)”" } ?? "to your latest paper")
                    .font(.system(size: 12)).foregroundColor(Theme.mute).lineLimit(1)
            }
            ZStack(alignment: .topLeading) {
                TextBox(text: $model.text, height: $model.height, onSave: onSave, onCancel: onCancel)
                if model.text.isEmpty {
                    Text("What's on your mind?").font(Theme.hand(20)).foregroundColor(Theme.mute).padding(.top, 4).allowsHitTesting(false)
                }
            }
            .frame(height: model.height)
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 14).fill(Theme.sheet))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.line, lineWidth: 1))
            HStack {
                Text("Enter saves · Shift+Enter new line · Esc closes").font(.system(size: 12)).foregroundColor(Theme.mute)
                Spacer()
                Button(action: onSave) {
                    Text("Save").font(.system(size: 13, weight: .semibold)).foregroundColor(Theme.bg)
                        .padding(.horizontal, 16).padding(.vertical, 7)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.ink))
                }
                .buttonStyle(.plain).disabled(empty).opacity(empty ? 0.4 : 1)
            }
        }
        .padding(16)
        .frame(width: QuickPanelController.width)
        .background(RoundedRectangle(cornerRadius: 22).fill(Theme.bg))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.line, lineWidth: 1))
    }
}

/// ⌥⇧N: the quick-thought box. Toggles; Enter saves and closes at once; Esc keeps a draft.
@MainActor
final class QuickPanelController {
    static let shared = QuickPanelController()
    static let width: CGFloat = 520
    private var panel: FloatingPanel?
    private let model = QuickModel()
    private var cancellable: AnyCancellable?

    var isVisible: Bool { panel?.isVisible ?? false }

    func toggle() { isVisible ? close(keepDraft: true) : show() }

    func show() {
        model.text = Settings.shared.draft
        model.paperName = Settings.shared.cachedPaperName
        model.height = TextBox.minHeight
        let host = NSHostingView(rootView: QuickCard(model: model, onSave: { [weak self] in self?.save() }, onCancel: { [weak self] in self?.close(keepDraft: true) }))
        host.setFrameSize(host.fittingSize)
        let panel = FloatingPanel(size: host.fittingSize, acceptsKey: true, content: host)
        self.panel = panel
        place(panel)
        panel.alphaValue = 0
        panel.makeKeyAndOrderFront(nil)
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.12
            panel.animator().alphaValue = 1
        }
        cancellable = model.$height.receive(on: DispatchQueue.main).sink { [weak self] _ in self?.resize() }
        Task { await Capture.shared.refreshTarget(); model.paperName = Settings.shared.cachedPaperName }
    }

    /// Centred on the screen the mouse is on, a little above the middle, and kept pinned by its top edge as it grows.
    private func place(_ panel: FloatingPanel) {
        let frame = FloatingPanel.activeScreen.visibleFrame
        let size = panel.frame.size
        panel.setFrameOrigin(NSPoint(x: frame.midX - size.width / 2, y: frame.minY + frame.height * 0.62 - size.height / 2))
    }

    private func resize() {
        guard let panel, let host = panel.contentView as? NSHostingView<QuickCard> else { return }
        let size = host.fittingSize
        let top = panel.frame.maxY
        panel.setFrame(NSRect(x: panel.frame.minX, y: top - size.height, width: size.width, height: size.height), display: true)
    }

    private func save() {
        let words = model.text
        guard !words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        Settings.shared.draft = ""
        close(keepDraft: false)
        Capture.shared.saveTyped(words)
    }

    func close(keepDraft: Bool) {
        if keepDraft { Settings.shared.draft = Outbox.keptDraft(model.text) }
        cancellable = nil
        guard let panel else { return }
        self.panel = nil
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.1
            panel.animator().alphaValue = 0
        }, completionHandler: { panel.orderOut(nil) })
    }
}
