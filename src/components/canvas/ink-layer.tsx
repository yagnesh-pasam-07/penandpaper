"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { InkName, ShapeKind } from "@/modules/drop/logic";
import type { Box, Point } from "./arrange";
import { pointOn } from "./free-canvas";
import { boundsOfPoints, endAngle, handShapePath, hitThing, nearStroke, pathOf, placeStroke, round, shapeCorners, shapeOutline, thin, type Pt } from "./ink";

export type InkStroke = { id: string; points: Pt[]; fromId: string | null; toId: string | null; color?: InkName; shape?: ShapeKind | null; label?: string | null };

export type InkMode = "draw" | "erase" | "shape" | "select" | null;

/** Far enough that the SVG never clips a line drawn way off the first screen. */
const FAR = 200_000;
const INK_NAMES: InkName[] = ["ink", "vermilion", "cobalt", "viridian", "saffron"];
export const inkVar = (c: InkName | undefined | null) => `var(--ink-${c ?? "ink"})`;

/**
 * Where a line shows now. Placing a connector is a little geometry, so each
 * result is kept against the line's own points (an edit makes a new array) and
 * the boxes it is tied to: a drag elsewhere on the paper reuses it.
 */
const placedCache = new WeakMap<Pt[], { key: string; at: Pt[] }>();
const keyOf = (b: Box | undefined) => (b ? `${b.x},${b.y},${b.w},${b.h}` : "-");
function placed(strokes: InkStroke[], boxes: Map<string, Box>) {
  return strokes.map((s) => {
    if (s.shape || (!s.fromId && !s.toId)) return { ...s, at: s.points };
    const from = s.fromId ? boxes.get(s.fromId) : undefined;
    const to = s.toId ? boxes.get(s.toId) : undefined;
    const key = `${keyOf(from)}|${keyOf(to)}`;
    const hit = placedCache.get(s.points);
    if (hit && hit.key === key) return { ...s, at: hit.at };
    const at = placeStroke(s.points, from ?? null, to ?? null);
    placedCache.set(s.points, { key, at });
    return { ...s, at };
  });
}

/**
 * Ink on the sheet: every line, connector and shape, drawn in the sheet's own
 * units so it pans and zooms with the notes.
 * - Draw: a press puts ink down; a line from one thing to another ties them.
 * - Shape: drag a rectangle or ellipse (Shift: square or circle).
 * - Eraser: a press or a rub removes lines and shapes.
 * - Select: a press on a line or shape picks it; drag to carry it (a loop or
 *   shape carries everything inside it, which the page works out); corner
 *   handles reshape a shape; double-click a shape to write in it.
 * Otherwise every press goes through to the notes.
 */
