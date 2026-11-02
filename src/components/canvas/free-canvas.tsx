"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { columnOf, layout, limitSpot, savedSpot, settleShift, snap, type Box, type Point, type Size } from "./arrange";
import { autoPanVelocity, HOME, isHome, type View } from "./view";

type Item = { id: string; x: number | null; y: number | null };
export type Placement = { id: string; x: number; y: number };

export type OverlayCtx = {
  boxes: Map<string, Box>;
  zoom: number;
};

/** Things being carried together (a loop and what's inside it), shown shifted by (dx, dy) canvas px. */
export type Offset = { ids: Set<string>; dx: number; dy: number };

/** What the page can ask of the sheet. */
export type CanvasApi = {
  /** Saves these notes moved by (dx, dy) canvas px, pinning the rest where they sit (one arrange). */
  moveBy: (ids: string[], dx: number, dy: number) => void;
};

/** A point on screen as a point on the sheet, in its own units (pan and zoom both undone). */
export function pointOn(sheet: HTMLElement | null, zoom: number, clientX: number, clientY: number): Point {
  const r = sheet?.getBoundingClientRect();
  return { x: (clientX - (r?.left ?? 0)) / zoom, y: (clientY - (r?.top ?? 0)) / zoom };
}

/** Before a bubble is measured. */
const GUESS: Size = { w: 220, h: 110 };
/** Pointer travel (px) before a press becomes a drag, so clicks still edit. */
const DRAG_START = 5;

