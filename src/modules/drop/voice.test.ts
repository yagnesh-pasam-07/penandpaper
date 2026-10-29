import { describe, expect, it, vi } from "vitest";
import { MODELS, transcribeAudio } from "./transcribe";
import { audioExtension, baseType, checkAudio, cleanTranscript, failureResponse, formatElapsed, insertAtCursor, MAX_AUDIO_BYTES, pickRecorderMime } from "./voice";

describe("audio types and limits", () => {
  it("reads the type without its codecs and maps it to an extension", () => {
    expect(baseType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/mp4")).toBe("mp4");
    expect(audioExtension("audio/x-m4a")).toBe("m4a");
    expect(audioExtension("audio/aac")).toBe("m4a");
    expect(audioExtension("image/png")).toBeNull();
    expect(audioExtension("")).toBeNull();
  });
  it("refuses an empty, oversize or non-audio recording with the right status", () => {
    expect(checkAudio({ type: "audio/webm", size: 0 })).toMatchObject({ ok: false, status: 400 });
    expect(checkAudio({ type: "audio/webm", size: MAX_AUDIO_BYTES + 1 })).toMatchObject({ ok: false, status: 413 });
    expect(checkAudio({ type: "text/html", size: 100 })).toMatchObject({ ok: false, status: 415 });
    expect(checkAudio({ type: "audio/ogg;codecs=opus", size: 1000 })).toEqual({ ok: true, ext: "ogg" });
  });
});

describe("transcripts", () => {
  it("tidies spaces and cuts to a thought, or says nothing was said", () => {
    expect(cleanTranscript("  call   Naga \n tomorrow  ")).toBe("call Naga \n tomorrow");
    expect(cleanTranscript("x".repeat(5000))).toHaveLength(1000);
    expect(cleanTranscript("   ")).toBeNull();
    expect(cleanTranscript(undefined)).toBeNull();
    expect(cleanTranscript(42)).toBeNull();
  });
  it("puts spoken words in at the cursor with a space only where needed", () => {
    expect(insertAtCursor("", "hello", 0, 0)).toEqual({ text: "hello", cursor: 5 });
    expect(insertAtCursor("call", "Naga", 4, 4)).toEqual({ text: "call Naga", cursor: 9 });
    expect(insertAtCursor("call tomorrow", "Naga", 5, 5)).toEqual({ text: "call Naga tomorrow", cursor: 9 });
    expect(insertAtCursor("call old tomorrow", "Naga", 5, 9)).toEqual({ text: "call Naga tomorrow", cursor: 9 });
    expect(insertAtCursor("a ", "b", 2, 2)).toEqual({ text: "a b", cursor: 3 });
    expect(insertAtCursor("abc", "defghij", 3, 3, 6).text).toBe("abc de");
    expect(insertAtCursor("abc", "x", 3, 3, 3)).toEqual({ text: "abc", cursor: 3 });
  });
  it("formats the elapsed time", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_400)).toBe("0:07");
    expect(formatElapsed(60_000)).toBe("1:00");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("recorder type", () => {
  it("prefers WebM/Opus and falls back to MP4 for Safari", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((t) => t.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(pickRecorderMime((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe("failure responses", () => {
  it("never carries the provider's own words", () => {
    expect(failureResponse("not_configured")).toEqual({ status: 503, error: "Voice isn't set up on this server yet." });
    expect(failureResponse("bad_audio").status).toBe(422);
    expect(failureResponse("timeout").status).toBe(504);
    expect(failureResponse("upstream").status).toBe(502);
  });
});

const audio = new Blob(["x"], { type: "audio/webm" });
const reply = (status: number, body: unknown) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("transcribeAudio", () => {
  it("does nothing without a key, and never calls the network", async () => {
    const f = vi.fn();
    expect(await transcribeAudio(audio, "webm", undefined, f)).toEqual({ ok: false, reason: "not_configured" });
    expect(await transcribeAudio(audio, "webm", "   ", f)).toEqual({ ok: false, reason: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });
  it("sends the file and model with the key as a bearer header, and returns the cleaned words", async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { text: "  కాల్ చేయండి  " }));
    const out = await transcribeAudio(audio, "webm", "sk-test", f);
    expect(out).toEqual({ ok: true, text: "కాల్ చేయండి" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const form = init.body as FormData;
    expect(form.get("model")).toBe(MODELS[0]);
    expect(form.get("language")).toBeNull();
    expect((form.get("file") as File).name).toBe("voice.webm");
  });
  it("says nothing was said when the words are blank", async () => {
    const f = vi.fn().mockResolvedValue(reply(200, { text: "  " }));
    expect(await transcribeAudio(audio, "webm", "k", f)).toEqual({ ok: true, text: null });
  });
  it("falls back to the second model when the first isn't available", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(404, { error: { message: "model not found" } })).mockResolvedValueOnce(reply(200, { text: "hi" }));
    expect(await transcribeAudio(audio, "webm", "k", f)).toEqual({ ok: true, text: "hi" });
    expect((f.mock.calls[1][1].body as FormData).get("model")).toBe(MODELS[1]);
  });
  it("does not retry another model for a bad recording", async () => {
    const f = vi.fn().mockResolvedValue(reply(400, { error: { message: "Invalid file format" } }));
    expect(await transcribeAudio(audio, "webm", "k", f)).toEqual({ ok: false, reason: "bad_audio" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("maps a refused key, a provider error and a network failure without leaking anything", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await transcribeAudio(audio, "webm", "k", vi.fn().mockResolvedValue(reply(401, { error: "bad key sk-secret" })))).toEqual({ ok: false, reason: "not_configured" });
    expect(await transcribeAudio(audio, "webm", "k", vi.fn().mockResolvedValue(reply(500, "boom sk-secret")))).toEqual({ ok: false, reason: "upstream" });
    expect(await transcribeAudio(audio, "webm", "k", vi.fn().mockRejectedValue(new TypeError("fetch failed")))).toEqual({ ok: false, reason: "upstream" });
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(await transcribeAudio(audio, "webm", "k", vi.fn().mockRejectedValue(timeout))).toEqual({ ok: false, reason: "timeout" });
    expect(JSON.stringify(err.mock.calls)).not.toContain("sk-secret");
    err.mockRestore();
  });
});