export function InkLayer({
  strokes,
  boxes,
  zoom,
  mode,
  shapeKind = "rect",
  color = "ink",
  fresh,
  selectedId = null,
  carry = null,
  labelling = null,
  onDraw,
  onErase,
  onPick,
  onCarry,
  onReshape,
  onLabel,
  onLabelStart,
}: {
  strokes: InkStroke[];
  boxes: Map<string, Box>;
  zoom: number;
  mode: InkMode;
  shapeKind?: ShapeKind;
  color?: InkName;
  /** Just drawn: the ink draws on. */
  fresh: Set<string>;
  selectedId?: string | null;
  /** Lines being carried with a group: shown shifted by (dx, dy). */
  carry?: { ids: Set<string>; dx: number; dy: number } | null;
  /** The shape whose words are being written. */
  labelling?: string | null;
  onDraw: (stroke: InkStroke) => void;
  onErase: (id: string) => void;
  /** A line or shape pressed with Select (null: bare paper). */
  onPick?: (id: string | null) => void;
  /** Carrying the picked line: live (`done` false) and when let go (`done` true). */
  onCarry?: (id: string, dx: number, dy: number, done: boolean) => void;
  onReshape?: (id: string, corners: Pt[]) => void;
  onLabel?: (id: string, text: string) => void;
  onLabelStart?: (id: string) => void;
}) {
  const [hover, setHover] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [reshaping, setReshaping] = useState<{ id: string; corners: Pt[] } | null>(null);
  const [drafting, setDrafting] = useState<{ shape: ShapeKind; corners: Pt[] } | null>(null);
  const pointer = useRef<number | null>(null);
  const pts = useRef<Pt[]>([]);
  const from = useRef<string | null>(null);
  const erased = useRef(new Set<string>());
  const svg = useRef<SVGSVGElement>(null);
  const livePath = useRef<SVGPathElement>(null);
  const frame = useRef(0);
  // The layer lives inside the sheet, so the sheet is its parent.
  const canvasAt = (clientX: number, clientY: number): Point => pointOn(svg.current?.parentElement ?? null, zoom, clientX, clientY);

  const shown = placed(strokes, boxes).map((s) => {
    if (reshaping?.id === s.id) return { ...s, at: reshaping.corners };
    if (carry?.ids.has(s.id) && (carry.dx || carry.dy) && (s.shape || (!s.fromId && !s.toId))) return { ...s, at: s.at.map(([x, y]) => [x + carry.dx, y + carry.dy] as Pt) };
    return s;
  });
  const outlineOf = (s: { at: Pt[]; shape?: ShapeKind | null }) => (s.shape ? shapeOutline(s.shape, s.at) : s.at);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const rub = (p: Point) => {
    for (const s of shown) {
      if (erased.current.has(s.id)) continue;
      if (nearStroke(p, outlineOf(s), 10)) {
        erased.current.add(s.id);
        onErase(s.id);
      }
    }
  };

  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!mode || mode === "select" || e.button !== 0) return;
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
    if (mode === "shape") {
      pts.current = [[c.x, c.y]];
      setDrafting({ shape: shapeKind, corners: [[c.x, c.y], [c.x, c.y]] });
      return;
    }
    from.current = hitThing(c, boxes);
    pts.current = [[c.x, c.y]];
    if (livePath.current) livePath.current.setAttribute("d", pathOf(pts.current));
    setHover({ from: from.current, to: null });
  };

  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    if (mode === "erase") {
      // Coalesced events keep a fast hand smooth.
      const list = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
      (list.length ? list : [e.nativeEvent]).forEach((ev) => rub(canvasAt(ev.clientX, ev.clientY)));
      return;
    }
    if (mode === "shape") {
      const c = canvasAt(e.clientX, e.clientY);
      const a = pts.current[0];
      setDrafting({ shape: shapeKind, corners: shapeCorners({ x: a[0], y: a[1] }, c, e.shiftKey) });
      return;
    }
    const list = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of list.length ? list : [e.nativeEvent]) {
      const c = canvasAt(ev.clientX, ev.clientY);
      pts.current.push([c.x, c.y]);
    }
    // The live line is drawn straight onto its path, once a frame: no React work per point.
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        livePath.current?.setAttribute("d", pathOf(pts.current));
        const last = pts.current[pts.current.length - 1];
        if (!last) return;
        const to = hitThing({ x: last[0], y: last[1] }, boxes);
        const next = to !== from.current ? to : null;
        setHover((h) => (h.to === next && h.from === from.current ? h : { from: from.current, to: next }));
      });
  };

  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    if (mode === "erase") return;
    if (mode === "shape") {
      const d = drafting;
      setDrafting(null);
      pts.current = [];
      if (e.type === "pointercancel" || !d) return;
      const b = boundsOfPoints(d.corners);
      // A click, not a drag: a modest shape there, ready to be resized.
      const corners: Pt[] = b.maxX - b.minX < 8 && b.maxY - b.minY < 8 ? [d.corners[0], [d.corners[0][0] + 160, d.corners[0][1] + (d.shape === "ellipse" ? 110 : 100)]] : d.corners;
      onDraw({ id: "", points: round(corners), fromId: null, toId: null, color, shape: d.shape });
      return;
    }
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const points = round(thin(pts.current));
    pts.current = [];
    livePath.current?.setAttribute("d", "");
    setHover({ from: null, to: null });
    if (e.type === "pointercancel" || !points.length) return;
    const last = points[points.length - 1];
    let to = hitThing({ x: last[0], y: last[1] }, boxes);
    let fromId = from.current;
    // A line that starts and ends on the same thing is a mark on it (an underline, a circle), not a tie.
    if (to && to === fromId) to = fromId = null;
    onDraw({ id: "", points, fromId: to ? fromId : null, toId: fromId ? to : null, color });
  };

  /** Select: press a line or shape to pick it, then carry it. */
  const grab = (id: string) => (e: ReactPointerEvent) => {
    if (mode !== "select" || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onPick?.(id);
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    let last = { dx: 0, dy: 0 };
    let raf = 0;
    const mv = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      if (!moved && Math.hypot(dx * zoom, dy * zoom) < 4) return;
      moved = true;
      last = { dx, dy };
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          onCarry?.(id, last.dx, last.dy, false);
        });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cancelAnimationFrame(raf);
      if (moved) onCarry?.(id, ev.type === "pointerup" ? last.dx : 0, ev.type === "pointerup" ? last.dy : 0, true);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  /** A corner handle of the picked shape: drag to reshape (Shift keeps it even). */
  const corner = (s: { id: string; at: Pt[] }, which: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const b = boundsOfPoints(s.at);
    // The opposite corner stays put.
    const fixed: Point = { x: which === 0 || which === 3 ? b.maxX : b.minX, y: which === 0 || which === 1 ? b.maxY : b.minY };
    let corners: Pt[] = s.at;
    const mv = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      corners = shapeCorners(fixed, canvasAt(ev.clientX, ev.clientY), ev.shiftKey);
      setReshaping({ id: s.id, corners });
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setReshaping(null);
      const nb = boundsOfPoints(corners);
      if (ev.type === "pointerup" && nb.maxX - nb.minX >= 12 && nb.maxY - nb.minY >= 12) onReshape?.(s.id, round(corners));
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const box = (id: string | null) => (id ? boxes.get(id) : undefined);
  const ring = (b: Box | undefined) =>
    b && <rect x={b.x - b.w / 2 - 6} y={b.y - b.h / 2 - 6} width={b.w + 12} height={b.h + 12} rx={12} className="fill-none stroke-red-text/55" strokeWidth={2} strokeDasharray="5 5" />;

  const picked = shown.find((s) => s.id === selectedId) ?? null;
  const pickedBounds = picked ? boundsOfPoints(outlineOf(picked)) : null;
  const handle = 9 / zoom;
  const active = mode === "draw" || mode === "erase" || mode === "shape";

  return (
    <>
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
        className={`absolute overflow-visible ${active ? "z-20 touch-none" : "pointer-events-none z-[1]"}`}
      >
        <defs>
          {INK_NAMES.map((c) => (
            <marker key={c} id={`ink-arrow-${c}`} viewBox="0 0 12 12" refX="9" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M2 2.2L9.6 6 2 9.8" fill="none" stroke={inkVar(c)} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          ))}
        </defs>
        {mode === "draw" && (
          <>
            {ring(box(hover.from))}
            {ring(box(hover.to))}
          </>
        )}
        {shown.map((s) => {
          const tied = !!(s.fromId && s.toId);
          const d = s.shape ? handShapePath(s.shape, s.at, s.id) : pathOf(s.at);
          const ends = !s.shape && endAngle(s.at) !== null;
          const isFresh = fresh.has(s.id);
          const ink = inkVar(s.color);
          return (
            <g key={s.id}>
              <path
                d={d}
                pathLength={isFresh ? 1 : undefined}
                style={{ stroke: ink, ...(isFresh ? ({ "--len": 1 } as CSSProperties) : {}) }}
                className={`fill-none ${isFresh ? "ink-draw" : ""} ${mode === "erase" ? "hover:opacity-50" : ""}`}
                strokeWidth={tied ? 2 : s.shape ? 2.2 : 2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={tied && ends ? `url(#ink-arrow-${s.color ?? "ink"})` : undefined}
              />
              {mode === "select" && (
                // A wide, invisible edge to press: easier to catch than a 2 px line.
                <path
                  d={d}
                  data-ink-hit=""
                  onPointerDown={grab(s.id)}
                  onDoubleClick={(e) => {
                    if (!s.shape) return;
                    e.stopPropagation();
                    onLabelStart?.(s.id);
                  }}
                  style={{ pointerEvents: "stroke", cursor: "move" }}
                  className="fill-none stroke-transparent"
                  strokeWidth={16 / zoom}
                />
              )}
            </g>
          );
        })}
        {drafting && <path d={handShapePath(drafting.shape, drafting.corners, "draft")} style={{ stroke: inkVar(color) }} className="fill-none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
        <path ref={livePath} style={{ stroke: inkVar(color) }} className="fill-none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        {mode === "select" && picked && pickedBounds && (
          <g>
            <rect
              x={pickedBounds.minX - 8}
              y={pickedBounds.minY - 8}
              width={pickedBounds.maxX - pickedBounds.minX + 16}
              height={pickedBounds.maxY - pickedBounds.minY + 16}
              rx={6}
              className="fill-none stroke-red-text/70"
              strokeWidth={1.2 / zoom}
              strokeDasharray={`${5 / zoom} ${4 / zoom}`}
            />
            {picked.shape &&
              [
                [pickedBounds.minX, pickedBounds.minY],
                [pickedBounds.maxX, pickedBounds.minY],
                [pickedBounds.maxX, pickedBounds.maxY],
                [pickedBounds.minX, pickedBounds.maxY],
              ].map(([x, y], i) => (
                <rect
                  key={i}
                  x={x - handle / 2}
                  y={y - handle / 2}
                  width={handle}
                  height={handle}
                  rx={2 / zoom}
                  onPointerDown={corner(picked, i)}
                  style={{ pointerEvents: "all", cursor: i % 2 === 0 ? "nwse-resize" : "nesw-resize" }}
                  className="fill-sheet stroke-red-text"
                  strokeWidth={1.4 / zoom}
                />
              ))}
          </g>
        )}
      </svg>
      {/* Words inside shapes: real text in the page, centred in the shape. */}
      {shown
        .filter((s) => s.shape && (s.label || labelling === s.id))
        .map((s) => {
          const b = boundsOfPoints(s.at);
          return (
            <ShapeLabel
              // Opening the editor starts a fresh one, with the words as they are now.
              key={`${s.id}${labelling === s.id ? ":edit" : ""}`}
              box={{ left: b.minX, top: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY }}
              text={s.label ?? ""}
              color={s.color}
              editing={labelling === s.id}
              onDone={(t) => onLabel?.(s.id, t)}
            />
          );
        })}
    </>
  );
}

function ShapeLabel({ box, text, color, editing, onDone }: { box: { left: number; top: number; width: number; height: number }; text: string; color?: InkName; editing: boolean; onDone: (text: string) => void }) {
  const [draft, setDraft] = useState(text);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) return;
    const raf = requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [editing]);
  const style: CSSProperties = { ...box, color: inkVar(color) };
  if (editing)
    return (
      <div style={style} className="absolute z-30 flex items-center justify-center p-3">
        <textarea
          ref={area}
          value={draft}
          aria-label="Words in the shape"
          rows={Math.max(1, draft.split("\n").length)}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) area.current?.blur();
          }}
          onBlur={() => onDone(draft.trim())}
          className="hand w-full resize-none bg-transparent text-center font-note text-[20px] leading-snug outline-none"
        />
      </div>
    );
  return (
    <div style={style} className="pointer-events-none absolute z-[2] flex items-center justify-center overflow-hidden p-3 text-center">
      <span className="hand font-note text-[20px] leading-snug break-words whitespace-pre-wrap">{text}</span>
    </div>
  );
}
