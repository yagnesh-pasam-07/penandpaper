"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { bubbleStyle } from "./bubble";

export type StackMenuItem = { label: string; onSelect: () => void };

type Props = {
  /** The optional name; unnamed stacks show no label. */
  name: string | null;
  count: number;
  done: number;
  /** The thought on top, shown on the closed pile. */
  top: { text: string; shape: number; seed?: string; done: boolean };
  open: boolean;
  onToggleOpen: () => void;
  /** Something dragged over it would join it: a soft red outline and a slight lift. */
  target?: boolean;
  /** The day it was first made, when it rolled over. */
  carried?: string;
  /** Leave out on a read-only sheet. */
  onRename?: (name: string | null) => void;
  menu?: StackMenuItem[];
  /** The thoughts, fanned out below the pile while it's open. */
  children?: ReactNode;
};

/** The paper edges peeking out behind the top card: shape number, tilt and offset. */
const EDGES = [
  { shape: 3, rotate: 4, x: 6, y: 7 },
  { shape: 1, rotate: -3, x: -5, y: 4 },
];

/**
 * A pile of thoughts, like sticky notes stacked on a desk: the top card with a
 * couple of paper edges behind it, how many are in it, and its name if it has
 * one. Click to fan it out in place; click outside or Esc folds it back.
 */
export function StackCard({ name, count, done, top, open, onToggleOpen, target, carried, onRename, menu, children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const topButton = useRef<HTMLButtonElement>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(name ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
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
        topButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, menuOpen, onToggleOpen]);

  const saveName = () => {
    setNaming(false);
    const next = draft.trim() || null;
    if (next !== name) onRename?.(next);
  };

  const look = bubbleStyle(top.shape, false, top.seed);
  const card = {
    ...(allDone ? { ...look, background: "var(--soft)" } : look),
    ...(target ? { outline: "2px solid color-mix(in srgb, var(--red-text) 55%, transparent)", outlineOffset: 3 } : {}),
  };
  const summary = `${name ? `${name}, ` : ""}${count} thoughts${done ? `, ${done} done` : ""}, ${open ? "expanded" : "collapsed"}`;

  return (
    <div ref={box} role="group" aria-label={summary} className={`group/stack relative flex flex-col items-center ${allDone ? "opacity-70" : ""}`}>
      {/* The label area: the name, or (on hover) a place to give it one. */}
      {naming ? (
        <input
          autoFocus
          value={draft}
          maxLength={60}
          aria-label="Stack name"
          placeholder="Name this stack"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName();
            else if (e.key === "Escape") {
              e.stopPropagation();
              setNaming(false);
              setDraft(name ?? "");
            }
          }}
          className="mb-1.5 h-7 w-44 rounded-lg border border-line bg-sheet px-2 text-center text-[13px] font-medium outline-none"
        />
      ) : name || onRename ? (
        <button
          type="button"
          disabled={!onRename}
          onClick={() => {
            setDraft(name ?? "");
            setNaming(true);
          }}
          className={`mb-1.5 h-7 rounded-lg px-2 text-[13px] font-medium ${name ? "text-ink" : "text-mute opacity-0 group-focus-within/stack:opacity-100 group-hover/stack:opacity-100"} enabled:hover:bg-soft`}
        >
          {name ?? "Name"}
        </button>
      ) : null}

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
          aria-expanded={open}
          aria-label={`${summary}. ${open ? "Close" : "Open"} stack`}
          onClick={onToggleOpen}
          style={card}
          className={`relative flex max-w-[280px] min-w-[150px] flex-col items-center gap-1 px-6 py-5 text-center ${top.done ? "is-done" : ""}`}
        >
          <span className="font-hand text-[22px] leading-snug font-semibold break-words whitespace-pre-wrap sm:text-[24px]">
            <span className="pen-strike">{top.text}</span>
          </span>
          {carried && (
            <span title={`Carried from ${carried}`} className="absolute top-2 left-2.5 text-[11px] leading-none text-mute">
              ↻
            </span>
          )}
          <span className="absolute -right-2 -bottom-2 flex h-6 min-w-6 items-center justify-center rounded-full border border-line bg-sheet px-1.5 text-[12px] font-semibold text-ink">
            {count}
          </span>
        </button>

        {menu && menu.length > 0 && (
          <span className="absolute -top-3 -right-2 opacity-0 transition-opacity group-focus-within/stack:opacity-100 group-hover/stack:opacity-100 max-sm:hidden">
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
        )}
      </div>

      {open && (
        <div className="absolute top-full left-1/2 z-30 mt-3 flex w-[300px] -translate-x-1/2 flex-col gap-2.5 rounded-[20px] border border-line bg-bg/95 p-2.5 shadow-[0_24px_50px_-24px_var(--shadow)] backdrop-blur-sm">
          {children}
        </div>
      )}
    </div>
  );
}
