"use client";

import { useLayoutEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { layout, snap, type Box, type Point, type Size } from "./arrange";

type Item = { id: string; x: number | null; y: number | null };
export type Placement = { id: string; x: number; y: number };
/** An ink line between two items on the sheet (by their ids here). */
export type CanvasLink = { id: string; from: string; to: string; label: string | null; arrow: boolean };

/** What an item needs to know while it renders. */
export type CanvasCtx = {
  /** Something dragged over this item would land on it if let go now. */
  target: boolean;
  /** Starts dragging a card from inside this item (out of an open stack, say). */
  grab: (sub: string) => (e: ReactPointerEvent<HTMLElement>) => void;
};

/** Before a bubble is measured. */
const GUESS: Size = { w: 220, h: 110 };
/** Pointer travel (px) before a press becomes a drag, so clicks still edit. */
const DRAG_START = 5;

/** A line being pulled from an item's edge dot. */
type Pull = { from: string; pointer: number; at: Point; target: string | null };

type Drag = {
  id: string;
  /** Dragged from inside another item, not an item on the sheet itself. */
  sub: boolean;
  pointer: number;
  from: Point;
  start: Box;
  dx: number;
  dy: number;
  moving: boolean;
  /** What it would land on. */
  target: string | null;
};

/**
 * The dotted sheet with bubbles placed anywhere. Drag one and it snaps, like a
 * magnet, to a neighbour's centre or edges (guide lines show it), otherwise to
 * the dots. Let go over another item and it lands on it instead (`onDropOn`),
 * which is how stacks are made. Bubbles nobody has moved flow in rows.
 */
export function FreeCanvas<T extends Item>({
  items,
  label,
  render,
  onArrange,
  canDropOn,
  onDropOn,
  onDetach,
  renderGhost,
  raised,
  links = [],
  onLink,
  selectedLink = null,
  onSelectLink,
  renderLinkTools,
  dim,
  spotRef,
  className = "",
  minHeight = 420,
}: {
  items: T[];
  label: string;
  render: (item: T, ctx: CanvasCtx) => ReactNode;
  /**
   * Called after a drag with the moved bubble, plus every bubble that was still
   * flowing (pinned where it sits, so moving one never shuffles the others).
   * Leave out for a read-only sheet.
   */
  onArrange?: (placements: Placement[]) => void;
  /** Whether the dragged one may land on that item. */
  canDropOn?: (dragged: string, target: string) => boolean;
  onDropOn?: (dragged: string, target: string) => void;
  /** A card dragged out of an item, let go on open sheet: where it landed, plus the flowing ones pinned. */
  onDetach?: (sub: string, at: { x: number; y: number }, pinned: Placement[]) => void;
  /** What follows the pointer while a card from inside an item is dragged. */
  renderGhost?: (sub: string) => ReactNode;
  /** Open in place (a stack): drawn above the rest, and whatever sits below it moves down to make room. */
  raised?: string | null;
  /** Ink lines drawn between items, under them. */
  links?: CanvasLink[];
  /** Pulling a line from an item's edge dot to another item joins them. Leave out and there are no dots. */
  onLink?: (from: string, to: string) => void;
  selectedLink?: string | null;
  /** A click on a line (or on the open sheet, with null). */
  onSelectLink?: (id: string | null) => void;
  /** What shows by the selected line (its toolbar). */
  renderLinkTools?: (link: CanvasLink) => ReactNode;
  /** Faded back (one thread in focus): these items and the lines touching them. */
  dim?: Set<string> | null;
  /** Kept up to date with where the pointer is on the sheet, in saved spots (for a paste or a dropped file). */
  spotRef?: MutableRefObject<{ x: number; y: number } | null>;
  className?: string;
  minHeight?: number;
}) {
  const sheet = useRef<HTMLElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  // Each item's size while not open, so an open one can push the rest down by exactly how much it grew.
  const [closedSizes, setClosedSizes] = useState<Record<string, Size>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  const justDragged = useRef(false);

  // Measure before paint so bubbles don't jump on load; keep measuring as
  // text is edited or the window changes.
  useLayoutEffect(() => {
    const read = () => {
      if (sheet.current) setWidth(sheet.current.clientWidth);
      const next: Record<string, Size> = {};
      nodes.current.forEach((el, id) => (next[id] = { w: el.offsetWidth, h: el.offsetHeight }));
      setSizes((prev) => (same(prev, next) ? prev : next));
      setClosedSizes((prev) => {
        const merged = { ...prev };
        for (const [id, size] of Object.entries(next)) if (id !== raised) merged[id] = size;
        return same(prev, merged) ? prev : merged;
      });
    };
    read();
    const ro = new ResizeObserver(read);
    if (sheet.current) ro.observe(sheet.current);
    nodes.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [items, raised]);

  // The open one is laid out at its closed size; the push-down below accounts for the rest.
  const sizeOf = (id: string) => (id === raised ? (closedSizes[id] ?? sizes[id]) : sizes[id]) ?? GUESS;
  const placedIn = items.map((it) => ({ id: it.id, size: sizeOf(it.id), at: it.x === null || it.y === null ? null : { x: it.x, y: it.y } }));
  // The arranged group's shift holds still until a new drop arrives (which
  // pushes it down to make room), so dragging never makes the sheet jump.
  const flowing = placedIn.filter((it) => !it.at).map((it) => it.id);
  const [held, setHeld] = useState<{ ids: string[]; lift: number } | null>(null);
  const fresh = !held || flowing.some((id) => !held.ids.includes(id));
  const { boxes, lift } = layout(placedIn, width, fresh ? undefined : held.lift);
  if (fresh && width > 0) setHeld({ ids: flowing, lift });
  // Spots as they'd be saved: before anything is pushed out of an open stack's way.
  const base = new Map(boxes);
  const open = raised ? boxes.get(raised) : undefined;
  const grown = raised && open ? (sizes[raised]?.h ?? open.h) - open.h : 0;
  if (raised && open && grown > 0) {
    const bottom = open.y + open.h / 2;
    for (const [id, b] of boxes) {
      if (id !== raised && b.y - b.h / 2 >= bottom - 4) boxes.set(id, { ...b, y: b.y + grown });
    }
    const real = sizes[raised];
    boxes.set(raised, { ...open, w: real?.w ?? open.w, h: open.h + grown, y: open.y - open.h / 2 + (open.h + grown) / 2 });
  }

  let guides: { x?: number; y?: number } = {};
  let ghost: Box | null = null;
  if (drag?.moving) {
    const others = [...boxes].filter(([id]) => id !== drag.id).map(([, b]) => b);
    const raw = { ...drag.start, x: drag.start.x + drag.dx, y: drag.start.y + drag.dy };
    // Over a drop target the magnet lets go: it's landing on that, not lining up.
    if (!drag.target) guides = snap(raw, others, width).guides;
    // Follows the pointer, then settles on release.
    if (drag.sub) ghost = raw;
    else boxes.set(drag.id, raw);
  }

  const bottoms = [...boxes.values()].map((b) => b.y + b.h / 2 + 32).filter(Number.isFinite);
  const height = Math.max(minHeight, ...bottoms);

  // Handlers read the latest layout from here, so a fast drag never sees a stale render.
  const latest = useRef({ boxes, base, items, width, lift, onArrange, canDropOn, onDropOn, onDetach, onLink });
  useLayoutEffect(() => {
    latest.current = { boxes, base, items, width, lift, onArrange, canDropOn, onDropOn, onDetach, onLink };
  });

  // Saved spots are relative to the arranged group, not the screen.
  const saved = (b: Box) => ({ x: b.x / latest.current.width, y: Math.round(b.y - latest.current.lift) });

  /** The bubbles still flowing, pinned where they sit (so moving one never shuffles the others). */
  const pins = (except: string): Placement[] =>
    latest.current.items
      .filter((it) => it.id !== except && (it.x === null || it.y === null))
      .flatMap((it) => {
        const b = latest.current.base.get(it.id);
        return b ? [{ id: it.id, ...saved(b) }] : [];
      });

  /** Where a drag lets go: snapped against the others. */
  const landing = (d: Drag): Box => {
    const others = [...latest.current.boxes].filter(([id]) => id !== d.id).map(([, b]) => b);
    return snap({ ...d.start, x: d.start.x + d.dx, y: d.start.y + d.dy }, others, latest.current.width).box;
  };

  /** The item under the pointer that the dragged one may land on; the top one wins. */
  const hit = (dragged: string, at: Point): string | null => {
    const { boxes: now, items: all, canDropOn: may } = latest.current;
    if (!may) return null;
    for (const it of [...all].reverse()) {
      const b = now.get(it.id);
      if (!b || it.id === dragged || !may(dragged, it.id)) continue;
      if (Math.abs(at.x - b.x) <= b.w / 2 && Math.abs(at.y - b.y) <= b.h / 2) return it.id;
    }
    return null;
  };

  /** The item under a point, any but `except`; the top one wins. */
  const under = (except: string, at: Point): string | null => {
    const { boxes: now, items: all } = latest.current;
    for (const it of [...all].reverse()) {
      const b = now.get(it.id);
      if (b && it.id !== except && Math.abs(at.x - b.x) <= b.w / 2 && Math.abs(at.y - b.y) <= b.h / 2) return it.id;
    }
    return null;
  };

  /** Pulls a line from an item's edge dot; let go over another item to join them. */
  const startPull = (from: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag || pull) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = sheet.current?.getBoundingClientRect();
    if (!rect) return;
    let p: Pull = { from, pointer: e.pointerId, at: { x: e.clientX - rect.left, y: e.clientY - rect.top }, target: null };
    setPull(p);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== p.pointer) return;
      const r = sheet.current?.getBoundingClientRect();
      if (!r) return;
      const at = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      p = { ...p, at, target: under(from, at) };
      setPull(p);
    };
    const stop = (ev: PointerEvent) => {
      if (ev.pointerId !== p.pointer) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      if (ev.type === "pointerup" && p.target) latest.current.onLink?.(p.from, p.target);
      setPull(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const begin = (first: Drag) => {
    let d = first;
    setDrag(d);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      const dx = ev.clientX - d.from.x;
      const dy = ev.clientY - d.from.y;
      const moving = d.moving || Math.hypot(dx, dy) > DRAG_START;
      const rect = sheet.current?.getBoundingClientRect();
      const target = moving && rect ? hit(d.id, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }) : null;
      d = { ...d, dx, dy, moving, target };
      if (d.moving) ev.preventDefault();
      setDrag(d);
    };
    const stop = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      const { width: w, onArrange: arrange, onDropOn: dropOn, onDetach: detach } = latest.current;
      if (ev.type === "pointerup" && d.moving && w > 0) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        if (d.target) dropOn?.(d.id, d.target);
        else if (d.sub) detach?.(d.id, saved(landing(d)), pins(d.id));
        else arrange?.([{ id: d.id, ...saved(landing(d)) }, ...pins(d.id)]);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const down = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onArrange || e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest("button:not([data-drag]), a, textarea, input")) return;
    const start = boxes.get(id);
    if (!start) return;
    begin({ id, sub: false, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, start, dx: 0, dy: 0, moving: false, target: null });
  };

  const grab = (sub: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (!onDetach || e.button !== 0 || drag) return;
    if ((e.target as HTMLElement).closest("button:not([data-drag]), a, textarea, input")) return;
    // The card's own drag, not its stack's.
    e.stopPropagation();
    const rect = sheet.current?.getBoundingClientRect();
    if (!rect) return;
    const card = e.currentTarget.getBoundingClientRect();
    const start = { x: card.left - rect.left + card.width / 2, y: card.top - rect.top + card.height / 2, w: e.currentTarget.offsetWidth, h: e.currentTarget.offsetHeight };
    begin({ id: sub, sub: true, pointer: e.pointerId, from: { x: e.clientX, y: e.clientY }, start, dx: 0, dy: 0, moving: false, target: null });
  };

  return (
    <section
      ref={sheet}
      aria-label={label}
      style={{ height: width ? height : undefined, minHeight }}
      className={`dot-grid relative rounded-[22px] ${className}`}
      onPointerMove={(e) => {
        if (!spotRef || !sheet.current || !width) return;
        const r = sheet.current.getBoundingClientRect();
        spotRef.current = saved({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 });
      }}
      onDragOver={(e) => {
        if (!spotRef || !sheet.current || !width) return;
        const r = sheet.current.getBoundingClientRect();
        spotRef.current = saved({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 });
      }}
      onPointerLeave={() => spotRef && (spotRef.current = null)}
      onClick={(e) => e.target === e.currentTarget && onSelectLink?.(null)}
    >
      {width > 0 && (links.length > 0 || pull) && (
        <InkLines
          links={links}
          boxes={boxes}
          width={width}
          height={height}
          selected={selectedLink}
          dim={dim}
          onSelect={onSelectLink}
          pull={pull ? { from: boxes.get(pull.from), to: pull.target ? boxes.get(pull.target) : undefined, at: pull.at } : null}
        />
      )}
      {guides.x !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-red-text/60" style={{ left: guides.x }} />}
      {guides.y !== undefined && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px bg-red-text/60" style={{ top: guides.y }} />}
      {items.map((it) => {
        const b = boxes.get(it.id);
        const dragging = drag?.moving && !drag.sub && drag.id === it.id;
        const target = (drag?.moving === true && drag.target === it.id) || pull?.target === it.id;
        const faded = dim?.has(it.id);
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
              transform: b ? `translate(${b.x - b.w / 2}px, ${b.y - b.h / 2 - (target ? 3 : 0)}px)${dragging ? " scale(1.04)" : ""}` : undefined,
              visibility: width && b ? undefined : "hidden",
            }}
            className={`group/item absolute top-0 left-0 w-max max-w-[320px] ${faded ? "opacity-30" : ""} ${onArrange ? "touch-none" : ""} ${
              dragging
                ? "z-30 cursor-grabbing opacity-90 drop-shadow-[0_18px_22px_var(--shadow)]"
                : `${raised === it.id ? "z-20" : "z-0"} transition-transform duration-200 ease-out motion-reduce:transition-none`
            }`}
          >
            {render(it, { target, grab })}
            {onLink && !drag?.moving && (!pull || pull.from === it.id) && b && (
              <>
                {EDGES.map((edge) => (
                  <span
                    key={edge}
                    aria-hidden="true"
                    title="Drag to another note to connect"
                    onPointerDown={startPull(it.id)}
                    className={`absolute z-20 size-3.5 -translate-1/2 cursor-crosshair rounded-full border-2 border-red-text bg-sheet opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-red-text max-sm:hidden ${pull?.from === it.id ? "opacity-100" : ""} ${EDGE_SPOT[edge]}`}
                  />
                ))}
              </>
            )}
            {pull?.target === it.id && (
              <span aria-hidden="true" className="pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 font-hand text-[19px] whitespace-nowrap text-red-text">
                let go to connect
              </span>
            )}
          </div>
        );
      })}
      {selectedLink && renderLinkTools && width > 0 && (() => {
        const l = links.find((x) => x.id === selectedLink);
        const a = l && boxes.get(l.from);
        const b = l && boxes.get(l.to);
        if (!l || !a || !b) return null;
        const mid = curve(a, b, l.id).mid;
        return (
          <div className="absolute z-40" style={{ left: mid.x + 24, top: mid.y - 20 }}>
            {renderLinkTools(l)}
          </div>
        );
      })()}
      {ghost && drag && renderGhost && (
        <div
          aria-hidden="true"
          style={{ transform: `translate(${ghost.x - ghost.w / 2}px, ${ghost.y - ghost.h / 2}px) scale(1.04)`, width: ghost.w }}
          className="pointer-events-none absolute top-0 left-0 z-40 opacity-90 drop-shadow-[0_18px_22px_var(--shadow)]"
        >
          {renderGhost(drag.id)}
        </div>
      )}
    </section>
  );
}

