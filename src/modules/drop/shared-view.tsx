"use client";

import Link from "next/link";
import { useRef } from "react";
import { FreeCanvas } from "@/components/canvas/free-canvas";
import { InkLayer } from "@/components/canvas/ink-layer";
import { HandText, ThoughtBubble } from "@/components/canvas/thought-bubble";
import { viewKey } from "@/components/canvas/view";
import { paperTitle } from "./logic";
import type { SharedPaper } from "./share-server";
import { useCanvasView, ViewControls } from "./use-view";

const NO_FRESH = new Set<string>();
const noop = () => {};

/**
 * A paper someone shared: the same canvas, read-only. Pan and zoom work;
 * nothing can be moved, edited, struck or erased (and the server would refuse it anyway).
 */
export function SharedView({ paper, signedIn }: { paper: SharedPaper; signedIn: boolean }) {
  const page = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLDivElement>(null);
  const { view, zoomBy, reset, fit } = useCanvasView(page, origin, viewKey(`shared-${paper.id}`));
  const items = paper.thoughts.map((t) => ({ id: t.id, x: t.x, y: t.y, thought: t }));
  return (
    <div ref={page} className="canvas-surface canvas-page flex min-h-dvh flex-col bg-bg">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-3 px-4 pt-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-sheet/90 px-4 py-2 shadow-[0_10px_30px_-18px_var(--shadow)] backdrop-blur-md">
          <Link href="/" className="font-hand text-[20px] font-bold text-ink">
            pen &amp; paper
          </Link>
          <span className="h-5 w-px bg-line" />
          <span className="font-hand text-[20px] text-ink">{paperTitle(paper)}</span>
          <span className="rounded-full bg-soft px-2 py-0.5 text-[12px] text-mute">{paper.owner}&apos;s paper · view only</span>
        </div>
        <Link
          href={signedIn ? "/drop" : "/signup"}
          className="pointer-events-auto rounded-2xl border border-line bg-sheet/90 px-4 py-2 text-sm font-medium text-ink shadow-[0_10px_30px_-18px_var(--shadow)] backdrop-blur-md hover:bg-soft"
        >
          {signedIn ? "Your own paper →" : "Make your own paper →"}
        </Link>
      </header>
      <main className="flex w-full flex-1 flex-col px-4 pt-[76px] pb-16 sm:px-8">
        <div ref={origin} className="relative -mx-4 flex-1 sm:-mx-8">
          <FreeCanvas
            bare
            view={view}
            minHeight="calc(100dvh - 10rem)"
            label={paperTitle(paper)}
            items={items}
            overlay={({ boxes, zoom }) => <InkLayer strokes={paper.strokes ?? []} boxes={boxes} zoom={zoom} mode={null} fresh={NO_FRESH} onDraw={noop} onErase={noop} />}
            render={(it) =>
              it.thought.kind === "text" ? (
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
