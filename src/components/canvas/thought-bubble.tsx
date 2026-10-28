"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckIcon, CloseIcon, PenIcon, PencilIcon, WhenIcon } from "@/components/icons";
import { firstLink, isOnlyYoutube, linkify, youtubeId } from "@/lib/linkify";
import { bubbleStyle, rand } from "./bubble";

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
  /** A pasted or dropped picture: the note becomes a taped photo, the text its caption. */
  image?: string | null;
  /** Earlier days these words were written afresh: earlier copies show through underneath, like pressing hard on a pad. */
  echoes?: string[];
  /**
   * How much a pencil thought matters: 0 barely (small, light), 1 an ordinary
   * thought, 2 and 3 written again (bigger, pressed harder, darker).
   */
  weight?: number;
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

/** A link in a note shows a preview under it: a YouTube video its thumbnail, any other link its site and path. */
function LinkPreview({ text }: { text: string }) {
  const link = firstLink(text);
  if (!link) return null;
  // A press on the preview can still drag the note (data-drag); the browser's own link/image drag is off.
  const stop = { "data-drag": "", draggable: false, onClick: (e: ReactMouseEvent) => e.stopPropagation(), onDoubleClick: (e: ReactMouseEvent) => e.stopPropagation() };
  const video = youtubeId(link.href);
  if (video) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Watch the YouTube video"
        {...stop}
        className="group/video flex w-[260px] max-w-full flex-col gap-1.5 text-left"
      >
        <span className="relative block aspect-video overflow-hidden rounded-xl bg-soft shadow-[inset_0_0_0_1px_var(--line)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a YouTube thumbnail; nothing for next/image to optimise */}
          <img src={`https://i.ytimg.com/vi/${video}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} className="size-full object-cover transition-opacity group-hover/video:opacity-90" />
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-black/55 pl-0.5 text-[10px] text-white backdrop-blur-sm transition-transform group-hover/video:scale-110">▶</span>
          </span>
        </span>
        <span className="px-0.5 text-[11px] tracking-[0.04em] text-mute">YouTube · {link.host}</span>
      </a>
    );
  }
  // Any other link: the site, and where on it, as plain text (nothing is fetched).
  const path = link.path.length > 48 ? `${link.path.slice(0, 47)}…` : link.path;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${link.host}`}
      {...stop}
      className="flex w-[260px] max-w-full flex-col gap-0.5 rounded-lg border border-line bg-soft/60 px-3 py-2 text-left hover:bg-soft"
    >
      <span className="text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">{link.host}</span>
      {path && <span className="truncate font-note text-[16px] text-ink">{path}</span>}
    </a>
  );
}

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
  image,
  echoes,
  weight = 1,
  onWhen,
  onInk,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [dx, setDx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
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
    },
    [],
  );

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
    // Right strikes (pen only), left crumples.
    setDx(Math.max(onDelete ? -SWIPE * 1.4 : 0, Math.min(x, strike ? SWIPE * 1.4 : 0)));
  };
  const onPointerUp = () => {
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

  const drawn = bubbleStyle(shape, false, seed, pencil ? "pencil" : "pen");
  // A picture is taped on like a photo: white, square-ish corners.
  const look: CSSProperties = image
    ? { ...drawn, background: "var(--sheet)", borderRadius: 6, boxShadow: "0 1px 0 var(--line), 0 16px 30px -20px var(--shadow), inset 0 0 0 1px color-mix(in srgb, var(--ink) 12%, transparent)" }
    : drawn;
  // Done stops shouting: the tint goes neutral, the outline stays.
  const settled: CSSProperties = {
    ...look,
    ...(done ? { backgroundColor: "var(--soft)" } : {}),
    ...(target ? { outline: "2px solid color-mix(in srgb, var(--red-text) 55%, transparent)", outlineOffset: 3 } : {}),
  };
  const shapeStyle = stream ? { ...settled, transform: `translateX(${dx}px)` } : settled;
  const pressed = Math.min(2, echoes?.length ?? 0);
  // Pencil with no box: its value shows in the hand itself (size, pressure, darkness).
  const heftStyle: CSSProperties | undefined = pencil && !image ? PENCIL_WEIGHT[Math.max(0, Math.min(3, Math.round(weight)))] : undefined;
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

  const label = `${image ? "Picture: " : pencil ? "Idea: " : ""}${text}${done ? ", done" : ""}${when ? `, ${when}` : ""}`;
  const keys = [
    onEdit && "Enter to edit",
    onWhen && "W for when",
    onDelete && "Delete to crumple",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`group relative ${stream ? "w-full" : "max-w-[300px]"} ${motion}`}>
      {/* Written again and again: earlier copies show through underneath, like pressing hard on a pad. */}
      {!stream &&
        !pencil &&
        Array.from({ length: pressed }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{ ...look, transform: `translate(${(i + 1) * 8}px, ${-(i + 1) * 8}px) rotate(${-(i + 1) * 1.5}deg)`, opacity: 0.24 - i * 0.1 }}
            className="pointer-events-none absolute inset-0"
          />
        ))}
      {/* Pencil has no box to echo: the earlier writing shows through as faint handwriting instead. */}
      {!stream &&
        pencil &&
        !image &&
        Array.from({ length: pressed }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{ ...heftStyle, transform: `translate(${(i + 1) * 5}px, ${-(i + 1) * 5}px) rotate(${-(i + 1) * 1.5}deg)`, opacity: 0.18 - i * 0.07 }}
            className="hand pointer-events-none absolute inset-0 px-2 py-1.5 font-note text-[19px] leading-snug whitespace-pre-wrap sm:text-[20px]"
          >
            {text}
          </span>
        ))}
      {!readOnly && stream && dx !== 0 && (
        <span aria-hidden="true" className={`absolute inset-y-0 flex items-center font-hand text-xl text-red-text ${dx > 0 ? "left-0 pl-3" : "right-0 pr-3"}`}>
          {dx > 0 ? (done ? "unstrike" : "strike") : "crumple"}
        </span>
      )}
      <div
        style={shapeStyle}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        // Selectable from the keyboard: Enter edits, W schedules, Delete crumples.
        tabIndex={readOnly ? undefined : 0}
        data-keys={readOnly ? undefined : ""}
        aria-label={readOnly ? undefined : `${label}. ${keys}.`}
        onKeyDown={(e) => {
          if (readOnly || e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
          const k = e.key.toLowerCase();
          const act = k === "enter" ? startEdit : k === "w" ? onWhen : k === "delete" || k === "backspace" ? onDelete : undefined;
          if (!act) return;
          e.preventDefault();
          act();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`paper-note relative flex flex-col items-start gap-1.5 text-left ${image ? `px-3 pt-3 pb-2.5 ${stream ? "" : "w-[300px]"}` : pencil && !stream ? "px-2 py-1.5" : "px-6 py-5"} transition-[background-color,transform] duration-300 ${done ? "is-done" : ""} ${pencil ? "is-pencil" : ""} ${readOnly ? "" : movable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-text touch-pan-y select-none"}`}
      >
        {image && (
          <>
            <span aria-hidden="true" className="tape pointer-events-none absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-3" />
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from a paste; nothing for next/image to optimise */}
            <img
              src={image}
              alt={text ? `Picture: ${text}` : "Pasted picture"}
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                setZoom(true);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className={`max-h-[240px] w-full cursor-zoom-in rounded-[3px] bg-soft object-contain shadow-[inset_0_0_0_1px_var(--line)] ${done ? "opacity-60 grayscale" : ""}`}
            />
          </>
        )}
        {text && (image || !isOnlyYoutube(text)) ? (
          <span
            style={fresh ? ({ "--write": writeOn(text) } as CSSProperties) : undefined}
            className={`hand font-note leading-snug break-words whitespace-pre-wrap ${image ? "px-1 text-[19px]" : "text-[19px] sm:text-[20px]"} ${fresh ? "write-on" : ""}`}
          >
            <span className="pen-strike" style={heftStyle}>
              <HandText text={text} seed={seed} />
            </span>
          </span>
        ) : (
          image && !readOnly && <span className="px-1 font-note text-[18px] text-mute">add a caption…</span>
        )}
        {!image && <LinkPreview text={text} />}
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
        {carried && !pencil && (
          <span title={`Carried from ${carried}`} aria-label={`Carried from ${carried}`} className="absolute top-2 left-2.5 text-[11px] leading-none text-mute">
            ↻
          </span>
        )}
      </div>
      {!stream && meta && (
        <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-mute opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {meta}
          {carried && !pencil ? ` · from ${carried}` : ""}
          {echoes?.length ? ` · ${ordinal(echoes.length + 1)} time (${[...echoes.slice(-3).map(weekdayShort), "today"].join(", ")})` : ""}
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
      {zoom && image && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={text || "Picture"}
          onClick={() => setZoom(false)}
          onKeyDown={(e) => e.key === "Escape" && setZoom(false)}
          className="scrim-bg fixed inset-0 z-[60] flex cursor-zoom-out flex-col items-center justify-center gap-3 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={image} alt={text || "Pasted picture"} className="max-h-[85dvh] max-w-full rounded-md bg-sheet shadow-[0_30px_60px_-30px_var(--shadow)]" />
          {text && <span className="font-note text-[22px] text-ink">{text}</span>}
          <button type="button" autoFocus onClick={() => setZoom(false)} className="h-10 rounded-xl bg-sheet px-4 text-sm font-medium">
            Close
          </button>
        </div>
      )}
    </div>
  );
}

const weekdayShort = (date: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Pencil written lightly to hard: a passing thought, an ordinary one, one that keeps coming back, one that matters. */
const PENCIL_WEIGHT: CSSProperties[] = [
  { fontSize: "0.95em", fontWeight: 400 },
  { fontSize: "1.2em", fontWeight: 500 },
  { fontSize: "1.45em", fontWeight: 600, color: "color-mix(in srgb, var(--graphite) 40%, var(--ink))" },
  { fontSize: "1.8em", fontWeight: 700, color: "var(--ink)", textShadow: "0 0 0.8px var(--ink)" },
];
