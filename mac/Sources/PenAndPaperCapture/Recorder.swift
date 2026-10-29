import AVFoundation
import AppKit
import Core
import SwiftUI

final class ListeningModel: ObservableObject {
    @Published var seconds = 0
    @Published var level: CGFloat = 0
}

private struct ListeningPill: View {
    @ObservedObject var model: ListeningModel
    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(Theme.red).frame(width: 10, height: 10).opacity(0.6 + 0.4 * model.level)
            Text("Listening… \(VoiceHold.clock(seconds: model.seconds))").font(.system(size: 13, weight: .semibold)).foregroundColor(Theme.ink).monospacedDigit()
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.line)
                    Capsule().fill(Theme.red).frame(width: max(4, geo.size.width * model.level))
                }
            }
            .frame(width: 70, height: 6)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(Capsule().fill(Theme.bg))
        .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
        .fixedSize()
    }
}

/// Hold ⌥Space to talk: records the microphone to a temporary .m4a while the key is
/// down, shows a small "Listening…" pill with a level meter, and hands the file to the
/// outbox on release. A tap shorter than 0.3 s is ignored; a hold stops at 60 s.
@MainActor
final class VoiceRecorder {
    static let shared = VoiceRecorder()
    private var recorder: AVAudioRecorder?
    private var fileURL: URL?
    private var startedAt: Date?
    private var timer: Timer?
    private var pill: FloatingPanel?
    private let model = ListeningModel()

    var isRecording: Bool { recorder != nil }

    func pressed() {
        guard !isRecording else { return }
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            start()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                Task { @MainActor in Toast.show(granted ? "Microphone allowed. Hold the key again to talk." : "Allow the microphone in System Settings → Privacy & Security.") }
            }
        default:
            Toast.show("Allow the microphone in System Settings → Privacy & Security.")
        }
    }

    func released() {
        guard let recorder, let fileURL, let startedAt else { return }
        let ms = VoiceHold.clamped(durationMs: Int(Date().timeIntervalSince(startedAt) * 1000))
        stopEverything(recorder)
        if VoiceHold.verdict(durationMs: ms) == .tooShort {
            try? FileManager.default.removeItem(at: fileURL)
            return
        }
        NSSound(named: "Pop")?.play()
        Capture.shared.saveVoice(file: fileURL)
    }

    private func start() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("pp-voice-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 32_000,
        ]
        guard let recorder = try? AVAudioRecorder(url: url, settings: settings) else {
            Toast.show("Couldn't start the microphone.")
            return
        }
        recorder.isMeteringEnabled = true
        guard recorder.record() else {
            Toast.show("Couldn't start the microphone.")
            return
        }
        self.recorder = recorder
        fileURL = url
        startedAt = Date()
        model.seconds = 0
        model.level = 0
        showPill()
        NSSound(named: "Tink")?.play()
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        guard let recorder, let startedAt else { return }
        recorder.updateMeters()
        let decibels = recorder.averagePower(forChannel: 0)
        model.level = CGFloat(max(0, min(1, (decibels + 50) / 50)))
        let elapsed = Int(Date().timeIntervalSince(startedAt))
        if elapsed != model.seconds { model.seconds = elapsed }
        if Int(Date().timeIntervalSince(startedAt) * 1000) >= VoiceHold.maximumMs { released() }
    }

    private func stopEverything(_ recorder: AVAudioRecorder) {
        recorder.stop()
        timer?.invalidate()
        timer = nil
        self.recorder = nil
        fileURL = nil
        startedAt = nil
        pill?.orderOut(nil)
        pill = nil
    }

    private func showPill() {
        let host = NSHostingView(rootView: ListeningPill(model: model))
        host.setFrameSize(host.fittingSize)
        let panel = FloatingPanel(size: host.fittingSize, acceptsKey: false, content: host)
        panel.ignoresMouseEvents = true
        let frame = FloatingPanel.activeScreen.visibleFrame
        panel.setFrameOrigin(NSPoint(x: frame.midX - panel.frame.width / 2, y: frame.maxY - panel.frame.height - 60))
        panel.orderFrontRegardless()
        pill = panel
    }
}
