"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { clampSize, type InkName } from "@/modules/drop/logic";
import { MicIcon } from "@/components/icons";
import { useHoldToTalk } from "@/modules/drop/use-hold-to-talk";
import { useVoice } from "@/modules/drop/use-voice";
import { insertAtCursor } from "@/modules/drop/voice";
import { HandText } from "./thought-bubble";

/** How wide written text may run before it wraps, like a hand reaching the edge of a page. */
const WRAP = 420;
/** The base size of written text (size 1). */
const BASE = 22;

/**
 * Words written straight on the paper with the Text tool: no card, no tape,
 * just ink. With Select in hand, a click picks it (an outline and a corner to
 * drag bigger or smaller) and a double-click (or Enter) edits; with the Text
 * tool a click edits. Empty on save rubs it out. A blank one opens already
 * editing. Never a to-do: there is nothing to strike.
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
  size = 1,
  color = "ink",
  selectable = false,
  selected = false,
  onSelect,
  onResize,
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
  size?: number;
  color?: InkName;
  /** Select is in hand: a click picks it instead of editing. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  /** A corner was dragged: the new size. */
  onResize?: (size: number) => void;
}) {
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? size;
  const self = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) self.current?.focus({ preventScroll: true });
  }, [selected]);
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

  const ink: CSSProperties = { maxWidth: WRAP * Math.max(1, shown), fontSize: BASE * shown, color: `var(--ink-${color})` };
  const open = () => {
    setDraft(text);
    setEditing(true);
  };

  /** The corner handle: drag away from the text to grow it, towards it to shrink. */
  const resize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = self.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const startDiag = Math.hypot(r.width, r.height) || 1;
    const sx = e.clientX;
    const sy = e.clientY;
    let next = size;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const grow = (Math.hypot(r.width + (ev.clientX - sx), r.height + (ev.clientY - sy)) * Math.sign(r.width + (ev.clientX - sx))) / startDiag;
      // Steps of 2 px, unless Shift is held.
      const raw = clampSize(size * grow);
      next = ev.shiftKey ? raw : clampSize(Math.round((raw * BASE) / 2) * 2 / BASE);
      setLive(next);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setLive(null);
      if (ev.type === "pointerup" && next !== size) onResize?.(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  const motion = leaving === "crumple" ? "fade-away" : fresh && !startEditing ? "drop-in" : "";

  if (editing) {
    return (
      <TextEditor
        draft={draft}
        setDraft={setDraft}
        interim={interim}
        style={ink}
        onFinish={finish}
        // The hint shows only on fresh text just placed, never when editing words already written.
        hint={!text}
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={self}
        role="button"
        tabIndex={0}
        data-paper-text=""
        data-keys=""
        aria-label={`Written: ${text}. ${selectable ? "Double-click or Enter to edit" : "Enter to edit"}, Delete to rub out.`}
        aria-pressed={selectable ? selected : undefined}
        style={ink}
        onClick={() => (selectable ? onSelect?.() : open())}
        onDoubleClick={() => selectable && open()}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter") {
            e.preventDefault();
            open();
          } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onDelete();
          }
        }}
        className={`paper-text hand font-note leading-snug break-words whitespace-pre-wrap outline-none ${motion} ${fresh ? "write-on" : ""} ${
          selected ? "rounded-md ring-1 ring-red-text/70 ring-offset-4 ring-offset-transparent" : ""
        }`}
      >
        <HandText text={text} seed={seed} />
      </div>
      {selected && onResize && (
        <button
          type="button"
          aria-label="Drag to resize the text"
          title="Drag to resize · Shift for any size"
          onPointerDown={resize}
          className="absolute -right-2.5 -bottom-2.5 size-3 cursor-nwse-resize rounded-[3px] border border-red-text bg-sheet"
        />
      )}
      {live !== null && (
        <span className="pointer-events-none absolute -top-7 left-0 rounded-md bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg">{Math.round(live * BASE)} px</span>
      )}
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
  hint,
}: {
  draft: string;
  setDraft: (fn: (d: string) => string) => void;
  interim: string;
  style: CSSProperties;
  onFinish: () => void;
  hint: boolean;
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
        placeholder={hint ? "Write, or hold Space to talk…" : undefined}
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
        style={{ fontSize: style.fontSize, color: style.color, width: `min(${style.maxWidth}px, 80vw)` }}
        className="hand block resize-none overflow-hidden bg-transparent p-0 pr-10 font-note leading-snug caret-red-text outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-mute/70"
      />
      {heard && <span style={{ fontSize: style.fontSize }} className="pointer-events-none block font-note leading-snug text-mute/70">{heard}</span>}
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
