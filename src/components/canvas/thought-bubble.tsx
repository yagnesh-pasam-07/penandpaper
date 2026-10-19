"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckIcon, CloseIcon, PenIcon, PencilIcon, WhenIcon } from "@/components/icons";
import { linkify } from "@/lib/linkify";
import { bubbleStyle, rand } from "./bubble";
import { RankMark } from "./rank-mark";

type Props = {
  text: string;
  done: boolean;
  /** Pen is a task; pencil is an idea (graphite, untinted, never struck). */
  kind?: "pen" | "pencil";
  shape: number;
  /** Makes the hand-drawn outline and the handwriting's wobble; keep it stable for the same thought. */
  seed?: string;
  /** When it was dropped; on the sheet it shows on hover, in the phone stream under the text. */
  meta?: ReactNode;
  /** The day it was first dropped, when it rolled over: shown as a small mark. */
  carried?: string;
  /** Scheduled for (today or a day it was folded till): a small chip. */
  when?: string;
  /** Just dropped: the ink writes on, then the note settles. */
  fresh?: boolean;
  /** Full-width card for the phone stream instead of a floating bubble. */
  stream?: boolean;
  readOnly?: boolean;
  /** On a sheet where it can be dragged: shows a grab cursor. */
  movable?: boolean;
  /** Something dragged over it would land here: a soft red outline and a slight lift. */
  target?: boolean;
  /** Plays on its way out: scrunched into a ball, or folded away. */
  leaving?: "crumple" | "fold" | null;
  /** Plays on its way back (undo). */
  returning?: boolean;
  /** Its place in today's order, if numbered: a red circled number at the corner. */
  rank?: number | null;
  /** Keys 1–6 on a selected thought set its number (0 clears). */
  onRank?: (rank: number | null) => void;
  /** "Stack with…": the S key when it's selected, or a long press on a phone. */
  onStackWith?: () => void;
  /** "When": the W key or the calendar button. */
  onWhen?: () => void;
  /** Ink a pencil idea into a task, or pencil a task into an idea. */
  onInk?: () => void;
  onEdit?: (text: string) => void;
  onToggle?: () => void;
  /** Crumple it (with undo, by whoever owns it). */
  onDelete?: () => void;
};

const SWIPE = 64;
/** How long a finger rests before a press opens "Stack with…". */
const LONG_PRESS = 480;

/**
 * Handwriting, word by word: each word sits a touch differently (tilt,
 * baseline, size, spacing), seeded so the same note always looks the same.
 * The real text stays in the page, selectable and read out as written.
 */
export function HandText({ text, seed = "" }: { text: string; seed?: string }) {
  let w = 0;
  return (
    <>
      {linkify(text).map((part, i) =>
        part.kind === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="break-all text-red-text underline decoration-1 underline-offset-2"
          >
            {part.value}
          </a>
        ) : (
          part.value.split(/(\s+)/).map((word, j) => {
            if (!word || /^\s+$/.test(word)) return word;
            const k = w++;
            const jitter: CSSProperties = {
              display: "inline-block",
              transform: `rotate(${((rand(seed, k * 4) - 0.5) * 1.6).toFixed(2)}deg) translateY(${((rand(seed, k * 4 + 1) - 0.5) * 2).toFixed(2)}px)`,
              fontSize: `${(1 + (rand(seed, k * 4 + 2) - 0.5) * 0.06).toFixed(3)}em`,
              letterSpacing: `${((rand(seed, k * 4 + 3) - 0.5) * 0.4).toFixed(2)}px`,
            };
            return (
              <span key={`${i}-${j}`} style={jitter}>
                {word}
              </span>
            );
          })
        ),
      )}
    </>
  );
}

/** Text with http(s) links made clickable (no wobble): for places that aren't handwriting. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.kind === "link" ? (
          <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="break-all text-red-text underline decoration-1 underline-offset-2">
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

/** The write-on wipe's length: ~18ms a letter, never more than 700ms. */
const writeOn = (text: string) => `${Math.min(700, Math.max(240, text.length * 18))}ms`;

const toolButton = "flex size-8 items-center justify-center rounded-full border border-line bg-sheet shadow-sm hover:bg-soft";

/**
 * One thought on paper. Click to edit, double-click (or swipe right on a phone)
 * to strike it out, ✕ (Delete key, or swipe left) to crumple it. Pencil ideas
 * can't be struck: ink them first.
 */
