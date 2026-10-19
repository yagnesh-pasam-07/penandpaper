"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { linkify } from "@/lib/linkify";
import { bubbleStyle } from "./bubble";

type Props = {
  text: string;
  done: boolean;
  shape: number;
  /** Makes the hand-drawn outline; keep it stable for the same thought (e.g. when it was first dropped). */
  seed?: string;
  /** When it was dropped; on the sheet it shows on hover, in the phone stream under the text. */
  meta?: ReactNode;
  /** The day it was first dropped, when it rolled over: shown as a small mark. */
  carried?: string;
  /** Plays the drop animation (for a thought that just landed). */
  fresh?: boolean;
  /** Full-width card for the phone stream instead of a floating bubble. */
  stream?: boolean;
  readOnly?: boolean;
  /** On a sheet where it can be dragged: shows a grab cursor. */
  movable?: boolean;
  /** Smaller, for the "done today" row. */
  small?: boolean;
  onEdit?: (text: string) => void;
  onToggle?: () => void;
  onDelete?: () => void;
};

const SWIPE = 64;

/** Text with http(s) links made clickable; clicking a link never starts editing. */
export function LinkedText({ text }: { text: string }) {
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
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

/**
 * One thought on paper. Click to edit, double-click (or swipe right on a phone)
 * to strike it out; Delete lives in the edit view and the hover buttons.
 */
export function ThoughtBubble({ text, done, shape, seed, meta, carried, fresh, stream, readOnly, movable, small, onEdit, onToggle, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [dx, setDx] = useState(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
  }, []);

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
    onToggle?.();
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    // Swipe to strike only in the phone stream; on the sheet a touch drags.
    if (readOnly || !stream || e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY, swiped: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const x = e.clientX - s.x;
    if (Math.abs(e.clientY - s.y) > 30) {
      swipe.current = null;
      setDx(0);
      return;
    }
    setDx(Math.max(0, Math.min(x, SWIPE * 1.4)));
  };
  const onPointerUp = () => {
    const s = swipe.current;
    if (s && dx >= SWIPE) {
      s.swiped = true;
      onToggle?.();
      setTimeout(() => (swipe.current = null), 50);
    } else swipe.current = null;
    setDx(0);
  };

  const look = bubbleStyle(shape, false, seed);
  // Done stops shouting: the tint goes neutral, the outline stays.
  const settled = done ? { ...look, background: "var(--soft)" } : look;
  const shapeStyle = stream ? { ...settled, transform: `translateX(${dx}px)` } : settled;

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
          className="w-full resize-none rounded-xl bg-sheet/70 px-3 py-2 font-hand text-[22px] leading-snug outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} className="h-9 rounded-[10px] bg-ink px-3.5 text-sm font-semibold text-bg">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              onToggle?.();
            }}
            className="h-9 rounded-[10px] border border-ink/20 px-3 text-sm font-medium"
          >
            {done ? "Unstrike" : "Strike out"}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              onDelete?.();
            }}
            className="h-9 rounded-[10px] px-3 text-sm font-medium text-red-text hover:bg-red-soft"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative ${stream ? "w-full" : "max-w-[300px]"} ${fresh ? "drop-in" : ""}`}>
      {!readOnly && stream && dx > 0 && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 flex items-center pl-3 font-hand text-xl text-red-text">
          {done ? "unstrike" : "strike"}
        </span>
      )}
      <div
        style={shapeStyle}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex flex-col gap-1.5 transition-[background-color,transform] duration-300 ${small ? "px-4 py-3" : "px-6 py-5"} ${done ? "is-done" : ""} ${stream ? "items-start text-left" : "items-center text-center"} ${readOnly ? "" : movable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-text touch-pan-y select-none"}`}
      >
        <span className={`font-hand leading-snug font-semibold break-words whitespace-pre-wrap ${small ? "text-[18px]" : "text-[22px] sm:text-[24px]"}`}>
          <span className="pen-strike">
            <LinkedText text={text} />
          </span>
        </span>
        {stream && meta && !small && <span className="font-mono text-[11px] text-mute">{meta}</span>}
        {carried && !small && (
          <span title={`Carried from ${carried}`} aria-label={`Carried from ${carried}`} className="absolute top-2 left-2.5 text-[11px] leading-none text-mute">
            ↻
          </span>
        )}
      </div>
      {!stream && meta && !small && (
        <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-mute opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {meta}
          {carried ? ` · from ${carried}` : ""}
        </span>
      )}
      {!readOnly && (
        <span className="absolute -top-3 -right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:hidden">
          <button
            type="button"
            onClick={onToggle}
            aria-label={done ? `Unstrike "${text}"` : `Strike out "${text}"`}
            className={`flex size-8 items-center justify-center rounded-full border border-line shadow-sm ${done ? "bg-red text-on-red" : "bg-sheet text-ink hover:bg-soft"}`}
          >
            <CheckIcon size={12} />
          </button>
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit "${text}"`}
            className="flex size-8 items-center justify-center rounded-full border border-line bg-sheet text-[13px] font-semibold hover:bg-soft"
          >
            Aa
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete "${text}"`}
            className="flex size-8 items-center justify-center rounded-full border border-line bg-sheet text-red-text hover:bg-red-soft"
          >
            <CloseIcon size={11} />
          </button>
        </span>
      )}
    </div>
  );
}
