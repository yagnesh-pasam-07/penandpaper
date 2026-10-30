"use client";

import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PenIcon } from "@/components/icons";
import { shortcutText, usePlatform } from "@/lib/platform";
import { imageFiles, shrinkImage, type Picture } from "./image";
import { MAX_THOUGHT } from "./logic";
import { SPEECH_LANGS, parseSpeechLang } from "./speech";
import { useVoice } from "./use-voice";
import { formatElapsed, insertAtCursor } from "./voice";

/** The floating pen at the bottom of the page: opens the writer. */
export const PenButton = forwardRef<HTMLButtonElement, { onOpen: () => void; hidden: boolean }>(function PenButton({ onOpen, hidden }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label="Write a thought (Space)"
      className={`fixed bottom-5 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-full border border-line bg-sheet pr-4 pl-4 text-ink shadow-[0_14px_34px_-18px_var(--shadow)] transition-opacity hover:bg-soft ${hidden ? "pointer-events-none opacity-0" : ""}`}
    >
      <span className="text-red-text">
        <PenIcon size={20} />
      </span>
      <span className="text-[15px] font-medium">Write…</span>
      <kbd className="rounded-md border border-line bg-soft px-1.5 py-0.5 font-sans text-[12px] text-mute max-sm:hidden">Space</kbd>
    </button>
  );
});

/** How far the on-screen keyboard pushes up from the bottom (phones), so the sheet sits above it. */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const read = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      setInset(0);
    };
  }, [active]);
  return inset;
}

/**
 * The writer: a focused card for putting thoughts down, with the sheet still
 * visible behind. Enter drops and keeps it open for the next; Shift+Enter is a
 * new line; Esc or a click outside closes it (unfinished text is kept).
 */
