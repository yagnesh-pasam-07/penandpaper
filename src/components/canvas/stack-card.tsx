"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CloseIcon, PencilIcon, WhenIcon } from "@/components/icons";
import { bubbleStyle } from "./bubble";
import { RankMark } from "./rank-mark";
import { HandText } from "./thought-bubble";

export type StackMenuItem = { label: string; onSelect: () => void };

type Props = {
  /** The optional name; an unnamed stack shows its top thought instead. */
  name: string | null;
  count: number;
  done: number;
  /** The thought on top. */
  top: { text: string; shape: number; seed?: string; done: boolean };
  /** The first few thoughts, for the peek on hover. */
  peek: string[];
  open: boolean;
  onToggleOpen: () => void;
  /** Something dragged over it would join it: a soft red outline and a slight lift. */
  target?: boolean;
  /** The day it was first made, when it rolled over. */
  carried?: string;
  /** Scheduled for, as a short label ("Sat"). */
  when?: string;
  /** Leave out on a read-only sheet. */
  onRename?: (name: string | null) => void;
  onWhen?: () => void;
  menu?: StackMenuItem[];
  /** Plays on its way out. */
  leaving?: "crumple" | "fold" | null;
  /** Numbered as a whole. */
  rank?: number | null;
  /** The thoughts as compact rows, shown while it's open. */
  children?: ReactNode;
};

/** The paper edges peeking out behind the top card: shape number, tilt and offset. */
const EDGES = [
  { shape: 3, rotate: 4, x: 6, y: 7 },
  { shape: 1, rotate: -3, x: -5, y: 4 },
];

const chip = "inline-flex h-6 items-center gap-1 rounded-full border border-line bg-sheet/80 px-2 text-[11px] font-medium text-mute";

/**
 * A pile of thoughts, like sticky notes stacked on a desk. Closed: the top
 * card (its name, or the top thought) with a couple of paper edges behind and
 * a count; hovering peeks at the first few. Open: it expands in place into a
 * card with a header and one compact row per thought, pushing what's below it
 * down. Esc, a click outside, or the header folds it back.
 */
