"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { MicIcon } from "@/components/icons";
import { useHoldToTalk } from "@/modules/drop/use-hold-to-talk";
import { useVoice } from "@/modules/drop/use-voice";
import { insertAtCursor } from "@/modules/drop/voice";
import { HandText } from "./thought-bubble";

/** How wide written text may run before it wraps, like a hand reaching the edge of a page. */
const WRAP = 420;

/**
 * Words written straight on the paper with the Text tool: no card, no tape,
 * just ink. Click to edit in place; empty on save rubs it out. A blank one
 * opens already editing, so a click with the Text tool goes straight to typing.
 * Never a to-do: there is nothing to strike.
 */
export function PaperText({
  text,
  seed,
  fresh,
  editing: startEditing = false,
  interim = "",
  leaving,
  onEdit,
  onDelete,
  onDone,
}: {
  text: string;
  seed: string;
  fresh?: boolean;
  /** Opens in the editor (a new one, just placed). */
  editing?: boolean;
  /** Words heard on bare paper (Space held before the pen was down), shown faintly. */
  interim?: string;
  leaving?: "crumple" | null;
  onEdit: (text: string) => void;
  /** Rubbed out: saved empty, or Delete. */
  onDelete: () => void;
  /** The editor closed (saved or not). */
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(text);
  // Asked to open again (a new one placed, or speech arriving): adjust while rendering, not in an effect.
  const [asked, setAsked] = useState(startEditing);
  if (startEditing !== asked) {
    setAsked(startEditing);
    if (startEditing && !editing) {
      setDraft(text);
      setEditing(true);
    }
  }
  const finish = () => {
    const next = draft.trim();
    setEditing(false);
    onDone?.();
    if (!next) onDelete();
    else if (next !== text) onEdit(next);
  };

  const ink: CSSProperties = { maxWidth: WRAP };
  const motion = leaving === "crumple" ? "fade-away" : fresh && !startEditing ? "drop-in" : "";

  if (editing) {
    return (
      <TextEditor
        draft={draft}
        setDraft={setDraft}
        interim={interim}
        style={ink}
        onFinish={finish}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-paper-text=""
      data-keys=""
      aria-label={`Written: ${text}. Enter to edit, Delete to rub out.`}
      style={ink}
      onClick={() => {
        setDraft(text);
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter") {
          e.preventDefault();
          setDraft(text);
          setEditing(true);
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          onDelete();
        }
      }}
      className={`paper-text hand font-note text-[22px] leading-snug break-words whitespace-pre-wrap text-ink ${motion} ${fresh ? "write-on" : ""}`}
    >
      <HandText text={text} seed={seed} />
    </div>
  );
}

/**
 * The open pen: a bare textarea on the paper with its own voice. Hold Space
 * (like Claude's CLI) or click the mic and speak; the words appear faintly as
 * they are heard and go in at the cursor when you stop.
 */
function TextEditor({
  draft,
  setDraft,
  interim: outside,
  style,
  onFinish,
}: {
  draft: string;
  setDraft: (fn: (d: string) => string) => void;
  interim: string;
  style: CSSProperties;
  onFinish: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  // Where the words go: the cursor when listening started.
  const at = useRef<{ start: number; end: number } | null>(null);
  const voice = useVoice(
    (words) => {
      const where = at.current ?? { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
      let cursor = 0;
      setDraft((d) => {
        const next = insertAtCursor(d, words, where.start, where.end, 2000);
        cursor = next.cursor;
        return next.text;
      });
      at.current = null;
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(cursor, cursor);
      });
    },
    { hold: true },
  );
  const listening = voice.state.kind === "recording";
  const working = voice.state.kind === "transcribing";
  const mark = () => {
    const el = area.current;
    at.current = { start: el?.selectionStart ?? draft.length, end: el?.selectionEnd ?? draft.length };
  };
  const talk = useHoldToTalk(
    {
      ...voice,
      start: () => {
        mark();
        voice.start();
      },
    },
    area,
    setDraft,
  );
  const heard = voice.interim || outside;
  // Leaving the box while listening keeps the words: finish only once they've landed.
  const busy = listening || working;

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  // The editor grows with what's written, like the ink would.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, heard]);

  return (
    <div className="relative" style={style} data-paper-text="">
      <label htmlFor={id} className="sr-only">
        Write on the paper
      </label>
      <textarea
        id={id}
        ref={area}
        value={draft}
        rows={1}
        placeholder="Write, or hold Space to talk…"
        readOnly={listening}
        onChange={(e) => setDraft(() => e.target.value)}
        onBlur={(e) => {
          // A click on the mic, or words still being heard: keep the pen up.
          if ((e.relatedTarget as HTMLElement | null)?.closest("[data-text-mic]") || busy) return;
          onFinish();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (talk.onKeyDown(e)) return;
          // Enter is a new line, as on paper; Esc or ⌘/Ctrl+Enter puts the pen down.
          if (e.key === "Escape" && (listening || working)) {
            e.preventDefault();
            voice.cancel();
          } else if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            area.current?.blur();
          }
        }}
        onKeyUp={(e) => {
          e.stopPropagation();
          talk.onKeyUp(e);
        }}
        className="hand block w-[min(420px,80vw)] resize-none overflow-hidden bg-transparent p-0 pr-10 font-note text-[22px] leading-snug text-ink caret-red-text outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-mute/70"
      />
      {heard && <span className="pointer-events-none block font-note text-[22px] leading-snug text-mute/70">{heard}</span>}
      {voice.supported && (
        <button
          type="button"
          data-text-mic=""
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Speak (or hold Space)"}
          title={listening ? "Stop listening" : "Speak · or hold Space"}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => {
            if (!listening) mark();
            voice.toggle();
            area.current?.focus();
          }}
          className={`absolute top-0 -right-1 flex size-8 items-center justify-center rounded-full transition-colors ${
            listening ? "bg-red text-on-red shadow-[0_0_0_6px_color-mix(in_srgb,var(--red)_22%,transparent)]" : working ? "text-mute" : "text-mute hover:bg-soft hover:text-red-text"
          }`}
        >
          {listening ? <span className="voice-dot size-2.5 rounded-full bg-on-red" aria-hidden="true" /> : <MicIcon size={16} />}
        </button>
      )}
      {(listening || working || voice.state.kind === "failed") && (
        <span role="status" className={`mt-1 block font-sans text-[12px] ${voice.state.kind === "failed" ? "text-red-text" : "text-mute"}`}>
          {voice.state.kind === "failed" && "message" in voice.state ? String(voice.state.message) : listening ? "Listening… let go of Space, or click the mic" : "Writing it down…"}
        </span>
      )}
    </div>
  );
}
