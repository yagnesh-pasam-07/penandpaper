"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { StackCard, StackRow } from "@/components/canvas/stack-card";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { btn } from "@/components/ui";
import { uid } from "@/lib/mutations";
import { applyStackOp, membersOf, settleStacks, type DropPaper, type Thought } from "@/modules/drop/logic";
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
  stackId: null,
  stackOrder: 0,
  scheduledFor: null,
});

/** What a first visit starts with. */
const EXAMPLES: Thought[] = [thought("idea: weekend photo walk", 2, "pencil"), thought("read the design doc", 1), thought("call amma", 0)];

/**
 * "Try it right here": a small real paper on the homepage. Visitors drop,
 * strike, stack and crumple with the same pieces as the app; it all stays in
 * this browser, and moves onto their real paper after they sign up.
 */
export function TryIt() {
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  // Before the page is live: a quiet placeholder of the same size (what's saved lives in this browser).
  return mounted ? <TryPaper /> : <div className="dot-grid h-[420px] rounded-[22px] border border-line bg-bg" aria-hidden="true" />;
}

function TryPaper() {
  const [paper, setPaper] = useState<DropPaper>(() => {
    const saved = readTryPaper();
    return { date: "try", thoughts: saved?.thoughts ?? EXAMPLES, stacks: saved?.stacks ?? [] };
  });
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const touched = useRef(false);

  // Keep it in this browser (only once the visitor has done something).
  useEffect(() => {
    if (!touched.current) return;
    try {
      localStorage.setItem(TRY_KEY, JSON.stringify({ thoughts: paper.thoughts, stacks: paper.stacks }));
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
      change((p) => settleStacks({ ...p, thoughts: p.thoughts.filter((t) => t.id !== id) }));
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
    change((p) => ({ ...p, thoughts: p.thoughts.map(moved), stacks: p.stacks.map(moved) }));
  };

  const loose = paper.thoughts.filter((t) => !t.stackId).map((t) => ({ kind: "thought" as const, id: t.id, x: t.x, y: t.y, t }));
  const stacks = paper.stacks.map((s) => ({ kind: "stack" as const, id: s.id, x: s.x, y: s.y, s, members: membersOf(paper, s.id) }));
  const items = [...loose, ...stacks].reverse();
  const byId = new Map(paper.thoughts.map((t) => [t.id, t]));

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
        {paper.stacks.length === 0 && paper.thoughts.length >= 2 && (
          <span aria-hidden="true" className="pointer-events-none absolute -top-1 right-3 z-10 flex items-center gap-1 font-hand text-[20px] text-mute max-sm:hidden">
            drag one onto another
            <svg width="38" height="30" viewBox="0 0 38 30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 4c10 2 20 8 26 19" />
              <path d="M22 21l7 3 1-8" />
            </svg>
          </span>
        )}
        <FreeCanvas
          label="Try it: a paper that lives in this browser"
          items={items}
          minHeight={340}
          raised={open}
          onArrange={arrange}
          canDropOn={(dragged) => byId.has(dragged)}
          onDropOn={(dragged, onto) => change((p) => (byId.get(dragged)?.stackId === onto ? p : applyStackOp(p, { kind: "stack", thought: dragged, onto, newStackId: uid() })))}
          onDetach={(id, at) => change((p) => applyStackOp(p, { kind: "takeOut", thought: id, x: at.x, y: at.y }))}
          renderGhost={(id) => {
            const t = byId.get(id);
            return t ? <ThoughtBubble text={t.text} done={t.status === "done"} kind={t.kind} shape={t.shape} seed={t.createdAt} readOnly /> : null;
          }}
          render={(it, ctx) =>
            it.kind === "thought" ? (
              <ThoughtBubble
                text={it.t.text}
                done={it.t.status === "done"}
                kind={it.t.kind}
                shape={it.t.shape}
                seed={it.t.createdAt}
                fresh={fresh.has(it.id)}
                movable
                target={ctx.target}
                leaving={leaving.has(it.id) ? "crumple" : null}
                onEdit={(v) => change((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === it.id ? { ...t, text: v } : t)) }))}
                onToggle={() => toggle(it.id)}
                onInk={() => change((p) => applyStackOp(p, { kind: "ink", thought: it.id, to: it.t.kind === "pencil" ? "pen" : "pencil" }))}
                onDelete={() => crumple(it.id)}
              />
            ) : (
              <StackCard
                name={it.s.name}
                count={it.members.length}
                done={it.members.filter((m) => m.status === "done").length}
                top={{ text: it.members[0]?.text ?? "", shape: it.members[0]?.shape ?? 0, seed: it.members[0]?.createdAt, done: it.members[0]?.status === "done" }}
                peek={it.members.map((m) => m.text)}
                open={open === it.id}
                onToggleOpen={() => setOpen(open === it.id ? null : it.id)}
                target={ctx.target}
                onRename={(name) => change((p) => applyStackOp(p, { kind: "rename", stack: it.id, name }))}
                menu={[{ label: "Unstack", onSelect: () => change((p) => applyStackOp(p, { kind: "unstack", stack: it.id, spots: [] })) }]}
              >
                {it.members.map((m) => (
                  <StackRow
                    key={m.id}
                    text={m.text}
                    done={m.status === "done"}
                    pencil={m.kind === "pencil"}
                    onGrab={ctx.grab(m.id)}
                    onToggle={() => toggle(m.id)}
                    onDelete={() => crumple(m.id)}
                  />
                ))}
              </StackCard>
            )
          }
        />
      </div>
      <p className="text-center text-[15px] text-mute">
        Double-click to strike · drag one onto another to stack · ✕ to crumple. It stays in this browser.{" "}
        <span className="text-ink">Like it? Keep your paper:</span>{" "}
        <Link href="/signup" className={`${btn.primarySm} ml-1 h-10 px-4 align-middle`}>
          Start writing
        </Link>
      </p>
    </div>
  );
}
