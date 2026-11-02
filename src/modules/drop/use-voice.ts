"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  defaultSpeechLang,
  parseSpeechLang,
  resultsFrom,
  SPEECH_LANG_KEY,
  speechCtor,
  speechErrorMessage,
  speechTag,
  spokenSoFar,
  type SpeechLang,
  type SpeechRecognizerCtor,
  type SpeechRecognizerLike,
} from "./speech";
import { audioExtension, MAX_RECORDING_MS, pickRecorderMime } from "./voice";

export type VoiceState =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "transcribing" }
  | { kind: "failed"; message: string; canRetry: boolean };

/**
 * "whisper": records and sends to the server's Whisper (accurate, knows names),
 * while the browser's recogniser shows words live as a preview. "speech": the
 * browser's recogniser alone (no server key). "recorder": recording only.
 */
export type VoiceEngine = "whisper" | "speech" | "recorder";

const noSubscribe = () => () => {};

/** The recording type this browser can make, or null when it can't record at all. */
function recorderMime(): string | null {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return pickRecorderMime((type) => MediaRecorder.isTypeSupported(type));
}

/** The browser's recogniser first (it needs no server key); otherwise recording for the server; otherwise nothing. */
function detectEngine(): VoiceEngine | null {
  if (speechCtor(window as never)) return "speech";
  return recorderMime() ? "recorder" : null;
}

/** Whether the server has a Whisper key: asked once per page, shared by every voice box. */
let whisperKnown: boolean | null = null;
const whisperListeners = new Set<() => void>();
function subscribeWhisper(onChange: () => void) {
  whisperListeners.add(onChange);
  if (whisperKnown === null) {
    whisperKnown = false;
    void fetch("/api/drop/transcribe", { cache: "force-cache" })
      .then((r) => r.json())
      .then((b: { whisper?: boolean }) => {
        whisperKnown = !!b.whisper;
        whisperListeners.forEach((f) => f());
      })
      .catch(() => {});
  }
  return () => whisperListeners.delete(onChange);
}

/**
 * Words on the paper, for Whisper to know which names to expect. The page
 * sets it (the paper's thoughts); a voice box reads it when it sends.
 */
let vocabulary = "";
export function setVoiceVocabulary(words: string) {
  vocabulary = words.slice(0, 4000);
}

const LANG_EVENT = "pp-voice-lang";

