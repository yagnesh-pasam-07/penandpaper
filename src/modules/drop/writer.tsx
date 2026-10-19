"use client";

import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { PenIcon } from "@/components/icons";
import { MAX_THOUGHT } from "./logic";

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
  onDrop,
  onClose,
}: {
  draft: string;
  onDraft: (text: string) => void;
  /** The written text, and where on screen it was written (the note flies from there). */
  onDrop: (text: string, from: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const inset = useKeyboardInset(true);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const send = () => {
    const value = draft.trim().slice(0, MAX_THOUGHT);
    if (!value) return;
    const r = area.current?.getBoundingClientRect();
    onDrop(value, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    area.current?.focus();
  };

  // Keeps Tab inside the writer while it's open.
  const trap = (e: ReactKeyboardEvent) => {
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
        <label className="flex items-start gap-3">
          <span className="mt-2.5 shrink-0 text-red-text">
            <PenIcon size={22} />
          </span>
          <textarea
            ref={area}
            value={draft}
            maxLength={MAX_THOUGHT}
            rows={Math.min(6, Math.max(2, draft.split("\n").length, Math.ceil(draft.length / 44)))}
            aria-label="Thought"
            enterKeyHint="send"
            placeholder="What's on your mind?"
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            className="ruled-line min-h-[72px] flex-1 resize-none bg-transparent font-hand text-[26px] leading-[36px] text-ink outline-none placeholder:font-sans placeholder:text-lg placeholder:text-mute focus-visible:outline-none"
          />
        </label>
        <div className="flex items-center justify-between gap-3 pl-9 text-[13px] text-mute">
          <span className="max-sm:hidden">Enter to drop · Shift+Enter new line · Esc to close</span>
          <span className="sm:hidden">Enter to drop</span>
          <span className="flex items-center gap-1">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 font-medium hover:bg-soft hover:text-ink">
              Close
            </button>
            <button type="button" onClick={send} disabled={!draft.trim()} className="h-9 rounded-lg bg-red px-3.5 font-semibold text-on-red disabled:opacity-40">
              Drop
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
