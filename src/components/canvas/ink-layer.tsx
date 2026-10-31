"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Box, Point } from "./arrange";
import { pointOn } from "./free-canvas";
import { endAngle, hitThing, nearStroke, pathOf, placeStroke, round, thin, type Pt } from "./ink";

export type InkStroke = { id: string; points: Pt[]; fromId: string | null; toId: string | null };

/** Far enough that the SVG never clips a line drawn way off the first screen. */
const FAR = 200_000;

/**
 * Ink on the sheet: every line and connector, drawn in the sheet's own units so
 * it pans and zooms with the notes. With the Draw tool a press puts ink down;
 * a line that starts on one thing and ends on another ties them (and follows
 * them when they move). With the eraser, a press or a rub removes lines.
 * Otherwise it lets every press through to the notes.
 */
export function InkLayer({
  strokes,
  boxes,
  zoom,
  mode,
  fresh,
  onDraw,
  onErase,
}: {
  strokes: InkStroke[];
  boxes: Map<string, Box>;
  zoom: number;
  mode: "draw" | "erase" | null;
  /** Just drawn: the ink draws on. */
  fresh: Set<string>;
  onDraw: (stroke: InkStroke) => void;
  onErase: (id: string) => void;
}) {
  const [live, setLive] = useState<Pt[] | null>(null);
  const [hover, setHover] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const pointer = useRef<number | null>(null);
  const pts = useRef<Pt[]>([]);
  const from = useRef<string | null>(null);
  const erased = useRef(new Set<string>());
  const svg = useRef<SVGSVGElement>(null);
  // The layer lives inside the sheet, so the sheet is its parent.
  const canvasAt = (clientX: number, clientY: number): Point => pointOn(svg.current?.parentElement ?? null, zoom, clientX, clientY);

  const shown = strokes.map((s) => ({ ...s, at: placeStroke(s.points, s.fromId ? (boxes.get(s.fromId) ?? null) : null, s.toId ? (boxes.get(s.toId) ?? null) : null) }));

  const rub = (p: Point) => {
    for (const s of shown) {
      if (erased.current.has(s.id)) continue;
      if (nearStroke(p, s.at, 10)) {
        erased.current.add(s.id);
        onErase(s.id);
      }
    }
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!mode || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointer.current = e.pointerId;
    const c = canvasAt(e.clientX, e.clientY);
    if (mode === "erase") {
      erased.current = new Set();
      rub(c);
      return;
    }
    from.current = hitThing(c, boxes);
    pts.current = [[c.x, c.y]];
    setLive(pts.current);
    setHover({ from: from.current, to: null });
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    // Coalesced events keep a fast hand smooth.
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    const list = events.length ? events : [e.nativeEvent];
    if (mode === "erase") {
      list.forEach((ev) => rub(canvasAt(ev.clientX, ev.clientY)));
      return;
    }
    for (const ev of list) {
      const c = canvasAt(ev.clientX, ev.clientY);
      pts.current.push([c.x, c.y]);
    }
    setLive([...pts.current]);
    const last = pts.current[pts.current.length - 1];
    const to = hitThing({ x: last[0], y: last[1] }, boxes);
    setHover({ from: from.current, to: to !== from.current ? to : null });
  };

  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    if (mode === "erase") return;
    const points = round(thin(pts.current));
    pts.current = [];
    setLive(null);
    setHover({ from: null, to: null });
    if (e.type === "pointercancel" || !points.length) return;
    const last = points[points.length - 1];
    let to = hitThing({ x: last[0], y: last[1] }, boxes);
    let fromId = from.current;
    // A line that starts and ends on the same thing is a mark on it (an underline, a circle), not a tie.
    if (to && to === fromId) to = fromId = null;
    // A scribble inside one thing, or a tiny tap: free ink.
    onDraw({ id: "", points, fromId: to ? fromId : null, toId: fromId ? to : null });
  };

  const box = (id: string | null) => (id ? boxes.get(id) : undefined);
  const ring = (b: Box | undefined) =>
    b && <rect x={b.x - b.w / 2 - 6} y={b.y - b.h / 2 - 6} width={b.w + 12} height={b.h + 12} rx={12} className="fill-none stroke-red-text/55" strokeWidth={2} strokeDasharray="5 5" />;

  return (
    <svg
      ref={svg}
      aria-hidden={strokes.length === 0}
      role="img"
      aria-label={strokes.length ? `${strokes.length} ${strokes.length === 1 ? "line" : "lines"} drawn on the paper` : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ left: -FAR, top: -FAR, width: FAR * 2, height: FAR * 2 }}
      viewBox={`${-FAR} ${-FAR} ${FAR * 2} ${FAR * 2}`}
      className={`absolute overflow-visible ${mode ? "z-20 touch-none" : "pointer-events-none z-[1]"}`}
    >
      <defs>
        <marker id="ink-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M2 2.2L9.6 6 2 9.8" fill="none" stroke="var(--ink)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      {mode === "draw" && (
        <>
          {ring(box(hover.from))}
          {ring(box(hover.to))}
        </>
      )}
      {shown.map((s) => {
        const d = pathOf(s.at);
        const tied = !!(s.fromId && s.toId);
        const ends = endAngle(s.at) !== null;
        return (
          <path
            key={s.id}
            d={d}
            pathLength={fresh.has(s.id) ? 1 : undefined}
            style={fresh.has(s.id) ? ({ "--len": 1 } as React.CSSProperties) : undefined}
            className={`fill-none stroke-ink ${fresh.has(s.id) ? "ink-draw" : ""} ${mode === "erase" ? "hover:stroke-red-text/60" : ""}`}
            strokeWidth={tied ? 2 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={tied && ends ? "url(#ink-arrow)" : undefined}
          />
        );
      })}
      {live && <path d={pathOf(live)} className="fill-none stroke-ink" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