export function Writer({
  draft,
  onDraft,
  image,
  onImage,
  onDrop,
  onClose,
}: {
  draft: string;
  onDraft: (text: string) => void;
  /** A picture pasted in (or picked) for this thought. */
  image: Picture | null;
  onImage: (image: Picture | null) => void;
  /** The written text, and where on screen it was written (the note flies from there). */
  onDrop: (text: string, from: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const inset = useKeyboardInset(true);
  const picker = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState("");
  const platform = usePlatform();
  // The latest text, so words that arrive after a recording land in what's there now.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Where the cursor was when listening began: live words are previewed there and land there.
  // State draws the preview; the ref lets callbacks read the latest value.
  const [anchorAt, setAnchorAt] = useState<{ start: number; end: number } | null>(null);
  const anchor = useRef<{ start: number; end: number } | null>(null);
  useEffect(() => {
    anchor.current = anchorAt;
  }, [anchorAt]);

  /** Spoken words go in at the cursor (or over the selection); they are not dropped until you say so. */
  const insertSpoken = (words: string) => {
    const el = area.current;
    const where = anchor.current ?? { start: el?.selectionStart ?? draftRef.current.length, end: el?.selectionEnd ?? draftRef.current.length };
    setAnchorAt(null);
    const at = insertAtCursor(draftRef.current, words, where.start, where.end);
    onDraft(at.text);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(at.cursor, at.cursor);
    });
  };
  const voice = useVoice(insertSpoken);
  const listening = voice.state.kind === "recording";
  const working = voice.state.kind === "transcribing";
  /** The text on screen: while the browser is still working out the words, they show at the cursor as a preview. */
  const preview = voice.interim
    ? insertAtCursor(draft, voice.interim, anchorAt?.start ?? draft.length, anchorAt?.end ?? draft.length).text
    : draft;
  /** Starts or stops speaking, remembering the cursor so the words land where it was. */
  const speak = () => {
    if (!listening) {
      const el = area.current;
      const here = { start: el?.selectionStart ?? draft.length, end: el?.selectionEnd ?? draft.length };
      anchor.current = here;
      setAnchorAt(here);
    }
    voice.toggle();
  };

  /** Pastes or picks a picture onto this thought (the first, if there are several). */
  const attach = async (files: File[]) => {
    if (!files.length) return false;
    try {
      onImage(await shrinkImage(files[0]));
      setProblem("");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
    area.current?.focus();
    return true;
  };

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const send = () => {
    if (listening || working) return;
    const value = draft.trim().slice(0, MAX_THOUGHT);
    if (!value && !image) return;
    const r = area.current?.getBoundingClientRect();
    onDrop(value, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    area.current?.focus();
  };

  // Keeps Tab inside the writer while it's open.
  const trap = (e: ReactKeyboardEvent) => {
    // ⌘/Ctrl+Shift+M starts or stops recording from anywhere in the writer.
    if (voice.supported && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      speak();
      return;
    }
    if (e.key !== "Tab" || !card.current) return;
    const stops = [...card.current.querySelectorAll<HTMLElement>("textarea, button:not([disabled])")];
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/45 sm:items-center sm:pb-[12vh]"
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label="Write a thought"
        onKeyDown={trap}
        style={{ marginBottom: inset }}
        className="flex w-full flex-col gap-2 rounded-t-[22px] border border-line bg-sheet px-5 pt-4 pb-3 shadow-[0_30px_70px_-30px_var(--shadow)] sm:w-[560px] sm:max-w-[calc(100vw-32px)] sm:rounded-[22px]"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-1.5 flex size-9 shrink-0 items-center justify-center text-red-text">
            <PenIcon size={22} />
          </span>
          <textarea
            ref={area}
            value={preview}
            readOnly={!!voice.interim}
            maxLength={MAX_THOUGHT}
            rows={Math.min(6, Math.max(2, preview.split("\n").length, Math.ceil(preview.length / 44)))}
            aria-label="Thought"
            enterKeyHint="send"
            placeholder="What's on your mind?"
            onChange={(e) => onDraft(e.target.value)}
            onPaste={(e) => {
              const files = imageFiles(e.clipboardData);
              if (!files.length) return;
              // A picture pasted while writing goes on this thought.
              e.preventDefault();
              e.stopPropagation();
              void attach(files);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              } else if (e.key === "Escape") {
                e.preventDefault();
                // Esc while recording only throws the recording away.
                if (listening || working) {
                  setAnchorAt(null);
                  voice.cancel();
                } else onClose();
              }
            }}
            className={`ruled-line hand min-h-[72px] flex-1 resize-none bg-transparent font-note text-[22px] leading-[36px] caret-ink outline-none placeholder:font-sans placeholder:text-lg placeholder:text-mute focus-visible:outline-none text-ink`}
          />
        </div>
        {image && (
          <div className="flex items-end gap-2.5 pl-12">
            <span className="relative -rotate-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from a paste */}
              <img src={image.url} alt="Picture for this thought" className="h-[92px] max-w-[160px] rounded-lg bg-soft object-cover shadow-[inset_0_0_0_1px_var(--line)]" />
              <button
                type="button"
                onClick={() => {
                  onImage(null);
                  area.current?.focus();
                }}
                aria-label="Remove picture"
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink text-[13px] leading-none text-bg"
              >
                ×
              </button>
            </span>
            <span className="text-[12px] text-mute">
              picture · {image.w}×{image.h}
            </span>
          </div>
        )}
        {problem && (
          <p role="alert" className="pl-12 text-[13px] text-red-text">
            {problem}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pl-12 text-[13px] text-mute">
          {listening || working || voice.state.kind === "failed" ? (
            <span role="status" aria-live="polite" className="flex min-w-0 items-center gap-2">
              {listening && (
                <>
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-red motion-safe:animate-pulse" />
                  <span className="font-mono tabular-nums text-ink">{formatElapsed(voice.elapsed)}</span>
                  <span className="truncate">Listening · click the mic to stop · Esc cancels</span>
                </>
              )}
              {working && <span>Turning it into words…</span>}
              {voice.state.kind === "failed" && (
                <>
                  <span className="truncate text-red-text">{voice.state.message}</span>
                  {voice.canRetry && (
                    <button type="button" onClick={voice.retry} className="shrink-0 font-semibold text-ink underline underline-offset-2">
                      Retry
                    </button>
                  )}
                </>
              )}
            </span>
          ) : (
            <>
              <span className="max-sm:hidden">{image ? "Enter drops it with the picture" : `Enter to drop · ${shortcutText(["⌘", "V"], platform)} a picture`} · Esc to close</span>
              <span className="sm:hidden">Enter to drop</span>
            </>
          )}
          <span className="flex items-center gap-1">
            <input
              ref={picker}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void attach([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            {voice.supported && voice.engine === "speech" && SPEECH_LANGS.length > 1 && !listening && !working && (
              <select
                value={voice.lang}
                onChange={(e) => {
                  const next = parseSpeechLang(e.target.value);
                  if (next) voice.setLang(next);
                }}
                aria-label="Speech language"
                title="Speech language"
                className="h-9 max-w-[96px] cursor-pointer rounded-lg bg-transparent px-1.5 text-[13px] text-mute hover:bg-soft hover:text-ink"
              >
                {SPEECH_LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}
            {voice.supported && (
              <button
                type="button"
                onClick={speak}
                disabled={working}
                aria-pressed={listening}
                aria-label={listening ? "Stop recording" : "Speak a thought"}
                title={
                  listening
                    ? "Stop recording"
                    : voice.engine === "speech"
                      ? `Speak a thought (${shortcutText(["⌘", "⇧", "M"], platform)}). Chrome's built-in recogniser sends your voice to Google; Safari uses Apple.`
                      : `Speak a thought (${shortcutText(["⌘", "⇧", "M"], platform)})`
                }
                className={`flex size-9 items-center justify-center rounded-lg disabled:opacity-40 ${listening ? "bg-red text-on-red" : "hover:bg-soft hover:text-ink"}`}
              >
                {listening ? <StopIcon /> : <MicIcon />}
              </button>
            )}
            <button type="button" onClick={() => picker.current?.click()} aria-label="Add a picture" title="Add a picture" className="flex size-9 items-center justify-center rounded-lg hover:bg-soft hover:text-ink">
              <CameraIcon />
            </button>
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 font-medium hover:bg-soft hover:text-ink">
              Close
            </button>
            <button type="button" onClick={send} disabled={!draft.trim() && !image} className="h-9 rounded-lg bg-red px-3.5 font-semibold text-on-red disabled:opacity-40">
              Drop
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** A small microphone, for "speak a thought". */
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

/** A small square, for "stop recording". */
function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

/** A small camera, for "add a picture". */
function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5C4 7.7 4.7 7 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13C4.7 19 4 18.3 4 17.5v-9z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