export function StackCard({ name, count, done, top, peek, open, onToggleOpen, target, carried, when, onRename, onWhen, menu, leaving, rank, children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const topButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(name ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allDone = done === count;

  // Open: a click anywhere else, or Esc, folds it back.
  useEffect(() => {
    if (!open && !menuOpen) return;
    const away = (e: PointerEvent) => {
      if (box.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
      if (open) onToggleOpen();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      if (open) {
        onToggleOpen();
        requestAnimationFrame(() => topButton.current?.focus());
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, menuOpen, onToggleOpen]);

  useEffect(
    () => () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    },
    [],
  );

  const saveName = () => {
    const next = draft.trim() || null;
    if (next !== name) onRename?.(next);
  };

  const look = bubbleStyle(top.shape, false, top.seed);
  const card = {
    ...look,
    ...(allDone ? { backgroundColor: "var(--soft)" } : {}),
    ...(target ? { outline: "2px solid color-mix(in srgb, var(--red-text) 55%, transparent)", outlineOffset: 3 } : {}),
  };
  const summary = `${rank ? `Number ${rank}: ` : ""}${name ? `${name}, ` : ""}${count} thoughts${done ? `, ${done} done` : ""}${when ? `, ${when}` : ""}, ${open ? "expanded" : "collapsed"}`;
  const motion = leaving === "crumple" ? "crumple-away" : leaving === "fold" ? "fold-away" : "";

  const menuButton = menu && menu.length > 0 && (
    <span className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Stack actions"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex size-8 items-center justify-center rounded-full border border-line bg-sheet text-[15px] leading-none font-semibold shadow-sm hover:bg-soft"
      >
        ⋯
      </button>
      {menuOpen && (
        <span role="menu" className="absolute top-9 right-0 z-30 flex w-44 flex-col rounded-xl border border-line bg-sheet p-1 shadow-[0_18px_40px_-20px_var(--shadow)]">
          {menu.map((m) => (
            <button
              key={m.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                m.onSelect();
              }}
              className="rounded-lg px-3 py-2 text-left text-sm hover:bg-soft"
            >
              {m.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );

  if (open) {
    return (
      <div ref={box} role="group" aria-label={summary} style={{ ...card, transform: "none", borderRadius: 22 }} className={`paper-note flex w-[320px] max-w-full flex-col gap-2 p-2.5 ${motion}`}>
        {/* The header: clicking its empty part folds the stack back; dragging it moves the stack. */}
        <div onClick={(e) => e.target === e.currentTarget && onToggleOpen()} className="flex cursor-grab items-center gap-1.5 pl-1.5 active:cursor-grabbing">
          {rank ? <RankMark n={rank} struck={allDone} className="-ml-1" /> : null}
          {onRename ? (
            <input
              value={draft}
              maxLength={60}
              aria-label="Stack name"
              placeholder="Name this stack"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") {
                  e.stopPropagation();
                  setDraft(name ?? "");
                  e.currentTarget.blur();
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-mute focus:bg-sheet/70"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate px-1.5 text-[15px] font-semibold">{name ?? `Stack of ${count}`}</span>
          )}
          <span className="text-[12px] font-semibold text-mute">{count}</span>
          {onWhen ? (
            <button type="button" onClick={onWhen} aria-label={when ? `Scheduled ${when}. Change when` : "When is this stack for?"} className={`${chip} hover:text-ink`}>
              <WhenIcon size={10} />
              {when ?? "when"}
            </button>
          ) : (
            when && <span className={chip}>{when}</span>
          )}
          {menuButton}
          <button
            ref={topButton}
            type="button"
            onClick={onToggleOpen}
            aria-expanded
            aria-label="Fold the stack back"
            className="flex size-8 items-center justify-center rounded-full text-mute hover:bg-sheet/70 hover:text-ink"
          >
            <CloseIcon size={11} />
          </button>
        </div>
        <ul className="flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-0.5">{children}</ul>
      </div>
    );
  }

  return (
    <div
      ref={box}
      role="group"
      aria-label={summary}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        peekTimer.current = setTimeout(() => setPeeking(true), 420);
      }}
      onPointerLeave={() => {
        if (peekTimer.current) clearTimeout(peekTimer.current);
        setPeeking(false);
      }}
      className={`group/stack relative flex flex-col items-center ${allDone ? "opacity-70" : ""} ${motion}`}
    >
      <div className="relative">
        {EDGES.slice(0, count > 2 ? 2 : 1).map((e, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{ ...bubbleStyle(e.shape, false, `${top.seed}-${i}`), transform: `translate(${e.x}px, ${e.y}px) rotate(${e.rotate}deg)` }}
            className="absolute inset-0 opacity-80"
          />
        ))}
        <button
          ref={topButton}
          type="button"
          // The pile itself can be dragged around the sheet.
          data-drag=""
          aria-expanded={false}
          aria-label={`${summary}. Open stack`}
          onClick={() => {
            setPeeking(false);
            onToggleOpen();
          }}
          style={card}
          className="paper-note relative flex max-w-[280px] min-w-[150px] flex-col items-start gap-1 px-6 py-5 text-left"
        >
          <span className="hand font-note text-[19px] leading-snug break-words whitespace-pre-wrap sm:text-[20px]">
            <HandText text={name ?? top.text} seed={top.seed} />
          </span>
          {when && <span className={chip}>{when}</span>}
          {carried && !rank && (
            <span title={`Carried from ${carried}`} className="absolute top-2 left-2.5 text-[11px] leading-none text-mute">
              ↻
            </span>
          )}
          <span className="absolute -right-2 -bottom-2 flex h-6 min-w-6 items-center justify-center rounded-full border border-line bg-sheet px-1.5 text-[12px] font-semibold text-ink">{count}</span>
        </button>
        {rank ? <RankMark n={rank} struck={allDone} className="absolute -top-4 -left-4 z-10" /> : null}
        {menuButton && (
          <span className="absolute -top-3 -right-2 opacity-0 transition-opacity group-focus-within/stack:opacity-100 group-hover/stack:opacity-100 max-sm:hidden">{menuButton}</span>
        )}
      </div>
      {peeking && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-full left-1/2 z-30 mt-3 flex w-56 -translate-x-1/2 flex-col gap-1 rounded-2xl border border-line bg-sheet px-3.5 py-3 shadow-[0_18px_40px_-20px_var(--shadow)]"
        >
          {peek.slice(0, 3).map((t, i) => (
            <span key={i} className="truncate font-note text-[16px] leading-tight">
              {t}
            </span>
          ))}
          {count > 3 && <span className="text-[12px] text-mute">+{count - 3} more</span>}
        </span>
      )}
    </div>
  );
}

/**
 * One thought inside an open stack: a single line of handwriting (full text on
 * hover or focus), a circle to strike it, its time on hover. Click the words
 * to edit; drag the row out of the stack to loosen it.
 */
export function StackRow({
  text,
  done,
  pencil,
  meta,
  when,
  readOnly,
  onToggle,
  onEdit,
  onDelete,
  onInk,
  onWhen,
  onStackWith,
  onGrab,
}: {
  text: string;
  done: boolean;
  pencil?: boolean;
  meta?: string;
  when?: string;
  readOnly?: boolean;
  onToggle?: () => void;
  onEdit?: (text: string) => void;
  onDelete?: () => void;
  onInk?: () => void;
  onWhen?: () => void;
  onStackWith?: () => void;
  onGrab?: (e: ReactPointerEvent<HTMLElement>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const save = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== text) onEdit?.(next);
  };
  return (
    <li
      onPointerDown={readOnly ? undefined : onGrab}
      className={`group/row flex min-h-11 items-center gap-2 rounded-xl px-1.5 ${done ? "is-done" : ""} ${pencil ? "is-pencil" : ""} ${readOnly ? "" : "cursor-grab touch-none hover:bg-sheet/60 active:cursor-grabbing"}`}
    >
      {pencil ? (
        <button
          type="button"
          disabled={readOnly || !onInk}
          onClick={onInk}
          aria-label={`Ink "${text}" into a task`}
          title="An idea · ink it"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-graphite enabled:hover:bg-sheet"
        >
          <PencilIcon size={13} />
        </button>
      ) : (
        <button type="button" disabled={readOnly} onClick={onToggle} aria-label={done ? `Unstrike "${text}"` : `Strike out "${text}"`} aria-pressed={done} className="flex size-7 shrink-0 items-center justify-center rounded-full">
          <span className={`block size-[18px] rounded-full border-2 ${done ? "border-red bg-red" : "border-red-text/70"}`} />
        </button>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          aria-label="Edit thought"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(text);
              setEditing(false);
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg bg-sheet px-2 font-note text-[16px] outline-none"
        />
      ) : (
        <button
          type="button"
          // Dragging starts from the words too.
          data-drag=""
          onClick={() => {
            if (readOnly || !onEdit) return;
            setDraft(text);
            setEditing(true);
          }}
          onKeyDown={(e) => {
            const k = e.key.toLowerCase();
            const act = k === "s" ? onStackWith : k === "w" ? onWhen : k === "delete" || k === "backspace" ? onDelete : undefined;
            if (!act || readOnly) return;
            e.preventDefault();
            act();
          }}
          title={text}
          className="hand min-w-0 flex-1 truncate py-1.5 text-left font-note text-[16px] leading-tight"
        >
          <span className="pen-strike">{text}</span>
        </button>
      )}
      {when && <span className="shrink-0 text-[11px] font-medium text-mute">{when}</span>}
      {meta && !editing && <span className="shrink-0 font-mono text-[10px] text-mute opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100">{meta}</span>}
      {!readOnly && onDelete && !editing && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Crumple "${text}"`}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-mute opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:text-red-text max-sm:opacity-100"
        >
          <CloseIcon size={10} />
        </button>
      )}
    </li>
  );
}
