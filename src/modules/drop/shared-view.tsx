"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { FreeCanvas } from "@/components/canvas/free-canvas";
import { InkLayer } from "@/components/canvas/ink-layer";
import { HandText, ThoughtBubble } from "@/components/canvas/thought-bubble";
import { viewKey } from "@/components/canvas/view";
import { call } from "./chrome";
import { applyLive } from "./live";
import { LiveCursors, LiveFaces } from "./live-ui";
import { paperTitle, type DropPaper } from "./logic";
import type { SharedPaper } from "./share-server";
import { useLive } from "./use-live";
import { useCanvasView, ViewControls } from "./use-view";

const NO_FRESH = new Set<string>();
const noop = () => {};

/**
 * A paper someone shared, to look at: the same canvas, read-only, and live.
 * What the owner (and anyone editing with them) adds, moves or rubs out shows
 * as it happens, with their cursors. Pan and zoom work; nothing can be changed
 * here (and the server would refuse it anyway).
 */
export function SharedView({ paper: initial, signedIn, token = null }: { paper: SharedPaper; signedIn: boolean; token?: string | null }) {
  const page = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLDivElement>(null);
  const spot = useRef<{ x: number; y: number } | null>(null);
  const { view, zoomBy, reset, fit } = useCanvasView(page, origin, viewKey(`shared-${initial.id}`));
  const [paper, setPaper] = useState<Pick<DropPaper, "thoughts" | "strokes">>({ thoughts: initial.thoughts, strokes: initial.strokes });
  const resync = useCallback(async () => {
    try {
      const next = await call<DropPaper>(`/api/drop/papers/${initial.id}${token ? `?t=${encodeURIComponent(token)}` : ""}`);
      setPaper({ thoughts: next.thoughts, strokes: next.strokes });
    } catch {
      // Keep what's on screen.
    }
  }, [initial.id, token]);
  const live = useLive(initial.id, {
    token,
    spot,
    onChange: (ev) => setPaper((p) => applyLive({ id: initial.id, name: null, createdAt: "", archivedAt: null, ...p }, ev)),
    onSync: () => void resync(),
    onRole: () => location.reload(),
  });

  if (live.removed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <span className="font-hand text-[34px] font-bold text-ink">This paper isn&apos;t shared any more.</span>
        <Link href={signedIn ? "/drop" : "/"} className="text-mute underline-offset-2 hover:text-ink hover:underline">
          {signedIn ? "Back to your papers" : "Pen & Paper"}
        </Link>
      </div>
    );
  }

  const items = paper.thoughts.map((t) => ({ id: t.id, x: t.x, y: t.y, thought: t }));
  return (
    <div ref={page} className="canvas-surface canvas-page flex min-h-dvh flex-col bg-bg">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-3 px-4 pt-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-sheet/90 px-4 py-2 shadow-[0_10px_30px_-18px_var(--shadow)] backdrop-blur-md">
          <Link href="/" className="font-hand text-[20px] font-bold text-ink">
            pen &amp; paper
          </Link>
          <span className="h-5 w-px bg-line" />
          <span className="font-hand text-[20px] text-ink">{paperTitle(initial)}</span>
          <span className="rounded-full bg-soft px-2 py-0.5 text-[12px] text-mute">{initial.owner}&apos;s paper · view only</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-line bg-sheet/90 py-1 pr-1 pl-3 shadow-[0_10px_30px_-18px_var(--shadow)] backdrop-blur-md">
          <LiveFaces live={live} />
          <Link href={signedIn ? "/drop" : "/signup"} className="rounded-xl px-3 py-1.5 text-sm font-medium text-ink hover:bg-soft">
            {signedIn ? "Your own paper →" : "Make your own paper →"}
          </Link>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col px-4 pt-[76px] pb-16 sm:px-8">
        <div ref={origin} className="relative -mx-4 flex-1 sm:-mx-8">
          <FreeCanvas
            bare
            view={view}
            spotRef={spot}
            minHeight="calc(100dvh - 10rem)"
            label={paperTitle(initial)}
            items={items}
            overlay={({ boxes, zoom, toCanvas }) => (
              <>
                <LiveCursors peers={live.peers} toCanvas={toCanvas} zoom={zoom} />
                <InkLayer strokes={paper.strokes ?? []} boxes={boxes} zoom={zoom} mode={null} fresh={NO_FRESH} onDraw={noop} onErase={noop} />
              </>
            )}
            render={(it) =>
              it.thought.kind === "text" || it.thought.kind === "todo" ? (
                <div
                  className="paper-text hand font-note leading-snug break-words whitespace-pre-wrap"
                  style={{ fontSize: 22 * (it.thought.size ?? 1), color: `var(--ink-${it.thought.color ?? "ink"})`, maxWidth: 420 * Math.max(1, it.thought.size ?? 1) }}
                >
                  <HandText text={it.thought.text} seed={it.thought.createdAt} />
                </div>
              ) : (
                <ThoughtBubble text={it.thought.text} image={it.thought.image} done={it.thought.status === "done"} shape={it.thought.shape} seed={it.thought.createdAt} readOnly />
              )
            }
          />
        </div>
      </main>
      <ViewControls view={view} onZoom={(f) => zoomBy(f)} onReset={reset} onFit={fit} />
    </div>
  );
}
