import AVFoundation
import AppKit
import Core
import Speech

/// Hold the talk key and speak: Apple's speech recogniser turns the words into text on this
/// Mac (on-device when the language supports it), the "Listening…" pill shows them as they
/// come, and on release the words are saved like a typed note, so the same outbox keeps them
/// when you're offline. No server transcription and no API key.
///
/// The rules of the hold (a tap under 0.3 s is ignored, 60 s is the limit, nothing said means
/// nothing saved) live in `VoiceFlow` in Core, where they are tested.
@MainActor
final class LocalVoice {
    static let shared = LocalVoice()

    private var phase = VoicePhase.idle
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var timer: Timer?
    private var giveUp: Task<Void, Never>?
    private var pill: FloatingPanel?
    private let model = ListeningModel()
    private var heard = ""
    private var startedAt = Date()

    private var nowMs: Int { Int(Date().timeIntervalSince1970 * 1000) }

    // MARK: Keys

    func pressed() {
        guard phase == .idle, hasAccess() else { return }
        begin()
    }

    func released() {
        apply(VoiceFlow.reduce(phase, .released(nowMs: nowMs)))
    }

    // MARK: Permissions

    /// True when both the microphone and speech recognition are allowed. The first time, it asks
    /// and says to hold the key again (the key is usually up by the time the answer comes).
    private func hasAccess() -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            break
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                Task { @MainActor in Toast.show(granted ? "Microphone allowed. Hold the key again to talk." : "Allow the microphone in System Settings → Privacy & Security → Microphone.") }
            }
            return false
        default:
            Toast.show("Allow the microphone in System Settings → Privacy & Security → Microphone.")
            return false
        }
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized:
            return true
        case .notDetermined:
            SFSpeechRecognizer.requestAuthorization { status in
                Task { @MainActor in Toast.show(status == .authorized ? "Speech recognition allowed. Hold the key again to talk." : "Allow speech recognition in System Settings → Privacy & Security → Speech Recognition.") }
            }
            return false
        default:
            Toast.show("Allow speech recognition in System Settings → Privacy & Security → Speech Recognition.")
            return false
        }
    }

    // MARK: Listening

    /// The recogniser for the chosen language (or the Mac's own), and whether it works fully on this Mac.
    static func recognizer() -> (recognizer: SFSpeechRecognizer, onDevice: Bool)? {
        let supported = SFSpeechRecognizer.supportedLocales().map(\.identifier)
        guard let id = SpeechLocale.choose(saved: Settings.shared.speechLocale, current: Locale.current.identifier, supported: supported),
              let recognizer = SFSpeechRecognizer(locale: Locale(identifier: id)) else { return nil }
        return (recognizer, recognizer.supportsOnDeviceRecognition)
    }

    private func begin() {
        guard let (recognizer, onDevice) = LocalVoice.recognizer(), recognizer.isAvailable else {
            Toast.show("Speech recognition isn't available right now.")
            return
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Stays on this Mac whenever the language allows it; otherwise Apple's servers do the listening.
        request.requiresOnDeviceRecognition = onDevice
        self.request = request

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 else {
            teardown()
            Toast.show("No microphone was found.")
            return
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            let level = LocalVoice.level(of: buffer)
            Task { @MainActor in self?.model.level = level }
        }
        engine.prepare()
        do { try engine.start() } catch {
            teardown()
            Toast.show("Couldn't start the microphone.")
            return
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            let failed = error != nil
            Task { @MainActor in self?.recognised(text: text, isFinal: isFinal, failed: failed) }
        }

        apply(VoiceFlow.reduce(phase, .pressed(nowMs: nowMs)))
        startedAt = Date()
        heard = ""
        model.seconds = 0
        model.level = 0
        model.partial = ""
        model.finishing = false
        pill = showListeningPill(model)
        NSSound(named: "Tink")?.play()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    private func tick() {
        let elapsed = Int(Date().timeIntervalSince(startedAt))
        if elapsed != model.seconds { model.seconds = elapsed }
        apply(VoiceFlow.reduce(phase, .tick(nowMs: nowMs)))
    }

    /// The recogniser spoke: partial words while listening, the last ones once it has been told to finish.
    private func recognised(text: String?, isFinal: Bool, failed: Bool) {
        if let text, !text.isEmpty {
            heard = text
            model.partial = text
        }
        if case .finishing = phase, isFinal || failed { apply(VoiceFlow.reduce(phase, .result(heard))) }
    }

    // MARK: Doing what the rules say

    private func apply(_ step: VoiceStep) {
        phase = step.phase
        switch step.action {
        case .none, .startListening:
            break
        case .cancel:
            teardown()
        case .stopAndFinish:
            model.finishing = true
            timer?.invalidate()
            timer = nil
            if engine.isRunning {
                engine.stop()
                engine.inputNode.removeTap(onBus: 0)
            }
            request?.endAudio()
            // If the recogniser never sends its last words, use what it had after a moment.
            giveUp?.cancel()
            giveUp = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 2_500_000_000)
                if Task.isCancelled { return }
                guard let self, case .finishing = self.phase else { return }
                self.apply(VoiceFlow.reduce(self.phase, .result(self.heard)))
            }
        case .save(let words):
            teardown()
            NSSound(named: "Pop")?.play()
            Capture.shared.saveSpoken(words)
        case .nothingHeard:
            teardown()
            Toast.show(Outcomes.nothingHeard)
        }
    }

    private func teardown() {
        giveUp?.cancel()
        giveUp = nil
        timer?.invalidate()
        timer = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        task?.cancel()
        task = nil
        request = nil
        pill?.orderOut(nil)
        pill = nil
        heard = ""
        phase = .idle
        model.finishing = false
    }

    /// 0…1, from the loudness of a chunk of audio (for the pill's meter).
    nonisolated static func level(of buffer: AVAudioPCMBuffer) -> CGFloat {
        guard let channel = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += channel[i] * channel[i] }
        let rms = (sum / Float(buffer.frameLength)).squareRoot()
        let decibels = 20 * log10(max(rms, 0.000_001))
        return CGFloat(max(0, min(1, (decibels + 50) / 50)))
    }
}