function subscribeLang(onChange: () => void) {
  window.addEventListener(LANG_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANG_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLang(): SpeechLang {
  try {
    const stored = parseSpeechLang(localStorage.getItem(SPEECH_LANG_KEY));
    if (stored) return stored;
  } catch {
    // Storage may be blocked; the browser's own language still gives a sensible start.
  }
  return defaultSpeechLang(navigator.language);
}

/**
 * Speak a thought. Uses the browser's own speech recogniser when it has one
 * (Chrome, Edge, Safari: no server, no key; the words appear live in `interim`),
 * and otherwise records the microphone and sends it to /api/drop/transcribe.
 * `toggle` starts or stops, `cancel` throws it away, `retry` sends a failed
 * recording again (once). It stops by itself after a minute, and the words go
 * to `onText` once, when it stops.
 */
/**
 * `hold`: listening runs until stop() is called (push-to-talk, like holding
 * Space on the canvas), so a pause mid-sentence doesn't end it.
 */
export function useVoice(onText: (text: string) => void, { hold = false }: { hold?: boolean } = {}) {
  const base = useSyncExternalStore<VoiceEngine | null>(noSubscribe, detectEngine, () => null);
  const mime = useSyncExternalStore(noSubscribe, recorderMime, () => null);
  const whisper = useSyncExternalStore(subscribeWhisper, () => !!whisperKnown, () => false);
  // With a Whisper key and a microphone, Whisper writes the words; the browser only previews them.
  const engine: VoiceEngine | null = whisper && mime ? "whisper" : base;
  const lang = useSyncExternalStore<SpeechLang>(subscribeLang, readLang, () => "en");
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  // What the recogniser has heard so far, shown in the writer before it is final.
  const [interim, setInterim] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const kept = useRef<Blob | null>(null);
  const retried = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognizer = useRef<SpeechRecognizerLike | null>(null);
  const heard = useRef("");
  // In "whisper" mode, what the browser heard live (shown while recording; a fallback if the server fails).
  const preview = useRef("");
  const previewRec = useRef<SpeechRecognizerLike | null>(null);
  const failure = useRef<string | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const setLang = useCallback((next: SpeechLang) => {
    try {
      localStorage.setItem(SPEECH_LANG_KEY, next);
    } catch {
      // Not remembered, still used for this session through the event below.
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  /* ---------- Engine 1: the browser's recogniser ---------- */

  const startSpeech = useCallback(() => {
    const Ctor: SpeechRecognizerCtor | null = speechCtor(window as never);
    if (!Ctor || recognizer.current) return;
    cancelled.current = false;
    failure.current = null;
    heard.current = "";
    setInterim("");
    const rec = new Ctor();
    rec.lang = speechTag(lang, navigator.language);
    rec.continuous = hold;
    rec.interimResults = true;
    rec.onresult = (event) => {
      heard.current = spokenSoFar(resultsFrom(event.results));
      setInterim(heard.current);
    };
    rec.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      if (message) failure.current = message;
    };
    rec.onend = () => {
      recognizer.current = null;
      release();
      const words = heard.current.trim();
      heard.current = "";
      setInterim("");
      if (cancelled.current) {
        setState({ kind: "idle" });
        return;
      }
      if (failure.current) {
        setState({ kind: "failed", message: failure.current, canRetry: false });
        return;
      }
      if (!words) {
        setState({ kind: "failed", message: "Didn't catch anything.", canRetry: false });
        return;
      }
      setState({ kind: "idle" });
      onTextRef.current(words);
    };
    recognizer.current = rec;
    try {
      rec.start();
    } catch {
      recognizer.current = null;
      setState({ kind: "failed", message: "Couldn't start listening. Try again.", canRetry: false });
      return;
    }
    const startedAt = Date.now();
    setElapsed(0);
    setState({ kind: "recording" });
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) recognizer.current?.stop();
    }, 200);
  }, [hold, lang, release]);

  /* ---------- Engine 2: record and send to the server ---------- */

  const send = useCallback(async (blob: Blob) => {
    setState({ kind: "transcribing" });
    kept.current = blob;
    try {
      const ext = audioExtension(blob.type) ?? "webm";
      const form = new FormData();
      form.append("audio", blob, `voice.${ext}`);
      if (vocabulary) form.append("hints", vocabulary);
      const res = await fetch("/api/drop/transcribe", { method: "POST", body: form, cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (res.ok && body.text) {
        kept.current = null;
        retried.current = false;
        preview.current = "";
        setInterim("");
        setState({ kind: "idle" });
        onTextRef.current(body.text);
        return;
      }
      // Whisper couldn't: the browser's own words, if it heard any, are better than nothing.
      if (preview.current.trim() && res.status !== 401) {
        const words = preview.current.trim();
        preview.current = "";
        setInterim("");
        kept.current = null;
        setState({ kind: "idle" });
        onTextRef.current(words);
        return;
      }
      if (res.status === 401) setState({ kind: "failed", message: "Sign in again to use your voice.", canRetry: false });
      else if (res.status === 503) setState({ kind: "failed", message: body.error ?? "Voice isn't set up on this server yet.", canRetry: false });
      else setState({ kind: "failed", message: body.error ?? "Couldn't turn that into words.", canRetry: (res.status >= 500 || res.status === 429) && !retried.current });
    } catch {
      // The recording stays so one retry doesn't mean speaking it all again.
      setState({ kind: "failed", message: "Couldn't reach Pen & Paper. Check your connection.", canRetry: !retried.current });
    }
  }, []);

  const startRecorder = useCallback(async (withPreview = false) => {
    if (!mime || recorder.current) return;
    cancelled.current = false;
    kept.current = null;
    retried.current = false;
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
      setState({ kind: "failed", message: denied ? "The microphone is blocked. Allow it for this site in the address bar." : "No microphone was found.", canRetry: false });
      return;
    }
    stream.current = media;
    chunks.current = [];
    const rec = new MediaRecorder(media, { mimeType: mime });
    recorder.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      recorder.current = null;
      const live = previewRec.current;
      previewRec.current = null;
      try {
        live?.stop();
      } catch {}
      release();
      if (cancelled.current) {
        chunks.current = [];
        preview.current = "";
        setInterim("");
        setState({ kind: "idle" });
        return;
      }
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime });
      chunks.current = [];
      void send(blob);
    };
    rec.start();
    // Live words while you speak (the browser's quick guess); Whisper's answer replaces them.
    preview.current = "";
    setInterim("");
    const Ctor: SpeechRecognizerCtor | null = withPreview ? speechCtor(window as never) : null;
    if (Ctor) {
      try {
        const live = new Ctor();
        live.lang = speechTag(lang, navigator.language);
        live.continuous = true;
        live.interimResults = true;
        live.onresult = (event) => {
          preview.current = spokenSoFar(resultsFrom(event.results));
          setInterim(preview.current);
        };
        live.onerror = () => {};
        live.onend = () => {
          // Chrome ends a recogniser after a pause; keep it going while still recording.
          if (previewRec.current === live && recorder.current?.state === "recording") {
            try {
              live.start();
            } catch {}
          }
        };
        previewRec.current = live;
        live.start();
      } catch {
        previewRec.current = null;
      }
    }
    const startedAt = Date.now();
    setElapsed(0);
    setState({ kind: "recording" });
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS && rec.state === "recording") rec.stop();
    }, 200);
  }, [mime, release, send, lang]);

  /* ---------- Shared controls ---------- */

  const stop = useCallback(() => {
    if (recognizer.current) recognizer.current.stop();
    else if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    kept.current = null;
    if (recognizer.current) {
      recognizer.current.abort();
      // Some browsers don't fire `end` after `abort`; make sure the state resets.
      recognizer.current = null;
      heard.current = "";
      setInterim("");
      release();
      setState({ kind: "idle" });
    } else if (recorder.current?.state === "recording") recorder.current.stop();
    else {
      release();
      setState({ kind: "idle" });
    }
    try {
      previewRec.current?.abort();
    } catch {}
    previewRec.current = null;
  }, [release]);

  const toggle = useCallback(() => {
    if (recognizer.current || recorder.current) stop();
    else if (engine === "whisper") void startRecorder(true);
    else if (engine === "speech") startSpeech();
    else if (engine === "recorder") void startRecorder();
  }, [engine, startRecorder, startSpeech, stop]);

  /** Starts listening if it isn't already (for push-to-talk). */
  const start = useCallback(() => {
    if (recognizer.current || recorder.current) return;
    if (engine === "whisper") void startRecorder(true);
    else if (engine === "speech") startSpeech();
    else if (engine === "recorder") void startRecorder();
  }, [engine, startRecorder, startSpeech]);

  const retry = useCallback(() => {
    if (!kept.current || retried.current) return;
    retried.current = true;
    void send(kept.current);
  }, [send]);

  // Leaving while listening throws it away and lets go of the microphone.
  useEffect(
    () => () => {
      cancelled.current = true;
      recognizer.current?.abort();
      recognizer.current = null;
      if (recorder.current?.state === "recording") recorder.current.stop();
      try {
        previewRec.current?.abort();
      } catch {}
      previewRec.current = null;
      release();
    },
    [release],
  );

  return {
    supported: engine !== null,
    engine,
    state,
    elapsed,
    interim,
    lang,
    setLang,
    toggle,
    start,
    stop,
    cancel,
    retry,
    canRetry: state.kind === "failed" && state.canRetry,
  };
}