function same(a: Record<string, Size>, b: Record<string, Size>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && a[k].w === b[k].w && a[k].h === b[k].h);
}

const EDGES = ["left", "right", "top", "bottom"] as const;
const EDGE_SPOT: Record<(typeof EDGES)[number], string> = {
  left: "top-1/2 left-0",
  right: "top-1/2 left-full",
  top: "top-0 left-1/2",
  bottom: "top-full left-1/2",
};

/** Where the line from a box's centre towards `to` leaves the box's edge (a little outside it). */
function edgePoint(b: Box, to: Point, gap = 6): Point {
  const dx = to.x - b.x;
  const dy = to.y - b.y;
  if (!dx && !dy) return { x: b.x, y: b.y };
  const t = Math.min(dx ? (b.w / 2 + gap) / Math.abs(dx) : Infinity, dy ? (b.h / 2 + gap) / Math.abs(dy) : Infinity);
  return { x: b.x + dx * Math.min(1, t), y: b.y + dy * Math.min(1, t) };
}

/** A small, steady number from an id, so each line bows its own way and keeps it. */
function bow(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 0.5;
}

/** A hand-drawn curve from one box's edge to another's, and the point halfway along it. */
function curve(a: Box, b: Box | Point, id: string): { d: string; mid: Point } {
  const end = "w" in b ? edgePoint(b, a) : b;
  const start = edgePoint(a, end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const k = bow(id);
  const c = { x: (start.x + end.x) / 2 - dy * k, y: (start.y + end.y) / 2 + dx * k };
  return {
    d: `M${start.x.toFixed(1)} ${start.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    mid: { x: (start.x + 2 * c.x + end.x) / 4, y: (start.y + 2 * c.y + end.y) / 4 },
  };
}

/** The ink lines between items, with their words; a click picks one. */
function InkLines({
  links,
  boxes,
  width,
  height,
  selected,
  dim,
  onSelect,
  pull,
}: {
  links: CanvasLink[];
  boxes: Map<string, Box>;
  width: number;
  height: number;
  selected: string | null;
  dim?: Set<string> | null;
  onSelect?: (id: string | null) => void;
  pull: { from?: Box; to?: Box; at: Point } | null;
}) {
  return (
    <svg aria-hidden="true" width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible">
      <defs>
        {["ink", "red"].map((c) => (
          <marker key={c} id={`ink-head-${c}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1.5L8.5 5L1 8.5" fill="none" stroke={c === "red" ? "var(--red-text)" : "var(--ink)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        ))}
      </defs>
      {links.map((l) => {
        const a = boxes.get(l.from);
        const b = boxes.get(l.to);
        if (!a || !b) return null;
        const { d, mid } = curve(a, b, l.id);
        const on = selected === l.id;
        const faded = dim && (dim.has(l.from) || dim.has(l.to));
        return (
          <g key={l.id} opacity={faded ? 0.25 : 1}>
            <path
              d={d}
              fill="none"
              stroke="var(--ink)"
              strokeOpacity={on ? 0 : 0.55}
              strokeWidth="1.7"
              strokeLinecap="round"
              markerEnd={l.arrow && !on ? "url(#ink-head-ink)" : undefined}
            />
            {on && <path d={d} fill="none" stroke="var(--red-text)" strokeWidth="2.2" strokeLinecap="round" markerEnd={l.arrow ? "url(#ink-head-red)" : undefined} />}
            {/* A wide, invisible stroke so the thin line is easy to click. */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth="14"
              className={onSelect ? "pointer-events-auto cursor-pointer" : ""}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(on ? null : l.id);
              }}
            />
            {l.label && (
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(-4 ${mid.x} ${mid.y})`}
                paintOrder="stroke"
                stroke="var(--bg)"
                strokeWidth="6"
                fill={on ? "var(--red-text)" : "var(--mute)"}
                className={`font-hand text-[19px] ${onSelect ? "pointer-events-auto cursor-pointer" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(on ? null : l.id);
                }}
              >
                {l.label}
              </text>
            )}
          </g>
        );
      })}
      {pull?.from && (
        <path d={curve(pull.from, pull.to ?? pull.at, "pull").d} fill="none" stroke="var(--red-text)" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
      )}
    </svg>
  );
}
