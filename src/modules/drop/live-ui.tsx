"use client";

import { useEffect, useState } from "react";
import type { Point } from "@/components/canvas/arrange";
import { cursorShows, type LivePeer, type LiveState } from "./use-live";

/** Everyone's pointers, drawn on the sheet (they pan and zoom with it), each in that person's ink with their first name. */
export function LiveCursors({ peers, toCanvas, zoom }: { peers: LivePeer[]; toCanvas: (p: Point) => Point; zoom: number }) {
  // Re-checked each second so an idle cursor fades out.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // The latest of a person's tabs is enough.
  const shown = peers.filter((p) => cursorShows(p, now));
  if (!shown.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-40">
      {shown.map((p) => {
        const at = toCanvas(p.at!);
        return (
          <div
            key={p.sid}
            className="absolute top-0 left-0 transition-transform duration-100 ease-linear motion-reduce:transition-none"
            // Drawn at screen size whatever the zoom.
            style={{ transform: `translate(${at.x}px, ${at.y}px) scale(${1 / zoom})`, transformOrigin: "0 0", color: `var(--ink-${p.ink})` }}
          >
            <svg width="18" height="20" viewBox="0 0 18 20" className="drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.25)]">
              <path d="M2 1.5 L2 16.5 L6.2 12.6 L9 18.6 L11.6 17.4 L8.9 11.5 L14.6 11.2 Z" fill="currentColor" stroke="var(--sheet, #fff)" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute top-[17px] left-[12px] rounded-full px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-sm"
              style={{ background: "currentColor" }}
            >
              <span className="text-white mix-blend-normal">{p.name}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Who's here: a face per person (their initial, in their ink), and a dot that says the paper is live. */
export function LiveFaces({ live, me }: { live: LiveState; me?: string }) {
  // One face per person, however many tabs they have open.
  const people = [...new Map(live.peers.map((p) => [p.uid, p])).values()];
  return (
    <span className="flex items-center gap-1.5 pr-1" title={live.connected ? "Live: changes show for everyone as they're made" : "Reconnecting…"}>
      <span className={`size-2 rounded-full ${live.connected ? "bg-[var(--ink-viridian)]" : "bg-line-strong"}`} aria-hidden="true" />
      <span className="sr-only">{live.connected ? "Live" : "Reconnecting"}</span>
      {people.length > 0 && (
        <span className="flex -space-x-1.5" aria-label={`Here now: ${people.map((p) => p.name).join(", ")}${me ? `, and you` : ""}`}>
          {people.slice(0, 5).map((p) => (
            <span
              key={p.uid}
              title={`${p.name}${p.role === "view" ? " (viewing)" : p.role === "owner" ? " (owner)" : ""}`}
              className="flex size-7 items-center justify-center rounded-full border-2 border-sheet text-[12px] font-semibold text-white uppercase"
              style={{ background: `var(--ink-${p.ink})` }}
            >
              {p.name[0]}
            </span>
          ))}
          {people.length > 5 && <span className="flex size-7 items-center justify-center rounded-full border-2 border-sheet bg-soft text-[11px] font-semibold text-mute">+{people.length - 5}</span>}
        </span>
      )}
    </span>
  );
}
