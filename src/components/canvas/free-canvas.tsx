"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { layout, snap, type Box, type Point, type Size } from "./arrange";

type Item = { id: string; x: number | null; y: number | null };
export type Placement = { id: string; x: number; y: number };

/** Before a bubble is measured. */
const GUESS: Size = { w: 220, h: 110 };
/** Pointer travel (px) before a press becomes a drag, so clicks still edit. */
const DRAG_START = 5;

type Drag = { id: string; pointer: number; from: Point; start: Box; dx: number; dy: number; moving: boolean };

/**
 * The dotted sheet with bubbles placed anywhere. Drag one and it snaps, like a
 * magnet, to a neighbour's centre or edges (guide lines show it), otherwise to
 * the dots. Bubbles nobody has moved flow in rows around the moved ones.
 */
export function FreeCanvas<T extends Item>({
  items,
  label,
  render,
  onArrange,
  className = "",
  minHeight = 420,
}: {
  items: T[];
  label: string;
  render: (item: T) => ReactNode;
  /**
   * Called after a drag with the moved bubble, plus every bubble that was still
   * flowing (pinned where it sits, so moving one never shuffles the others).
   * Leave out for a read-only sheet.
   */
  onArrange?: (placements: Placement[]) => void;
  className?: string;
  minHeight?: number;
}) {
  const sheet = useRef<HTMLElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const justDragged = useRef(false);

  // Measure before paint so bubbles don't jump on load; keep measuring as
  // text is edited or the window changes.
  useLayoutEffect(() => {
    const read = () => {
      if (sheet.current) setWidth(sheet.current.clientWidth);
      const next: Record<string, Size> = {};
      nodes.current.forEach((el, id) => (next[id] = { w: el.offsetWidth, h: el.offsetHeight }));
      setSizes((prev) => (same(prev, next) ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    if (sheet.current) ro.observe(sheet.current);
    nodes.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [items]);

  const boxes = layout(
    items.map((it) => ({ id: it.id, size: sizes[it.id] ?? GUESS, at: it.x === null || it.y === null ? null : { x: it.x, y: it.y } })),
    width,
  );

  let guides: { x?: number; y?: number } = {};
  if (drag?.moving) {
    const others = [...boxes].filter(([id]) => id !== drag.id).map(([, b]) => b);
    const raw = { ...drag.start, x: drag.start.x + drag.dx, y: drag.start.y + drag.dy };
    const snapped = snap(raw, others, width);
    guides = snapped.guides;
    // Follows the pointer; the magnet shows as guide lines, then settles on release.
    boxes.set(drag.id, raw);
  }

  const height = Math.max(minHeight, ...[...boxes.values()].map((b) => b.y + b.h / 2 + 32));

  // Handlers read the latest layout from here, so a fast drag never sees a stale render.
  const latest = useRef({ boxes, items, width, onArrange });
  useLayoutEffect(() => {
    latest.current = { boxes, items, width, onArrange };
  });

  /** Where a release would settle the drag, and the bubbles that were still flowing, pinned in place. */
  const settle = (d: Drag): Placement[] => {
    const { boxes: now, items: all, width: w } = latest.current;
    const others = [...now].filter(([id]) => id !== d.id).map(([, b]) => b);
    const { box } = snap({ ...d.start, x: d.start.x + d.dx, y: d.start.y + d.dy }, others, w);
    const pinned = all
      .filter((it) => it.id !== d.id && (it.x === null || it.y === null))
      .flatMap((it) => {
        const b = now.get(it.id);
        return b ? [{ id: it.id, x: b.x / w, y: Math.round(b.y) }] : [];
      });
    return [{ id: d.id, x: box.x / w, y: Math.round(box.y) }, ...pinned];
  };

  const down = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onArrange || e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest("button, a, textarea, input")) return;
    const start = boxes.get(id);
    if (!start) return;
    let d: Drag = { id, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, start, dx: 0, dy: 0, moving: false };
    setDrag(d);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      const dx = ev.clientX - d.from.x;
      const dy = ev.clientY - d.from.y;
      d = { ...d, dx, dy, moving: d.moving || Math.hypot(dx, dy) > DRAG_START };
      if (d.moving) ev.preventDefault();
      setDrag(d);
    };
    const stop = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      if (ev.type === "pointerup" && d.moving && latest.current.width > 0) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        latest.current.onArrange?.(settle(d));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <section
      ref={sheet}
      aria-label={label}
      style={{ height: width ? height : undefined, minHeight }}
      className={`dot-grid relative rounded-[22px] ${className}`}
    >
      {guides.x !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-red-text/60" style={{ left: guides.x }} />}
      {guides.y !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px bg-red-text/60" style={{ top: guides.y }} />}
      {items.map((it) => {
        const b = boxes.get(it.id);
        const dragging = drag?.moving && drag.id === it.id;
        return (
          <div
            key={it.id}
            ref={(el) => {
              if (el) nodes.current.set(it.id, el);
              else nodes.current.delete(it.id);
            }}
            onPointerDown={down(it.id)}
            // A drag ends in a click; don't let it open the editor.
            onClickCapture={(e) => {
              if (justDragged.current) e.stopPropagation();
            }}
            style={{
              transform: b ? `translate(${b.x - b.w / 2}px, ${b.y - b.h / 2}px)${dragging ? " scale(1.04)" : ""}` : undefined,
              visibility: width && b ? undefined : "hidden",
            }}
            className={`absolute top-0 left-0 w-max max-w-[320px] ${onArrange ? "touch-none" : ""} ${
              dragging ? "z-30 cursor-grabbing drop-shadow-[0_18px_22px_var(--shadow)]" : "z-0 transition-transform duration-200 ease-out"
            }`}
          >
            {render(it)}
          </div>
        );
      })}
    </section>
  );
}

function same(a: Record<string, Size>, b: Record<string, Size>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && a[k].w === b[k].w && a[k].h === b[k].h);
}
