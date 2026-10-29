import XCTest
@testable import Core

final class OutboxTests: XCTestCase {
    func text(_ id: String, at: Double = 1000) -> OutboxItem { OutboxItem(id: id, kind: .text, text: "hello \(id)", createdAt: at) }

    func testBackoffDoublesFromThirtySecondsUpToAnHour() {
        XCTAssertEqual(Outbox.backoffMs(1), 30_000)
        XCTAssertEqual(Outbox.backoffMs(2), 60_000)
        XCTAssertEqual(Outbox.backoffMs(3), 120_000)
        XCTAssertEqual(Outbox.backoffMs(0), 30_000)
        XCTAssertEqual(Outbox.backoffMs(40), 3_600_000)
    }

    func testEnqueueIsOnceAndRemoveWorks() {
        var list = Outbox.enqueue([], text("a")).list
        list = Outbox.enqueue(list, text("a")).list
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(Outbox.remove(list, id: "a"), [])
        XCTAssertEqual(Outbox.remove(list, id: "zzz"), list)
    }

    func testEnqueueDropsTheOldestPastTheLimitAndReportsThem() {
        var list: [OutboxItem] = []
        for i in 0..<Outbox.maxItems { list = Outbox.enqueue(list, text("t\(i)", at: Double(i))).list }
        let result = Outbox.enqueue(list, text("newest", at: 9999))
        XCTAssertEqual(result.list.count, Outbox.maxItems)
        XCTAssertEqual(result.list.last?.id, "newest")
        XCTAssertEqual(result.dropped.map(\.id), ["t0"])
    }

    func testDueIsOldestFirstAndHonoursTheWaitUnlessForced() {
        var list = Outbox.enqueue([], text("late", at: 20)).list
        list = Outbox.enqueue(list, text("early", at: 10)).list
        list = Outbox.failed(list, id: "late", now: 100)
        XCTAssertEqual(Outbox.due(list, now: 100).map(\.id), ["early"])
        XCTAssertEqual(Outbox.due(list, now: 100, force: "late").map(\.id), ["early", "late"])
        XCTAssertEqual(Outbox.due(list, now: 100 + 30_000).map(\.id), ["early", "late"])
    }

    func testFailedCountsAnAttemptAndPushesBackTheNextTry() {
        var list = Outbox.enqueue([], text("a")).list
        list = Outbox.failed(list, id: "a", now: 0)
        list = Outbox.failed(list, id: "a", now: 0)
        XCTAssertEqual(list[0].attempts, 2)
        XCTAssertEqual(list[0].nextAt, 60_000)
    }

    func testWhichFailuresAreWorthRetrying() {
        for status in [0, 401, 403, 408, 429, 500, 503] { XCTAssertTrue(Outbox.retryable(status: status), "\(status)") }
        for status in [400, 404, 409, 413, 415, 422] { XCTAssertFalse(Outbox.retryable(status: status), "\(status)") }
    }

    func testKeptDraftIsTrimmedOrEmpty() {
        XCTAssertEqual(Outbox.keptDraft("  hi\r\nthere \n"), "hi\nthere")
        XCTAssertEqual(Outbox.keptDraft("   "), "")
        XCTAssertEqual(Outbox.keptDraft(nil), "")
    }

    func testOutboxRoundTripsThroughJSON() throws {
        let items = [OutboxItem(id: "a-b-c-d", kind: .audio, audioFile: "a.m4a", createdAt: 5, attempts: 2, nextAt: 9), text("t1")]
        let data = try JSONEncoder().encode(items)
        XCTAssertEqual(try JSONDecoder().decode([OutboxItem].self, from: data), items)
    }
}

final class IdsAndServerTests: XCTestCase {
    func testThoughtIdsAreValidAndAtMostFortyCharacters() {
        let id = newThoughtId()
        XCTAssertEqual(id.count, 40)
        XCTAssertTrue(isValidThoughtId(id))
        XCTAssertTrue(id.hasPrefix("mac-"))
        XCTAssertNotEqual(newThoughtId(), newThoughtId())
        XCTAssertEqual(newThoughtId(uuid: "ABC"), "mac-abc")
    }

    func testIdValidation() {
        XCTAssertFalse(isValidThoughtId("short"))
        XCTAssertFalse(isValidThoughtId("UPPERCASE-ID"))
        XCTAssertFalse(isValidThoughtId("has space"))
        XCTAssertFalse(isValidThoughtId(String(repeating: "a", count: 41)))
        XCTAssertTrue(isValidThoughtId("abc-123"))
    }

