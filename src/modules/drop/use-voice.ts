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

/** "speech" is the browser's own recogniser (no key); "recorder" records and sends the audio to the server. */
export type VoiceEngine = "speech" | "recorder";

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
export function useVoice(onText: (text: string) => void) {
  const engine = useSyncExternalStore<VoiceEngine | null>(noSubscribe, detectEngine, () => null);
  const mime = useSyncExternalStore(noSubscribe, recorderMime, () => null);
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
    rec.continuous = false;
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
  }, [lang, release]);

  /* ---------- Engine 2: record and send to the server ---------- */

  const send = useCallback(async (blob: Blob) => {
    setState({ kind: "transcribing" });
    kept.current = blob;
    try {
      const ext = audioExtension(blob.type) ?? "webm";
      const form = new FormData();
      form.append("audio", blob, `voice.${ext}`);
      const res = await fetch("/api/drop/transcribe", { method: "POST", body: form, cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (res.ok && body.text) {
        kept.current = null;
        retried.current = false;
        setState({ kind: "idle" });
        onTextRef.current(body.text);
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

  const startRecorder = useCallback(async () => {
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
      release();
      if (cancelled.current) {
        chunks.current = [];
        setState({ kind: "idle" });
        return;
      }
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime });
      chunks.current = [];
      void send(blob);
    };
    rec.start();
    const startedAt = Date.now();
    setElapsed(0);
    setState({ kind: "recording" });
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS && rec.state === "recording") rec.stop();
    }, 200);
  }, [mime, release, send]);

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
  }, [release]);

  const toggle = useCallback(() => {
    if (recognizer.current || recorder.current) stop();
    else if (engine === "speech") startSpeech();
    else if (engine === "recorder") void startRecorder();
  }, [engine, startRecorder, startSpeech, stop]);

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
    cancel,
    retry,
    canRetry: state.kind === "failed" && state.canRetry,
  };
}
