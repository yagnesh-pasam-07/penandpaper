"use client";

import { useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { columnOf, layout, savedSpot, snap, type Box, type Point, type Size } from "./arrange";
import { HOME, isHome, type View } from "./view";

type Item = { id: string; x: number | null; y: number | null };
export type Placement = { id: string; x: number; y: number };

/** Before a bubble is measured. */
const GUESS: Size = { w: 220, h: 110 };
/** Pointer travel (px) before a press becomes a drag, so clicks still edit. */
const DRAG_START = 5;

type Drag = {
  id: string;
  pointer: number;
  from: Point;
  start: Box;
  dx: number;
  dy: number;
  moving: boolean;
};

/**
 * The sheet with bubbles placed anywhere. Drag one and it snaps, like a
 * magnet, to a neighbour's centre or edges (guide lines show it), otherwise to
 * the dots. Bubbles nobody has moved flow in rows.
 */
export function FreeCanvas<T extends Item>({
  items,
  label,
  render,
  onArrange,
  spotRef,
  className = "",
  minHeight = 420,
  bare = false,
  view = HOME,
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
  /** Kept up to date with where the pointer is on the sheet, in saved spots (for a paste or a dropped file). */
  spotRef?: MutableRefObject<{ x: number; y: number } | null>;
  className?: string;
  minHeight?: number | string;
  /**
   * No surface of its own: the page behind it is the canvas, as wide as the
   * page, and bubbles can go anywhere on it. The reading column is centred in
   * it and new drops flow there; saved spots are shares of that column.
   */
  bare?: boolean;
  /**
   * Zoom and pan of the whole sheet (a transform, so layout and saved spots
   * stay in canvas units): pointer travel is divided by the zoom to match.
   */
  view?: View;
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

  const placedIn = items.map((it) => ({ id: it.id, size: sizes[it.id] ?? GUESS, at: it.x === null || it.y === null ? null : { x: it.x, y: it.y } }));
  // The arranged group's shift holds still until a new drop arrives (which
  // pushes it down to make room), so dragging never makes the sheet jump.
  const flowing = placedIn.filter((it) => !it.at).map((it) => it.id);
  // A new drop, or a dropped note changing height (a preview taking its place), makes room again.
  const heights = flowing.map((id) => `${id}:${sizes[id]?.h ?? 0}`).join();
  const [held, setHeld] = useState<{ ids: string[]; heights: string; lift: number } | null>(null);
  const fresh = !held || held.heights !== heights || flowing.some((id) => !held.ids.includes(id));
  const column = columnOf(width, bare);
  const { boxes, lift } = layout(placedIn, width, fresh ? undefined : held.lift, column);
  if (fresh && width > 0) setHeld({ ids: flowing, heights, lift });
  let guides: { x?: number; y?: number } = {};
  if (drag?.moving) {
    const others = [...boxes].filter(([id]) => id !== drag.id).map(([, b]) => b);
    const raw = { ...drag.start, x: drag.start.x + drag.dx, y: drag.start.y + drag.dy };
    guides = snap(raw, others, width).guides;
    // Follows the pointer, then settles on release.
    boxes.set(drag.id, raw);
  }

  const bottoms = [...boxes.values()].map((b) => b.y + b.h / 2 + 32).filter(Number.isFinite);
  const height = Math.max(typeof minHeight === "number" ? minHeight : 0, ...bottoms);

  // Handlers read the latest layout from here, so a fast drag never sees a stale render.
  const latest = useRef({ boxes, items, width, lift, onArrange, column, zoom: view.zoom });
  useLayoutEffect(() => {
    latest.current = { boxes, items, width, lift, onArrange, column, zoom: view.zoom };
  });

  // Saved spots are relative to the reading column and the arranged group, not the screen.
  const saved = (b: Box) => savedSpot(b, latest.current.column, latest.current.lift);

  /** The bubbles still flowing, pinned where they sit (so moving one never shuffles the others). */
  const pins = (except: string): Placement[] =>
    latest.current.items
      .filter((it) => it.id !== except && (it.x === null || it.y === null))
      .flatMap((it) => {
        const b = latest.current.boxes.get(it.id);
        return b ? [{ id: it.id, ...saved(b) }] : [];
      });

  /** Where a drag lets go: snapped against the others. */
  const landing = (d: Drag): Box => {
    const others = [...latest.current.boxes].filter(([id]) => id !== d.id).map(([, b]) => b);
    return snap({ ...d.start, x: d.start.x + d.dx, y: d.start.y + d.dy }, others, latest.current.width).box;
  };

  const begin = (first: Drag) => {
    let d = first;
    setDrag(d);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      // Pointer travel is on screen; the note moves in canvas units.
      const k = latest.current.zoom;
      const dx = (ev.clientX - d.from.x) / k;
      const dy = (ev.clientY - d.from.y) / k;
      const moving = d.moving || Math.hypot(dx * k, dy * k) > DRAG_START;
      d = { ...d, dx, dy, moving };
      if (d.moving) ev.preventDefault();
      setDrag(d);
    };
    const stop = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      const { width: w, onArrange: arrange } = latest.current;
      if (ev.type === "pointerup" && d.moving && w > 0) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        arrange?.([{ id: d.id, ...saved(landing(d)) }, ...pins(d.id)]);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const down = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onArrange || e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest("button:not([data-drag]), a:not([data-drag]), textarea, input")) return;
    const start = boxes.get(id);
    if (!start) return;
    begin({ id, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, start, dx: 0, dy: 0, moving: false });
  };

  return (
    <section
      ref={sheet}
      aria-label={label}
      style={{
        height: width ? height : undefined,
        minHeight,
        ...(isHome(view) ? {} : { transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0" }),
      }}
      className={`${bare ? "" : "canvas-surface rounded-[22px]"} relative ${className}`}
      onPointerMove={(e) => {
        if (!spotRef || !sheet.current || !width) return;
        const r = sheet.current.getBoundingClientRect();
        spotRef.current = saved({ x: (e.clientX - r.left) / view.zoom, y: (e.clientY - r.top) / view.zoom, w: 0, h: 0 });
      }}
      onDragOver={(e) => {
        if (!spotRef || !sheet.current || !width) return;
        const r = sheet.current.getBoundingClientRect();
        spotRef.current = saved({ x: (e.clientX - r.left) / view.zoom, y: (e.clientY - r.top) / view.zoom, w: 0, h: 0 });
      }}
      onPointerLeave={() => spotRef && (spotRef.current = null)}
    >
      {guides.x !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-red-text/60" style={{ left: guides.x }} />}
      {guides.y !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px bg-red-text/60" style={{ top: guides.y }} />}
      {items.map((it) => {
        const b = boxes.get(it.id);
        const dragging = drag?.moving && drag.id === it.id;
        return (
          <div
            key={it.id}
            data-note=""
            ref={(el) => {
              if (el) nodes.current.set(it.id, el);
              else nodes.current.delete(it.id);
            }}
            onPointerDown={down(it.id)}
            // A drag ends in a click; don't let it open the editor.
            onClickCapture={(e) => {
              if (justDragged.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            style={{
              transform: b ? `translate(${b.x - b.w / 2}px, ${b.y - b.h / 2}px)${dragging ? " scale(1.04)" : ""}` : undefined,
              visibility: width && b ? undefined : "hidden",
            }}
            className={`group/item absolute top-0 left-0 w-max max-w-[320px] ${onArrange ? "touch-none" : ""} ${
              dragging
                ? // Lifted off the sheet: a pencil thought rides on a scrap of white paper.
                  "z-30 cursor-grabbing opacity-95 drop-shadow-[0_18px_22px_var(--shadow)] [&_.is-pencil]:rounded-md! [&_.is-pencil]:bg-sheet!"
                : `z-0 transition-transform duration-200 ease-out motion-reduce:transition-none`
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
