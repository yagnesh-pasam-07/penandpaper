"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { btn } from "@/components/ui";
import { uid } from "@/lib/mutations";
import { applyPaperOp, type DropPaper, type Thought } from "@/modules/drop/logic";
import { readTryPaper, TRY_KEY } from "@/modules/drop/try-import";

const noSubscribe = () => () => {};

const thought = (text: string, i: number, kind: Thought["kind"] = "pen"): Thought => ({
  id: `try-${i}-${text.length}`,
  text,
  status: "open",
  kind,
  shape: i,
  createdAt: new Date(Date.UTC(2026, 9, 19, 8, i)).toISOString(),
  doneAt: null,
  carriedFrom: null,
  x: null,
  y: null,
  scheduledFor: null,
});

/** What a first visit starts with. */
const EXAMPLES: Thought[] = [thought("idea: weekend photo walk", 2, "pencil"), thought("read the design doc", 1), thought("call amma", 0)];

/**
 * "Try it right here": a small real paper on the homepage. Visitors drop,
 * strike and crumple with the same pieces as the app; it all stays in
 * this browser, and moves onto their real paper after they sign up.
 */
export function TryIt() {
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  // Before the page is live: a quiet placeholder of the same size (what's saved lives in this browser).
  return mounted ? <TryPaper /> : <div className="canvas-surface h-[420px] rounded-[22px] border border-line bg-bg" aria-hidden="true" />;
}

function TryPaper() {
  const [paper, setPaper] = useState<DropPaper>(() => {
    const saved = readTryPaper();
    return { date: "try", thoughts: saved?.thoughts ?? EXAMPLES };
  });
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const touched = useRef(false);

  // Keep it in this browser (only once the visitor has done something).
  useEffect(() => {
    if (!touched.current) return;
    try {
      localStorage.setItem(TRY_KEY, JSON.stringify({ thoughts: paper.thoughts }));
    } catch {}
  }, [paper]);

  const change = (fn: (p: DropPaper) => DropPaper) => {
    touched.current = true;
    setPaper((p) => {
      try {
        return fn(p);
      } catch {
        return p;
      }
    });
  };

  const drop = () => {
    const value = text.trim().slice(0, 200);
    if (!value) return;
    const t = { ...thought(value, Math.floor(Math.random() * 6)), id: uid(), createdAt: new Date().toISOString() };
    change((p) => ({ ...p, thoughts: [...p.thoughts, t] }));
    setFresh((f) => new Set(f).add(t.id));
    setText("");
  };

  const toggle = (id: string) => change((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id && t.kind === "pen" ? { ...t, status: t.status === "done" ? "open" : "done" } : t)) }));
  const crumple = (id: string) => {
    setLeaving((s) => new Set(s).add(id));
    setTimeout(() => {
      change((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== id) }));
      setLeaving((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 450);
  };
  const arrange = (placements: Placement[]) => {
    const at = new Map(placements.map((p) => [p.id, p]));
    const moved = <T extends { id: string; x: number | null; y: number | null }>(x: T) => (at.has(x.id) ? { ...x, x: at.get(x.id)!.x, y: at.get(x.id)!.y } : x);
    change((p) => ({ ...p, thoughts: p.thoughts.map(moved) }));
  };

  const items = paper.thoughts.map((t) => ({ id: t.id, x: t.x, y: t.y, t })).reverse();

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          drop();
        }}
        className="flex items-center gap-3 rounded-2xl border-[1.5px] border-ink bg-sheet px-4"
      >
        <label htmlFor="try-input" className="sr-only">
          Write a thought
        </label>
        <input
          id="try-input"
          value={text}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a thought, press Enter"
          className="hand h-14 min-w-0 flex-1 bg-transparent font-note text-[20px] text-ink outline-none placeholder:font-sans placeholder:text-base placeholder:text-mute focus-visible:outline-none"
        />
        <button type="submit" className="h-10 rounded-xl bg-red px-4 text-sm font-semibold text-on-red disabled:opacity-40" disabled={!text.trim()}>
          Drop
        </button>
      </form>

      <div className="relative">
        <FreeCanvas
          label="Try it: a paper that lives in this browser"
          items={items}
          minHeight={340}
          onArrange={arrange}
          render={(it) => (
            <ThoughtBubble
              text={it.t.text}
              done={it.t.status === "done"}
              kind={it.t.kind}
              shape={it.t.shape}
              seed={it.t.createdAt}
              fresh={fresh.has(it.id)}
              movable
              leaving={leaving.has(it.id) ? "crumple" : null}
              onEdit={(v) => change((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === it.id ? { ...t, text: v } : t)) }))}
              onToggle={() => toggle(it.id)}
              onInk={() => change((p) => applyPaperOp(p, { kind: "ink", thought: it.id, to: it.t.kind === "pencil" ? "pen" : "pencil" }))}
              onDelete={() => crumple(it.id)}
            />
          )}
        />
      </div>
      <p className="text-center text-[15px] text-mute">
        Double-click to strike · ✕ to crumple. It stays in this browser.{" "}
        <span className="text-ink">Like it? Keep your paper:</span>{" "}
        <Link href="/signup" className={`${btn.primarySm} ml-1 h-10 px-4 align-middle`}>
          Start writing
        </Link>
      </p>
    </div>
  );
}