    func testNormalizeServer() {
        XCTAssertEqual(normalizeServer("https://penandpaper-app.vercel.app/"), "https://penandpaper-app.vercel.app")
        XCTAssertEqual(normalizeServer("penandpaper-app.vercel.app"), "https://penandpaper-app.vercel.app")
        XCTAssertEqual(normalizeServer("http://localhost:3000/drop?x=1"), "http://localhost:3000")
        XCTAssertEqual(normalizeServer("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
        XCTAssertNil(normalizeServer("http://example.com"))
        XCTAssertNil(normalizeServer("ftp://example.com"))
        XCTAssertNil(normalizeServer("  "))
        XCTAssertNil(normalizeServer(nil))
        XCTAssertEqual(serverOrDefault("not a url ::"), defaultServer)
    }

    func testCleanedThoughtTrimsAndCaps() {
        XCTAssertEqual(cleanedThought("  hello \n"), "hello")
        XCTAssertEqual(cleanedThought(String(repeating: "x", count: 1500)).count, maxThought)
    }
}

final class RequestTests: XCTestCase {
    func testCaptureRequestUsesBearerAndJSON() throws {
        let request = API.capture(server: "http://localhost:3000/", token: "pp_secret", id: "mac-abc-def", text: "  buy milk ")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.absoluteString, "http://localhost:3000/api/drop/capture")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer pp_secret")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        let body = try JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: String]
        XCTAssertEqual(body, ["id": "mac-abc-def", "text": "buy milk"])
    }

    func testTokenIsNeverPutInTheAddress() {
        let requests = [
            API.capture(server: defaultServer, token: "pp_secret", id: "abcdef", text: "x"),
            API.target(server: defaultServer, token: "pp_secret"),
            API.transcribe(server: defaultServer, token: "pp_secret", id: "abcdef", boundary: "b"),
            API.undo(server: defaultServer, token: "pp_secret", paperId: "p1", id: "abcdef")!,
        ]
        for request in requests {
            XCTAssertFalse(request.url!.absoluteString.contains("pp_secret"))
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer pp_secret")
        }
    }

    func testTargetAndUndoRequests() {
        XCTAssertEqual(API.target(server: defaultServer, token: "t").httpMethod, "GET")
        let undo = API.undo(server: defaultServer, token: "t", paperId: "paper-1", id: "mac-1")
        XCTAssertEqual(undo?.httpMethod, "DELETE")
        XCTAssertEqual(undo?.url?.absoluteString, "\(defaultServer)/api/drop/thoughts/mac-1?paper=paper-1")
    }

    func testMultipartBodyHasFieldsThenTheFile() throws {
        let boundary = "pp-test"
        let body = Multipart.body(boundary: boundary, fields: [("save", "1"), ("id", "mac-1")], file: (name: "audio", filename: "voice.m4a", mime: "audio/mp4", data: Data([1, 2, 3])))
        let text = String(decoding: body, as: UTF8.self)
        XCTAssertTrue(text.contains("name=\"save\"\r\n\r\n1\r\n"))
        XCTAssertTrue(text.contains("name=\"id\"\r\n\r\nmac-1\r\n"))
        XCTAssertTrue(text.contains("name=\"audio\"; filename=\"voice.m4a\"\r\nContent-Type: audio/mp4\r\n\r\n"))
        XCTAssertTrue(text.hasSuffix("\r\n--pp-test--\r\n"))
        XCTAssertLessThan(try XCTUnwrap(text.range(of: "name=\"save\"")).lowerBound, try XCTUnwrap(text.range(of: "name=\"audio\"")).lowerBound)
    }

    func testTranscribeRequestSetsTheBoundary() {
        let request = API.transcribe(server: defaultServer, token: "t", id: "mac-1", boundary: "pp-x")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "multipart/form-data; boundary=pp-x")
        XCTAssertEqual(request.url?.path, "/api/drop/transcribe")
    }

