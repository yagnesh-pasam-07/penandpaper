"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { audioExtension, MAX_RECORDING_MS, pickRecorderMime } from "./voice";

export type VoiceState =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "transcribing" }
  | { kind: "failed"; message: string; canRetry: boolean };

const noSubscribe = () => () => {};

/** The recording type this browser can make, or null when it can't record at all (then there is no mic button). */
function recorderMime(): string | null {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return pickRecorderMime((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Record from the microphone and turn it into words: `toggle` starts or stops,
 * `cancel` throws the recording away, and `retry` sends a failed one again
 * (once). Stops by itself after a minute. The words go to `onText`; nothing is
 * sent to the server until the recording stops.
 */
export function useVoice(onText: (text: string) => void) {
  const mime = useSyncExternalStore(noSubscribe, recorderMime, () => null);
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const kept = useRef<Blob | null>(null);
  const retried = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

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
      else if (res.status === 503) setState({ kind: "failed", message: "Voice isn't set up on this server yet.", canRetry: false });
      else setState({ kind: "failed", message: body.error ?? "Couldn't turn that into words.", canRetry: (res.status >= 500 || res.status === 429) && !retried.current });
    } catch {
      // The recording stays so one retry doesn't mean speaking it all again.
      setState({ kind: "failed", message: "Couldn't reach Pen & Paper. Check your connection.", canRetry: !retried.current });
    }
  }, []);

  const start = useCallback(async () => {
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

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    kept.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else {
      release();
      setState({ kind: "idle" });
    }
  }, [release]);

  const toggle = useCallback(() => {
    if (recorder.current) stop();
    else void start();
  }, [start, stop]);

  const retry = useCallback(() => {
    if (!kept.current || retried.current) return;
    retried.current = true;
    void send(kept.current);
  }, [send]);

  // Leaving while recording throws the recording away and lets go of the microphone.
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    [release],
  );

  return { supported: mime !== null, state, elapsed, toggle, cancel, retry, canRetry: state.kind === "failed" && state.canRetry };
}
