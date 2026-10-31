"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
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
  spoken = null,
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
  /** Words heard so far while Space is held, shown faintly after the cursor. */
  interim?: string;
  /** Words just spoken into it while it is open; each new `n` adds them once. */
  spoken?: { words: string; n: number } | null;
  leaving?: "crumple" | null;
  onEdit: (text: string) => void;
  /** Rubbed out: saved empty, or Delete. */
  onDelete: () => void;
  /** The editor closed (saved or not). */
  onDone?: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(text);
  const area = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  // Asked to open again (a new one placed, or speech arriving): adjust while rendering, not in an effect.
  const [asked, setAsked] = useState(startEditing);
  if (startEditing !== asked) {
    setAsked(startEditing);
    if (startEditing && !editing) {
      setDraft(text);
      setEditing(true);
    }
  }
  // Words spoken with Space held while this is open go in at the end of what's being written.
  const [lastSpoken, setLastSpoken] = useState(spoken?.n ?? 0);
  if (spoken && spoken.n !== lastSpoken) {
    setLastSpoken(spoken.n);
    if (editing) setDraft((d) => (d.trim() ? `${d.trimEnd()} ${spoken.words}` : spoken.words));
  }

  useEffect(() => {
    if (!editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  // The editor grows with what's written, like the ink would.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing, interim]);

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
      <div className="relative" style={ink} data-paper-text="">
        <label htmlFor={id} className="sr-only">
          Write on the paper
        </label>
        <textarea
          id={id}
          ref={area}
          value={draft}
          rows={1}
          placeholder="Write, or hold Space to speak…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Enter is a new line, as on paper; Esc or ⌘/Ctrl+Enter puts the pen down.
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              area.current?.blur();
            }
            e.stopPropagation();
          }}
          className="hand block w-[min(420px,80vw)] resize-none overflow-hidden bg-transparent p-0 font-note text-[22px] leading-snug text-ink caret-red-text outline-none placeholder:font-sans placeholder:text-[15px] placeholder:text-mute/70"
        />
        {interim && <span className="pointer-events-none block font-note text-[22px] leading-snug text-mute/70">{interim}</span>}
      </div>
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