    func testResponseDecoding() {
        let ok = CaptureResponse.decode(Data(#"{"id":"a","paperId":"p","paperName":"Ideas","text":"hi"}"#.utf8))
        XCTAssertEqual(ok.paperName, "Ideas")
        XCTAssertEqual(ok.text, "hi")
        XCTAssertEqual(CaptureResponse.decode(Data("not json".utf8)), CaptureResponse())
        XCTAssertEqual(CaptureResponse.decode(Data(#"{"paperName":null}"#.utf8)).paperName, nil)
    }
}

final class OutcomeTests: XCTestCase {
    func testTypedOutcomes() {
        XCTAssertEqual(Outcomes.typed(status: 200, response: CaptureResponse(paperName: "Ideas")).message, "Saved to Ideas")
        XCTAssertEqual(Outcomes.typed(status: 200).message, "Saved to your paper")
        XCTAssertEqual(Outcomes.typed(status: 200, response: CaptureResponse(paperName: "  ")).message, "Saved to your paper")
        XCTAssertEqual(Outcomes.typed(status: 401).kind, .signIn)
        XCTAssertTrue(Outcomes.typed(status: 401).keep)
        XCTAssertFalse(Outcomes.typed(status: 400, response: CaptureResponse(error: "Nope")).keep)
        XCTAssertEqual(Outcomes.typed(status: 400, response: CaptureResponse(error: "Nope")).message, "Nope")
        XCTAssertTrue(Outcomes.typed(status: 0).keep)
        XCTAssertTrue(Outcomes.typed(status: 500).keep)
        XCTAssertFalse(Outcomes.typed(status: 409).keep)
    }

    func testVoiceOutcomesFollowTheContract() {
        XCTAssertEqual(Outcomes.voice(status: 401).message, "Sign in again. Your recording is kept.")
        XCTAssertEqual(Outcomes.voice(status: 503).message, "Voice isn't set up on the server yet. Your recording is kept.")
        XCTAssertEqual(Outcomes.voice(status: 422).message, "Didn't catch anything.")
        XCTAssertEqual(Outcomes.voice(status: 429).message, "Slow down a moment. Your recording is kept.")
        XCTAssertTrue(Outcomes.voice(status: 0).keep)
        XCTAssertFalse(Outcomes.voice(status: 422).keep)
        XCTAssertFalse(Outcomes.voice(status: 413).keep)
        XCTAssertEqual(Outcomes.voice(status: 200, response: CaptureResponse(text: "call the bank tomorrow")).message, "Saved: call the bank tomorrow")
    }

    func testPreviewIsFlatAndShort() {
        XCTAssertEqual(Outcomes.preview("a\nb   c"), "a b c")
        let long = Outcomes.preview(String(repeating: "word ", count: 30))
        XCTAssertTrue(long.hasSuffix("…"))
        XCTAssertLessThanOrEqual(long.count, 49)
    }

    func testVoiceHoldLimits() {
        XCTAssertEqual(VoiceHold.verdict(durationMs: 120), .tooShort)
        XCTAssertEqual(VoiceHold.verdict(durationMs: 300), .ok)
        XCTAssertEqual(VoiceHold.clamped(durationMs: 90_000), 60_000)
        XCTAssertEqual(VoiceHold.clamped(durationMs: -5), 0)
        XCTAssertEqual(VoiceHold.clock(seconds: 3), "0:03")
        XCTAssertEqual(VoiceHold.clock(seconds: 75), "1:15")
    }
}

final class HotKeyTests: XCTestCase {
    func testDefaultsDisplay() {
        XCTAssertEqual(HotKeyCombo.quickDefault.display, "⌥⇧N")
        XCTAssertEqual(HotKeyCombo.voiceDefault.display, "⌥Space")
    }

    func testUsableNeedsACommandControlOrOption() {
        XCTAssertTrue(HotKeyCombo(keyCode: 45, modifiers: HotKeyCombo.command).isUsable)
        XCTAssertFalse(HotKeyCombo(keyCode: 45, modifiers: HotKeyCombo.shift).isUsable)
        XCTAssertFalse(HotKeyCombo(keyCode: 45, modifiers: 0).isUsable)
    }

    func testEncodingRoundTrips() {
        let combo = HotKeyCombo(keyCode: 49, modifiers: HotKeyCombo.control | HotKeyCombo.shift)
        XCTAssertEqual(HotKeyCombo.decode(combo.encoded()), combo)
        XCTAssertEqual(combo.display, "⌃⇧Space")
        XCTAssertNil(HotKeyCombo.decode("nope"))
        XCTAssertNil(HotKeyCombo.decode(nil))
    }
}

final class SpeechLocaleTests: XCTestCase {
    let supported = ["en_US", "en_IN", "hi_IN", "fr_FR", "de_DE", "te_IN"]

    func testNormalizeUsesHyphens() {
        XCTAssertEqual(SpeechLocale.normalize("en_IN"), "en-IN")
        XCTAssertEqual(SpeechLocale.normalize(" hi-IN "), "hi-IN")
    }

    func testTheSavedChoiceWinsWhenSupported() {
        XCTAssertEqual(SpeechLocale.choose(saved: "hi-IN", current: "en_US", supported: supported), "hi-IN")
        XCTAssertEqual(SpeechLocale.choose(saved: "te_IN", current: "en_US", supported: supported), "te-IN")
    }

    func testFallsBackToTheMacsOwnLanguageThenSameLanguage() {
        XCTAssertEqual(SpeechLocale.choose(saved: nil, current: "fr_FR", supported: supported), "fr-FR")
        // en_GB isn't offered, so the same language is used, Indian English first.
        XCTAssertEqual(SpeechLocale.choose(saved: nil, current: "en_GB", supported: supported), "en-IN")
        // A saved language that isn't there falls through to the Mac's own.
        XCTAssertEqual(SpeechLocale.choose(saved: "ja-JP", current: "de_DE", supported: supported), "de-DE")
    }

    func testEnglishThenAnythingThenNothing() {
        XCTAssertEqual(SpeechLocale.choose(saved: nil, current: "ja_JP", supported: supported), "en-IN")
        XCTAssertEqual(SpeechLocale.choose(saved: nil, current: "ja_JP", supported: ["fr_FR", "de_DE"]), "fr-FR")
        XCTAssertNil(SpeechLocale.choose(saved: "hi-IN", current: "en_US", supported: []))
    }

    func testTeluguIsMissingOnSomeMacsAndSomethingElseIsPicked() {
        let withoutTelugu = ["en_US", "hi_IN"]
        XCTAssertEqual(SpeechLocale.choose(saved: "te-IN", current: "en_US", supported: withoutTelugu), "en-US")
    }

    func testOptionsPutTheCuratedOnesFirstAndOnlyWhatIsSupported() {
        XCTAssertEqual(SpeechLocale.options(supported: supported), ["en-IN", "en-US", "hi-IN", "te-IN", "de-DE", "fr-FR"])
        XCTAssertEqual(SpeechLocale.options(supported: ["fr_FR", "en_US", "fr-FR"]), ["en-US", "fr-FR"])
        XCTAssertEqual(SpeechLocale.options(supported: []), [])
    }
}

final class VoiceFlowTests: XCTestCase {
    func testAHoldListensThenFinishesAndSavesWhatWasSaid() {
        var step = VoiceFlow.reduce(.idle, .pressed(nowMs: 1_000))
        XCTAssertEqual(step.phase, .listening(startedMs: 1_000))
        XCTAssertEqual(step.action, .startListening)
        step = VoiceFlow.reduce(step.phase, .released(nowMs: 3_500))
        XCTAssertEqual(step.phase, .finishing)
        XCTAssertEqual(step.action, .stopAndFinish)
        step = VoiceFlow.reduce(step.phase, .result("  call the bank  "))
        XCTAssertEqual(step.phase, .idle)
        XCTAssertEqual(step.action, .save("call the bank"))
    }

    func testATapUnderThreeTenthsOfASecondIsThrownAway() {
        let listening = VoiceFlow.reduce(.idle, .pressed(nowMs: 0)).phase
        let step = VoiceFlow.reduce(listening, .released(nowMs: 250))
        XCTAssertEqual(step.phase, .idle)
        XCTAssertEqual(step.action, .cancel)
        XCTAssertEqual(VoiceFlow.reduce(listening, .released(nowMs: 300)).action, .stopAndFinish)
    }

    func testAHoldStopsByItselfAtSixtySeconds() {
        let listening = VoicePhase.listening(startedMs: 10_000)
        XCTAssertEqual(VoiceFlow.reduce(listening, .tick(nowMs: 69_999)).action, .none)
        let stop = VoiceFlow.reduce(listening, .tick(nowMs: 70_000))
        XCTAssertEqual(stop.phase, .finishing)
        XCTAssertEqual(stop.action, .stopAndFinish)
    }

    func testNothingSaidIsSaidOutLoudAndNothingIsSaved() {
        XCTAssertEqual(VoiceFlow.reduce(.finishing, .result(nil)).action, .nothingHeard)
        XCTAssertEqual(VoiceFlow.reduce(.finishing, .result("   \n ")).action, .nothingHeard)
        XCTAssertEqual(VoiceFlow.reduce(.finishing, .result("")).phase, .idle)
    }

    func testWordsAreKeptToAThoughtsLength() {
        let long = String(repeating: "a", count: maxThought + 500)
        guard case .save(let words) = VoiceFlow.reduce(.finishing, .result(long)).action else { return XCTFail("expected a save") }
        XCTAssertEqual(words.count, maxThought)
    }

    func testEventsOutOfOrderChangeNothing() {
        XCTAssertEqual(VoiceFlow.reduce(.idle, .released(nowMs: 5)).action, .none)
        XCTAssertEqual(VoiceFlow.reduce(.idle, .result("hi")).action, .none)
        let listening = VoicePhase.listening(startedMs: 0)
        XCTAssertEqual(VoiceFlow.reduce(listening, .pressed(nowMs: 10)), VoiceStep(phase: listening, action: .none))
        XCTAssertEqual(VoiceFlow.reduce(listening, .result("early")).action, .none)
        XCTAssertEqual(VoiceFlow.reduce(.finishing, .pressed(nowMs: 10)).action, .none)
    }

    func testSpokenToastNamesTheFirstWords() {
        XCTAssertEqual(Outcomes.spoken("call the bank"), "Saved: call the bank")
        XCTAssertEqual(Outcomes.spoken("   "), "Saved")
        XCTAssertTrue(Outcomes.spoken(String(repeating: "word ", count: 40)).hasSuffix("…"))
    }
}