type Drag = {
  id: string;
  pointer: number;
  /** Where the press was, on screen (for the click-or-drag threshold). */
  fromScreen: Point;
  /** Where the press was, on the canvas: the note moves by how far the pointer has moved from here. */
  fromCanvas: Point;
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
  onPanBy,
  overlay,
  dragEnabled = true,
  offset,
  apiRef,
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
  /** Called every frame while a note is carried near the window's edge: shift the view by this many screen px. */
  onPanBy?: (dx: number, dy: number) => void;
  /**
   * Drawn over the sheet in its own units (it pans and zooms with the notes):
   * gets every bubble's box as it shows now, the dragged one included, and how
   * to turn a saved spot into a canvas point and back. Ink lives here.
   */
  overlay?: (ctx: OverlayCtx) => ReactNode;
  /** Off while another tool is in hand: presses go to the overlay, not to dragging. */
  dragEnabled?: boolean;
  /** A group being carried (by the page): those notes show shifted, and lines tied to them follow. */
  offset?: Offset | null;
  apiRef?: MutableRefObject<CanvasApi | null>;
}) {
  const sheet = useRef<HTMLElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /** The pointer's latest place on screen while a drag is on. */
  const pointerRef = useRef<Point | null>(null);
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
    guides = snap(raw, others).guides;
    // Follows the pointer, then settles on release.
    boxes.set(drag.id, raw);
  }
  if (offset && (offset.dx || offset.dy)) {
    for (const id of offset.ids) {
      const b = boxes.get(id);
      if (b) boxes.set(id, { ...b, x: b.x + offset.dx, y: b.y + offset.dy });
    }
  }

  const bottoms = [...boxes.values()].map((b) => b.y + b.h / 2 + 32).filter(Number.isFinite);
  const height = Math.max(typeof minHeight === "number" ? minHeight : 0, ...bottoms);

  // Handlers read the latest layout from here, so a fast drag never sees a stale render.
  const latest = useRef({ boxes, items, width, lift, onArrange, onPanBy, column, zoom: view.zoom, offset });
  useLayoutEffect(() => {
    latest.current = { boxes, items, width, lift, onArrange, onPanBy, column, zoom: view.zoom, offset };
  });

  // Saved spots are relative to the reading column and the arranged group, not the screen.
  // They are held inside the API's sanity limits, so even a very far drop is saved.
  const saved = (b: Box) => limitSpot(savedSpot(b, latest.current.column, latest.current.lift));

  /** A point on screen as a point on the canvas, read through the sheet's own transform (pan and zoom both). */
  const canvasAt = (clientX: number, clientY: number): Point => {
    const r = sheet.current?.getBoundingClientRect();
    const k = latest.current.zoom;
    return { x: (clientX - (r?.left ?? 0)) / k, y: (clientY - (r?.top ?? 0)) / k };
  };

  // Where the pointer is on the canvas, anywhere in the window (not only over the sheet), for a paste or a dropped file.
  useEffect(() => {
    if (!spotRef) return;
    const track = (e: PointerEvent | DragEvent) => {
      if (!latest.current.width) return;
      const c = canvasAt(e.clientX, e.clientY);
      spotRef.current = saved({ x: c.x, y: c.y, w: 0, h: 0 });
    };
    const leave = () => (spotRef.current = null);
    window.addEventListener("pointermove", track);
    window.addEventListener("dragover", track);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("dragover", track);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
    // The handlers read everything else from `latest`.
  }, [spotRef]);

  /** The bubbles still flowing, pinned where they sit (so moving one never shuffles the others). */
  const pins = (except: string | Set<string>): Placement[] =>
    latest.current.items
      .filter((it) => (typeof except === "string" ? it.id !== except : !except.has(it.id)) && (it.x === null || it.y === null))
      .flatMap((it) => {
        const b = latest.current.boxes.get(it.id);
        return b ? [{ id: it.id, ...saved(b) }] : [];
      });

  /** Saves placements, then re-anchors the group if every bubble is placed now (panning the other way so nothing moves on screen). */
  const commit = (placements: Placement[], arrange: ((p: Placement[]) => void) | undefined) => {
    arrange?.(placements);
    const { items, boxes: now, lift: held, zoom: k, onPanBy: pan } = latest.current;
    const moved = new Map(placements.map((p) => [p.id, p.y]));
    const placed = items.flatMap((it) => {
      const h = now.get(it.id)?.h;
      const y = moved.get(it.id) ?? it.y;
      return h === undefined || y === null ? [] : [{ y, h }];
    });
    const shift = settleShift(placed, held);
    if (shift) {
      // Re-anchor now (not at the next new drop or reload) and pan the same amount, so both agree.
      setHeld(null);
      pan?.(0, -shift * k);
    }
  };

  useLayoutEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      moveBy: (ids, dx, dy) => {
        const { boxes: now, width: w, onArrange: arrange } = latest.current;
        if (!w || !ids.length) return;
        // `now` already shows the carried group shifted; move from where they were.
        const off = latest.current.offset;
        const placements = ids.flatMap((id) => {
          const b = now.get(id);
          if (!b) return [];
          const ox = off?.ids.has(id) ? off.dx : 0;
          const oy = off?.ids.has(id) ? off.dy : 0;
          return [{ id, ...saved({ ...b, x: b.x - ox + dx, y: b.y - oy + dy }) }];
        });
        commit([...placements, ...pins(new Set(ids))], arrange);
      },
    };
  });

  /** Where a drag lets go: snapped against the others. */
  const landing = (d: Drag): Box => {
    const others = [...latest.current.boxes].filter(([id]) => id !== d.id).map(([, b]) => b);
    return snap({ ...d.start, x: d.start.x + d.dx, y: d.start.y + d.dy }, others).box;
  };

  /**
   * The dragged note follows the pointer in canvas units: where the pointer is on the canvas now,
   * minus where the press began. Reading it through the live transform means panning (a wheel,
   * or the edge auto-pan) while carrying keeps the note under the pointer at any zoom.
   */
  const follow = () => {
    const d = dragRef.current;
    const p = pointerRef.current;
    if (!d || !p) return;
    const c = canvasAt(p.x, p.y);
    const moving = d.moving || Math.hypot(p.x - d.fromScreen.x, p.y - d.fromScreen.y) > DRAG_START;
    const next = { ...d, dx: c.x - d.fromCanvas.x, dy: c.y - d.fromCanvas.y, moving };
    dragRef.current = next;
    setDrag(next);
  };

  // The view moved under a drag (edge auto-pan): the note has to catch up with the pointer.
  useLayoutEffect(() => {
    if (dragRef.current?.moving) follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.x, view.y, view.zoom]);

  const begin = (first: Drag, at: Point) => {
    dragRef.current = first;
    pointerRef.current = at;
    setDrag(first);
    // One layout per frame, however fast the pointer reports.
    let queued = 0;
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointer) return;
      pointerRef.current = { x: ev.clientX, y: ev.clientY };
      if (d.moving) ev.preventDefault();
      if (!queued)
        queued = requestAnimationFrame(() => {
          queued = 0;
          follow();
        });
    };
    // Near the window's edge the view drifts, so a note can be carried well past one screen.
    let raf = 0;
    const tick = () => {
      const d = dragRef.current;
      const p = pointerRef.current;
      if (d?.moving && p && latest.current.onPanBy) {
        const v = autoPanVelocity(p, { w: window.innerWidth, h: window.innerHeight });
        if (v.x || v.y) latest.current.onPanBy(v.x, v.y);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || ev.pointerId !== d.pointer) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(queued);
      queued = 0;
      // The last position, exactly where the pointer let go.
      pointerRef.current = { x: ev.clientX, y: ev.clientY };
      follow();
      const dd = dragRef.current ?? d;
      const { width: w, onArrange: arrange } = latest.current;
      if (ev.type === "pointerup" && dd.moving && w > 0) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        commit([{ id: dd.id, ...saved(landing(dd)) }, ...pins(dd.id)], arrange);
      }
      dragRef.current = null;
      pointerRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const down = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onArrange || !dragEnabled || e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest("button:not([data-drag]), a:not([data-drag]), textarea, input")) return;
    const start = boxes.get(id);
    if (!start) return;
    const at = { x: e.clientX, y: e.clientY };
    begin({ id, pointer: e.pointerId, fromScreen: at, fromCanvas: canvasAt(at.x, at.y), start, dx: 0, dy: 0, moving: false }, at);
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
    >
      {guides.x !== undefined && <span aria-hidden="true" className="pointer-events-none absolute w-px bg-red-text/60" style={{ left: guides.x, top: -200000, height: 400000 }} />}
      {guides.y !== undefined && <span aria-hidden="true" className="pointer-events-none absolute h-px bg-red-text/60" style={{ top: guides.y, left: -200000, width: 400000 }} />}
      {overlay?.({ boxes, zoom: view.zoom })}
      {items.map((it) => {
        const b = boxes.get(it.id);
        const dragging = drag?.moving && drag.id === it.id;
        // Carried inside a ring: follows the pointer exactly, no easing (eased, it trails the ring and looks jittery).
        const carried = !!offset && (offset.dx !== 0 || offset.dy !== 0) && offset.ids.has(it.id);
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
                : carried
                  ? "z-0"
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
