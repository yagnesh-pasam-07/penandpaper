"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { linkify } from "@/lib/linkify";
import { bubbleStyle } from "./bubble";

type Props = {
  text: string;
  done: boolean;
  shape: number;
  /** Small line under the text: time dropped, "from Thu", … */
  meta?: ReactNode;
  /** Plays the drop animation (for a thought that just landed). */
  fresh?: boolean;
  /** Full-width card for the phone stream instead of a floating bubble. */
  stream?: boolean;
  readOnly?: boolean;
  /** On a sheet where it can be dragged: shows a grab cursor. */
  movable?: boolean;
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

/** Burst lines, by angle. */
const BURST = [-70, -35, 0, 35, 70, 110, 145];

/**
 * A pen scribble over the whole thought, like crossing out a line on paper.
 * `draw` animates it in (just struck) with a little ink burst at the end;
 * otherwise it's simply there.
 */
function Scribble({ draw }: { draw: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={`scribble absolute inset-x-[6%] top-[18%] h-[64%] w-[88%] overflow-visible ${draw ? "draw" : ""}`}>
        <path pathLength={1} vectorEffect="non-scaling-stroke" strokeWidth={2.6} d="M2 21C14 15 26 25 39 19S63 13 76 20 92 22 98 18" />
        <path pathLength={1} vectorEffect="non-scaling-stroke" strokeWidth={2.2} d="M97 24C85 27 72 21 58 26S33 30 20 24 6 25 3 27" />
        <path pathLength={1} vectorEffect="non-scaling-stroke" strokeWidth={1.8} d="M8 31C30 22 62 14 94 9" />
      </svg>
      {draw && (
        <span className="ink-burst absolute top-[30%] right-[5%]">
          {BURST.map((a) => (
            <i key={a} style={{ ["--a" as string]: `${a}deg` }} />
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * One thought on paper. Click to edit, double-click (or swipe right on a phone)
 * to strike it out; Delete lives in the edit view and the hover buttons.
 */
export function ThoughtBubble({ text, done, shape, meta, fresh, stream, readOnly, movable, onEdit, onToggle, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [dx, setDx] = useState(0);
  // Struck in this session: draw the scribble in instead of just showing it.
  const [justStruck, setJustStruck] = useState(false);
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

  const toggle = () => {
    setJustStruck(!done);
    onToggle?.();
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
    toggle();
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
      toggle();
      setTimeout(() => (swipe.current = null), 50);
    } else swipe.current = null;
    setDx(0);
  };

  const look = bubbleStyle(shape);
  const shapeStyle = stream ? { ...look, borderRadius: "18px", transform: `translateX(${dx}px)` } : look;

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
              toggle();
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
        className={`relative flex flex-col gap-1.5 px-6 py-5 transition-[opacity,transform] ${stream ? "items-start text-left" : "items-center text-center"} ${readOnly ? "" : movable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-text touch-pan-y select-none"} ${done ? "opacity-75" : ""}`}
      >
        <span className={`font-hand text-[22px] leading-snug font-semibold break-words whitespace-pre-wrap sm:text-[24px] ${done ? "text-mute" : ""}`}>
          <LinkedText text={text} />
        </span>
        {meta && <span className="font-mono text-[11px] text-mute">{meta}</span>}
        {done && <Scribble draw={justStruck} />}
      </div>
      {!readOnly && (
        <span className="absolute -top-3 -right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:hidden">
          <button
            type="button"
            onClick={toggle}
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