export function ThoughtBubble({
  text,
  done,
  kind = "pen",
  shape,
  seed,
  meta,
  carried,
  when,
  fresh,
  stream,
  readOnly,
  movable,
  target,
  leaving,
  returning,
  rank,
  onRank,
  onStackWith,
  onWhen,
  onInk,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [dx, setDx] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const pencil = kind === "pencil";
  const strike = pencil ? undefined : onToggle;

  useEffect(() => {
    if (!editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (press.current) clearTimeout(press.current);
    },
    [],
  );

  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };

  const startEdit = () => {
    if (readOnly || !onEdit) return;
    setDraft(text);
    setEditing(true);
  };

  const save = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== text) onEdit?.(next);
  };

  // A double-click also fires two clicks; wait briefly so it doesn't open the editor.
  const onClick = () => {
    if (readOnly || swipe.current?.swiped) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(startEdit, 230);
  };

  const onDoubleClick = () => {
    if (readOnly) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    strike?.();
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // Swipes only in the phone stream; on the sheet a touch drags.
    if (readOnly || !stream || e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY, swiped: false };
    if (onStackWith) {
      press.current = setTimeout(() => {
        press.current = null;
        // Counts as handled, so letting go doesn't also open the editor.
        if (swipe.current) swipe.current.swiped = true;
        navigator.vibrate?.(10);
        onStackWith();
      }, LONG_PRESS);
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const x = e.clientX - s.x;
    if (Math.hypot(x, e.clientY - s.y) > 8) endPress();
    if (Math.abs(e.clientY - s.y) > 30) {
      swipe.current = null;
      setDx(0);
      return;
    }
    // Right strikes (pen only), left crumples.
    setDx(Math.max(onDelete ? -SWIPE * 1.4 : 0, Math.min(x, strike ? SWIPE * 1.4 : 0)));
  };
  const onPointerUp = () => {
    endPress();
    const s = swipe.current;
    if (s && dx >= SWIPE) {
      s.swiped = true;
      strike?.();
      setTimeout(() => (swipe.current = null), 50);
    } else if (s && dx <= -SWIPE) {
      s.swiped = true;
      onDelete?.();
      setTimeout(() => (swipe.current = null), 50);
    } else swipe.current = null;
    setDx(0);
  };

  const look = bubbleStyle(shape, false, seed, pencil ? "pencil" : "pen");
  // Done stops shouting: the tint goes neutral, the outline stays.
  const settled: CSSProperties = {
    ...look,
    ...(done ? { backgroundColor: "var(--soft)" } : {}),
    ...(target ? { outline: "2px solid color-mix(in srgb, var(--red-text) 55%, transparent)", outlineOffset: 3 } : {}),
  };
  const shapeStyle = stream ? { ...settled, transform: `translateX(${dx}px)` } : settled;
  const motion = leaving === "crumple" ? "crumple-away" : leaving === "fold" ? "fold-away" : returning ? "uncrumple" : fresh ? "drop-in" : "";

  if (editing) {
    return (
      <div style={shapeStyle} className={`flex flex-col gap-2.5 p-4 ${stream ? "w-full" : "w-[320px] max-w-full"}`}>
        <label className="sr-only" htmlFor={fieldId}>
          Edit thought
        </label>
        <textarea
          id={fieldId}
          ref={area}
          value={draft}
          rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 28)))}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          className="w-full resize-none rounded-xl bg-sheet/70 px-3 py-2 font-note text-[19px] leading-snug outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} className="h-9 rounded-[10px] bg-ink px-3.5 text-sm font-semibold text-bg">
            Save
          </button>
          {strike ? (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                strike();
              }}
              className="h-9 rounded-[10px] border border-ink/20 px-3 text-sm font-medium"
            >
              {done ? "Unstrike" : "Strike out"}
            </button>
          ) : (
            onInk && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  onInk();
                }}
                className="h-9 rounded-[10px] border border-ink/20 px-3 text-sm font-medium"
              >
                Ink it
              </button>
            )
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              onDelete?.();
            }}
            className="h-9 rounded-[10px] px-3 text-sm font-medium text-red-text hover:bg-red-soft"
          >
            Crumple
          </button>
        </div>
      </div>
    );
  }

  const label = `${rank ? `Number ${rank}: ` : ""}${pencil ? "Idea: " : ""}${text}${done ? ", done" : ""}${when ? `, ${when}` : ""}`;
  const keys = [onEdit && "Enter to edit", onRank && "1 to 6 to number", onStackWith && "S to stack", onWhen && "W for when", onDelete && "Delete to crumple"].filter(Boolean).join(", ");

  return (
    <div className={`group relative ${stream ? "w-full" : "max-w-[300px]"} ${motion}`}>
      {!readOnly && stream && dx !== 0 && (
        <span aria-hidden="true" className={`absolute inset-y-0 flex items-center font-hand text-xl text-red-text ${dx > 0 ? "left-0 pl-3" : "right-0 pr-3"}`}>
          {dx > 0 ? (done ? "unstrike" : "strike") : "crumple"}
        </span>
      )}
      <div
        style={shapeStyle}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        // Selectable from the keyboard: Enter edits, S stacks, W schedules, Delete crumples.
        tabIndex={readOnly ? undefined : 0}
        data-keys={readOnly ? undefined : ""}
        aria-label={readOnly ? undefined : `${label}. ${keys}.`}
        onKeyDown={(e) => {
          if (readOnly || e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
          const k = e.key.toLowerCase();
          const digit = /^[0-6]$/.test(k) && onRank ? () => onRank(k === "0" ? null : Number(k)) : undefined;
          const act = digit ?? (k === "enter" ? startEdit : k === "s" ? onStackWith : k === "w" ? onWhen : k === "delete" || k === "backspace" ? onDelete : undefined);
          if (!act) return;
          e.preventDefault();
          act();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`paper-note relative flex flex-col items-start gap-1.5 px-6 py-5 text-left transition-[background-color,transform] duration-300 ${done ? "is-done" : ""} ${pencil ? "is-pencil" : ""} ${readOnly ? "" : movable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-text touch-pan-y select-none"}`}
      >
        <span
          style={fresh ? ({ "--write": writeOn(text) } as CSSProperties) : undefined}
          className={`hand font-note text-[19px] leading-snug break-words whitespace-pre-wrap sm:text-[20px] ${fresh ? "write-on" : ""}`}
        >
          <span className="pen-strike">
            <HandText text={text} seed={seed} />
          </span>
        </span>
        {(stream && meta) || when ? (
          <span className="flex flex-wrap items-center gap-1.5">
            {when && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-sheet/70 px-1.5 text-[11px] font-medium text-mute">
                <WhenIcon size={10} />
                {when}
              </span>
            )}
            {stream && meta && <span className="font-mono text-[11px] text-mute">{meta}</span>}
          </span>
        ) : null}
        {carried && !pencil && !rank && (
          <span title={`Carried from ${carried}`} aria-label={`Carried from ${carried}`} className="absolute top-2 left-2.5 text-[11px] leading-none text-mute">
            ↻
          </span>
        )}
      </div>
      {rank ? <RankMark n={rank} struck={done} className="absolute -top-4 -left-4 z-10" /> : null}
      {!stream && meta && (
        <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-mute opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {meta}
          {carried && !pencil ? ` · from ${carried}` : ""}
        </span>
      )}
      {!readOnly && (
        <span className="absolute -top-3 -right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:hidden">
          {strike && (
            <button type="button" onClick={strike} aria-label={done ? `Unstrike "${text}"` : `Strike out "${text}"`} className={`${toolButton} ${done ? "bg-red! text-on-red" : "text-ink"}`}>
              <CheckIcon size={12} />
            </button>
          )}
          {onInk && (
            <button
              type="button"
              onClick={onInk}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={pencil ? `Ink "${text}" into a task` : `Pencil "${text}" into an idea`}
              title={pencil ? "Ink it (make it a task)" : "Pencil it (keep as an idea)"}
              className={`${toolButton} ${pencil ? "text-red-text" : "text-mute"}`}
            >
              {pencil ? <PenIcon size={15} /> : <PencilIcon size={14} />}
            </button>
          )}
          {onWhen && (
            <button type="button" onClick={onWhen} aria-label={`When is "${text}" for?`} title="When (W)" className={`${toolButton} text-mute`}>
              <WhenIcon size={13} />
            </button>
          )}
          <button type="button" onClick={startEdit} aria-label={`Edit "${text}"`} className={`${toolButton} text-[13px] font-semibold`}>
            Aa
          </button>
          <button type="button" onClick={onDelete} aria-label={`Crumple "${text}"`} title="Crumple" className={`${toolButton} text-red-text hover:bg-red-soft`}>
            <CloseIcon size={11} />
          </button>
        </span>
      )}
    </div>
  );
}
