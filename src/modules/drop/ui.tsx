"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { bubbleStyle } from "@/components/canvas/bubble";
import { Fly } from "@/components/canvas/fly";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { StackCard, StackRow } from "@/components/canvas/stack-card";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { CloseIcon } from "@/components/icons";
import { RankMark } from "@/components/canvas/rank-mark";
import { uid } from "@/lib/mutations";
import { addDays, longDate, shortDate, weekday } from "@/lib/time";
import { call, COLUMN, DeskStamp, DropHeader, meta, useMounted, useViewerTz, type Me } from "./chrome";
import {
  applyStackOp,
  counts,
  foldedItems,
  MAX_RANK,
  membersOf,
  nextUp,
  settleStacks,
  tapRank,
  stackLabel,
  thisWeekend,
  visiblePaper,
  whenLabel,
  type DropPaper,
  type Kind,
  type Stack,
  type StackOp,
  type Thought,
} from "./logic";
import { importTryPaper } from "./try-import";
import { PenButton, Writer } from "./writer";

/* ---------- Today's paper ---------- */

/** One thing on the sheet: a loose thought or a stack of them. */
type SheetItem =
  | { kind: "thought"; id: string; x: number | null; y: number | null; thought: Thought }
  | { kind: "stack"; id: string; x: number | null; y: number | null; stack: Stack; members: Thought[] };

/** Loose thoughts and stacks that show today (folded ones tucked away), newest first, right under the writer. */
function sheetItems(paper: DropPaper): SheetItem[] {
  const shown = visiblePaper(paper);
  const loose: SheetItem[] = shown.thoughts.filter((t) => !t.stackId).map((t) => ({ kind: "thought", id: t.id, x: t.x, y: t.y, thought: t }));
  const stacks: SheetItem[] = shown.stacks.map((s) => ({ kind: "stack", id: s.id, x: s.x, y: s.y, stack: s, members: membersOf(shown, s.id) }));
  const order = new Map(paper.thoughts.map((t, i) => [t.id, i]));
  // Numbered ones first, in their order; the rest keep the order they were dropped in
  // (newest first), a stack sitting where its newest thought would.
  const dropped = (it: SheetItem) => (it.kind === "thought" ? (order.get(it.id) ?? 0) : Math.max(...it.members.map((m) => order.get(m.id) ?? 0)));
  const numberOf = (it: SheetItem) => (it.kind === "thought" ? it.thought.rank : it.stack.rank);
  return [...loose, ...stacks].sort((a, b) => {
    const ra = numberOf(a);
    const rb = numberOf(b);
    if (ra !== null || rb !== null) return ra === null ? 1 : rb === null ? -1 : ra - rb;
    return dropped(b) - dropped(a);
  });
}

/** Still wants attention: an open thought (ideas always are), or a stack with one. */
const isOpenItem = (it: SheetItem) => (it.kind === "thought" ? it.thought.status === "open" : it.members.some((m) => m.status === "open"));

const DRAFT_KEY = "pp-drop-draft";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Undo window for crumpling (and how long the toast stays). */
const UNDO_MS = 6000;
const CRUMPLE_MS = 450;
const FOLD_MS = 340;

type Toast = { text: string; undo?: () => void };
type Leaving = Map<string, "crumple" | "fold">;

export function DropCanvas({ initial, me, stackHint = false }: { initial: DropPaper; me: Me; stackHint?: boolean }) {
  const [paper, setPaper] = useState(initial);
  // The latest paper, updated in step with every change so quick ones in a row build on each other.
  const live = useRef(initial);
  const update = useCallback((change: (p: DropPaper) => DropPaper) => {
    live.current = change(live.current);
    setPaper(live.current);
  }, []);
  // The writer: open, what's half-written in it (kept on close, and across reloads on this device),
  // and pen or pencil (pencil first: jot it down, ink it once it's a task).
  const [writing, setWriting] = useState(initial.thoughts.length === 0);
  const [draft, setDraft] = useState(readDraft);
  const [kind, setKind] = useState<Kind>("pencil");
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, draft);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [draft]);
  // Where each new note was written, so it can fly from there to its place.
  const [flights, setFlights] = useState<Map<string, { x: number; y: number }>>(new Map());
  const penButton = useRef<HTMLButtonElement>(null);
  const mounted = useMounted();
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  // Just struck: stays on the sheet long enough to see the pen line, then sinks to "done today".
  const [settling, setSettling] = useState<Set<string>>(new Set());
  // On their way out (crumpled, folded) or back in (undo): kept on screen for the animation.
  const [leaving, setLeaving] = useState<Leaving>(new Map());
  const [returning, setReturning] = useState<Set<string>>(new Set());
  const [inking, setInking] = useState<Set<string>>(new Set());
  const [openStack, setOpenStack] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [whenFor, setWhenFor] = useState<string | null>(null);
  const [foldedOpen, setFoldedOpen] = useState(false);
  // Number mode: taps give the next number; "Help me order" asks which comes first.
  const [numbering, setNumbering] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [hint, setHint] = useState(stackHint);
  const pending = useRef(0);
  // Saves go out one at a time, in order: drops land in the order typed, and
  // an edit never overtakes the drop it edits.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Crumples waiting out their undo window; sent at once if the page goes away.
  const waiting = useRef(new Map<string, () => void>());
  const tz = useViewerTz();
  const router = useRouter();

  /** Queues a save in the background; on failure, undoes it on screen and says so. */
  const save = useCallback((work: () => Promise<unknown>, onFail?: () => void) => {
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      try {
        await work();
        setError("");
      } catch (e) {
        onFail?.();
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        pending.current -= 1;
      }
    });
    return queue.current;
  }, []);

  // Thoughts tried on the homepage before signing up come onto today's paper.
  useEffect(() => {
    void importTryPaper().then((next) => next && update(() => next));
  }, [update]);

  // Back to the tab: pick up changes from other devices, or a new day's paper.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== "visible" || pending.current > 0 || waiting.current.size > 0) return;
      try {
        const next = await call<DropPaper>("/api/drop/today");
        if (pending.current === 0 && waiting.current.size === 0) update(() => next);
      } catch {
        // Keep what's on screen.
      }
    };
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [update]);

  // Leaving with a crumple still undoable: send it now so it isn't lost.
  useEffect(() => {
    const flush = () => waiting.current.forEach((send) => send());
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard first: Space, or simply typing, opens the writer from anywhere on
  // the page (the first letter goes into it), so a thought never needs the mouse.
  // Shift+C opens Clear desk.
  useEffect(() => {
    const open = (first?: string) => {
      if (first) setDraft((d) => d + first);
      setWriting(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "Escape") {
        setNumbering(false);
        return;
      }
      // A selected thought keeps its own keys (S stack, W when, Delete crumple, 0–6 number).
      if (el?.closest("[data-keys]") && (["s", "w", "delete", "backspace"].includes(e.key.toLowerCase()) || /^[0-6]$/.test(e.key))) return;
      if ((e.key === "N" && e.shiftKey) || /^[1-9]$/.test(e.key)) {
        // Shift+N, or any number key: number mode.
        e.preventDefault();
        setNumbering((on) => (/^[1-9]$/.test(e.key) ? true : !on));
      } else if (e.key === "C" && e.shiftKey) {
        e.preventDefault();
        router.push("/drop/clear");
      } else if (e.key === " ") {
        // A focused button or link keeps Space for itself.
        if (el?.closest("button, a, summary")) return;
        e.preventDefault();
        open();
      } else if (e.key.length === 1) {
        e.preventDefault();
        open(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const closeWriter = () => {
    setWriting(false);
    // Back to where writing started.
    requestAnimationFrame(() => penButton.current?.focus());
  };

  /** Keeps ids in a set for a moment (an animation), then lets them go. */
  const briefly = (set: (f: (s: Set<string>) => Set<string>) => void, ids: string[], ms: number) => {
    set((s) => new Set([...s, ...ids]));
    setTimeout(
      () =>
        set((s) => {
          const next = new Set(s);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
      ms,
    );
  };

  const playOut = (id: string, how: "crumple" | "fold", ms: number, then: () => void) => {
    setLeaving((m) => new Map(m).set(id, how));
    setTimeout(() => {
      then();
      setLeaving((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
    }, ms);
  };

  const drop = (value: string, from: { x: number; y: number }) => {
    const thought: Thought = {
      id: uid(),
      text: value,
      status: "open",
      kind,
      shape: Math.floor(Math.random() * 6),
      createdAt: new Date().toISOString(),
      doneAt: null,
      carriedFrom: null,
      x: null,
      y: null,
      stackId: null,
      stackOrder: 0,
      scheduledFor: null,
      rank: null,
      nextRank: null,
    };
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    setFlights((m) => new Map(m).set(thought.id, from));
    setDraft("");
    void save(
      () => call("/api/drop/thoughts", { method: "POST", body: JSON.stringify({ id: thought.id, text: thought.text, shape: thought.shape, kind: thought.kind }) }),
      () => {
        update((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== thought.id) }));
        setDraft((current) => current || value);
      },
    );
  };

  const patch = (id: string, change: Partial<Pick<Thought, "text" | "status">>) => {
    const before = live.current.thoughts.find((t) => t.id === id);
    if (!before) return;
    // Ideas aren't "done": ink them first.
    if (change.status && before.kind === "pencil") return;
    const after = { ...before, ...change, doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt };
    update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? after : t)) }));
    if (change.status === "done") {
      // The last open one in a stack: the whole stack gets out of the way too.
      const lastInStack = before.stackId && live.current.thoughts.every((t) => t.stackId !== before.stackId || t.status === "done");
      briefly(setSettling, lastInStack ? [id, before.stackId!] : [id], 900);
    }
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
      () => update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? before : t)) })),
    );
  };

  /** Puts things back exactly as they were in `before` (an undo). */
  const restore = (before: DropPaper, thoughtIds: string[], stackIds: string[]) => {
    update((p) => ({
      ...p,
      thoughts: [...p.thoughts.filter((t) => !thoughtIds.includes(t.id)), ...before.thoughts.filter((t) => thoughtIds.includes(t.id))],
      stacks: [...p.stacks.filter((s) => !stackIds.includes(s.id)), ...before.stacks.filter((s) => stackIds.includes(s.id))],
    }));
    briefly(setReturning, [...thoughtIds, ...stackIds], CRUMPLE_MS);
  };

  /**
   * Crumples it: the note scrunches up and rolls away, with a few seconds to
   * take it back. Nothing is sent until the undo window closes.
   */
  const crumple = (id: string) => {
    const t = live.current.thoughts.find((x) => x.id === id);
    if (!t || waiting.current.has(id)) return;
    const before = live.current;
    const siblings = t.stackId ? before.thoughts.filter((x) => x.stackId === t.stackId).map((x) => x.id) : [id];
    const stackIds = t.stackId ? [t.stackId] : [];
    playOut(id, "crumple", CRUMPLE_MS, () => update((p) => settleStacks({ ...p, thoughts: p.thoughts.filter((x) => x.id !== id) })));
    const send = () => {
      waiting.current.delete(id);
      void save(
        () => call(`/api/drop/thoughts/${id}`, { method: "DELETE", keepalive: true }),
        () => restore(before, siblings, stackIds),
      );
    };
    const timer = setTimeout(send, UNDO_MS);
    waiting.current.set(id, () => {
      clearTimeout(timer);
      send();
    });
    setToast({
      text: "Crumpled",
      undo: () => {
        clearTimeout(timer);
        waiting.current.delete(id);
        restore(before, siblings, stackIds);
        setToast(null);
      },
    });
  };

  /** Saves where thoughts and stacks were dragged (or, with null spots, sends them back into rows). */
  const arrange = (placements: { id: string; x: number | null; y: number | null }[], body: object) => {
    const before = live.current;
    const at = new Map(placements.map((p) => [p.id, p]));
    const moved = <T extends { id: string }>(x: T) => (at.has(x.id) ? { ...x, x: at.get(x.id)!.x, y: at.get(x.id)!.y } : x);
    update((p) => ({ ...p, thoughts: p.thoughts.map(moved), stacks: p.stacks.map(moved) }));
    void save(
      () => call("/api/drop/arrange", { method: "POST", body: JSON.stringify(body) }),
      () => update(() => before),
    );
  };
  const onArrange = (placements: Placement[]) => arrange(placements, { placements });
  const tidy = () => {
    const all = [...live.current.thoughts, ...live.current.stacks].map((x) => ({ id: x.id, x: null, y: null }));
    arrange(all, { tidy: true });
  };
  const arranged = paper.thoughts.some((t) => t.x !== null) || paper.stacks.some((s) => s.x !== null);

  /** Shows a change at once and saves it; puts it back if saving fails. */
  const stackOp = (op: StackOp) => {
    const before = live.current;
    try {
      update((p) => applyStackOp(p, op));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    void save(
      () => call("/api/drop/stacks", { method: "POST", body: JSON.stringify(op) }),
      () => update(() => before),
    );
  };

  const stackOnto = (thought: string, onto: string) => {
    const t = live.current.thoughts.find((x) => x.id === thought);
    // Let go back on its own stack: nothing changes.
    if (!t || t.stackId === onto) return;
    stackOp({ kind: "stack", thought, onto, newStackId: uid() });
    setHint(false);
  };

  const ink = (id: string, to: Kind) => {
    stackOp({ kind: "ink", thought: id, to });
    if (to === "pen") briefly(setInking, [id], 600);
  };

  /** Every thought back on the sheet, fanned out in a short row around where the stack was. */
  const unstack = (stackId: string) => {
    const s = live.current.stacks.find((x) => x.id === stackId);
    if (!s) return;
    const members = membersOf(live.current, stackId);
    const spots =
      s.x === null || s.y === null
        ? []
        : members.map((m, i) => ({ id: m.id, x: Math.min(0.95, Math.max(0.05, s.x! + (i - (members.length - 1) / 2) * 0.13)), y: s.y! + (i % 2) * 36 }));
    setOpenStack(null);
    stackOp({ kind: "unstack", stack: stackId, spots });
  };

  /** Throws the pile away, with a few seconds to change your mind. */
  const crumpleStack = (stackId: string) => {
    const stack = live.current.stacks.find((x) => x.id === stackId);
    if (!stack || waiting.current.has(stackId)) return;
    const before = live.current;
    const members = before.thoughts.filter((t) => t.stackId === stackId).map((t) => t.id);
    const op: StackOp = { kind: "crumple", stack: stackId };
    setOpenStack(null);
    playOut(stackId, "crumple", CRUMPLE_MS, () => update((p) => applyStackOp(p, op)));
    const send = () => {
      waiting.current.delete(stackId);
      void save(
        () => call("/api/drop/stacks", { method: "POST", body: JSON.stringify(op), keepalive: true }),
        () => restore(before, members, [stackId]),
      );
    };
    const timer = setTimeout(send, UNDO_MS);
    waiting.current.set(stackId, () => {
      clearTimeout(timer);
      send();
    });
    setToast({
      text: `Crumpled ${stack.name ?? `a stack of ${members.length}`}`,
      undo: () => {
        clearTimeout(timer);
        waiting.current.delete(stackId);
        restore(before, members, [stackId]);
        setToast(null);
      },
    });
  };

  /** Folds a thought or stack away till a day (it folds out of sight), or brings it back to today. */
  const schedule = (id: string, on: string | null) => {
    const was = live.current.thoughts.find((t) => t.id === id)?.scheduledFor ?? live.current.stacks.find((s) => s.id === id)?.scheduledFor ?? null;
    const op: StackOp = { kind: "schedule", id, on };
    if (on && on > live.current.date) {
      if (openStack === id) setOpenStack(null);
      playOut(id, "fold", FOLD_MS, () => stackOp(op));
      setToast({
        text: `Folded till ${whenLabel(on, live.current.date)}`,
        undo: () => {
          stackOp({ kind: "schedule", id, on: was });
          setToast(null);
        },
      });
    } else stackOp(op);
  };

  /** Sets a number (the others shift), or takes it off. */
  const setRank = (id: string, rank: number | null) => stackOp({ kind: "rank", id, rank });
  /** In number mode: the next number, or off if it has one. */
  const tapNumber = (id: string) => stackOp(tapRank(live.current, id));

  /** In number mode a tap numbers the thought instead of editing, striking or opening it. */
  const tapToNumber = (id: string, node: ReactNode) =>
    numbering ? (
      <div
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          tapNumber(id);
        }}
        onDoubleClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="cursor-pointer"
      >
        {node}
      </div>
    ) : (
      node
    );

  /** "Next: ②": brings that thought into view and selects it. */
  const focusItem = (id: string) => {
    const el = [...document.querySelectorAll<HTMLElement>(`[data-item="${id}"]`)].find((x) => x.offsetParent !== null);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.querySelector<HTMLElement>("[data-keys], button")?.focus({ preventScroll: true });
  };

  const handlers = (t: Thought) => ({
    onRank: t.stackId ? undefined : (r: number | null) => setRank(t.id, r),
    onEdit: (v: string) => patch(t.id, { text: v }),
    onToggle: () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => crumple(t.id),
    onStackWith: () => setPicking(t.id),
    onWhen: () => setWhenFor(t.id),
    onInk: () => ink(t.id, t.kind === "pencil" ? "pen" : "pencil"),
  });

  const whenOf = (x: { scheduledFor: string | null }) => (x.scheduledFor ? whenLabel(x.scheduledFor, paper.date) : undefined);

  const items = sheetItems(paper);
  const onSheet = items.filter((it) => isOpenItem(it) || settling.has(it.id) || leaving.has(it.id));
  const doneRow = items.filter((it) => !isOpenItem(it) && !settling.has(it.id) && !leaving.has(it.id));
  const { open, ideas, done } = counts(paper);
  const next = nextUp(paper);
  const folded = foldedItems(paper);
  const byId = new Map(paper.thoughts.map((t) => [t.id, t]));
  const looseOpen = onSheet.filter((it) => it.kind === "thought").length;
  const showHint = hint && paper.stacks.length === 0 && looseOpen >= 3;
  // Clear desk shows in the evening (or once the paper fills up); Shift+C always works.
  const evening = mounted && new Date().getHours() >= 18;
  const showClear = mounted && (evening || open >= 5) && open > 0;

  const dismissHint = () => {
    setHint(false);
    void call("/api/drop/prefs", { method: "POST", body: JSON.stringify({ stackHint: "dismiss" }) }).catch(() => {});
  };

  const stackMenu = (s: Stack) => [
    { label: "Unstack", onSelect: () => unstack(s.id) },
    { label: "Crumple stack", onSelect: () => crumpleStack(s.id) },
  ];

  const bubble = (t: Thought, extra: { stream?: boolean; movable?: boolean; target?: boolean } = {}) => (
    <ThoughtBubble
      {...bubbleProps(t, tz, fresh.has(t.id))}
      when={whenOf(t)}
      leaving={leaving.get(t.id) ?? null}
      returning={returning.has(t.id)}
      {...extra}
      {...handlers(t)}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader
        me={me}
        title={
          <>
            <h1 className="font-hand text-[26px] leading-none font-bold">{weekday(paper.date)}</h1>
            <span className="truncate text-[13px] text-mute" aria-live="polite">
              {longDate(paper.date)
                .replace(/^\w+, /, "")
                .replace(/ \w+$/, (m) => m.slice(0, 4))}
              {paper.thoughts.length ? ` · ${open} open${ideas ? ` · ${ideas} ${ideas === 1 ? "idea" : "ideas"}` : ""}${done ? ` · ${done} done` : ""}` : ""}
            </span>

          </>
        }
        right={
          <Link href="/drop/history" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
            History
          </Link>
        }
      />
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-3 pb-28 sm:px-8">
        {showHint && (
          <div role="note" className={`${COLUMN} flex items-center gap-3 rounded-2xl border border-line bg-sheet px-4 py-2.5 text-sm`}>
            <StackDemo />
            <span className="flex-1">
              <span className="font-medium">Drag one note onto another to stack them.</span> <span className="text-mute">Groceries, a trip, a project.</span>
            </span>
            <button type="button" onClick={dismissHint} aria-label="Dismiss the tip" className="flex size-9 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink">
              <CloseIcon size={11} />
            </button>
          </div>
        )}

        {next && !numbering && (
          <button
            type="button"
            onClick={() => focusItem(next.id)}
            className={`${COLUMN} flex items-center gap-3 rounded-2xl border border-red-text/40 bg-red-soft/40 px-3 py-2 text-left hover:bg-red-soft/70`}
          >
            <span className="text-[12px] font-semibold tracking-[0.08em] text-red-text uppercase">Next up</span>
            <RankMark n={next.rank} size="sm" />
            <span className="min-w-0 flex-1 truncate font-note text-[19px] text-ink">{next.label}</span>
            <span className="text-[13px] text-mute max-sm:hidden">Go to it →</span>
          </button>
        )}

        {numbering && (
          <div role="status" className={`${COLUMN} flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-red-text/30 bg-red-soft/50 px-4 py-2 text-sm`}>
            <span className="flex-1 font-medium">Tap thoughts in order, most important first · Esc to finish</span>
            <button type="button" onClick={() => setOrdering(true)} className="h-9 rounded-lg px-3 font-medium text-mute hover:bg-sheet hover:text-ink">
              Help me order
            </button>
            <button type="button" onClick={() => setNumbering(false)} className="h-9 rounded-lg bg-ink px-3.5 font-semibold text-bg">
              Done
            </button>
          </div>
        )}

        {onSheet.length === 0 ? (
          <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 items-center justify-center sm:min-h-[420px]`}>
            <span className="flex flex-col items-center gap-3 py-16 text-center">
              <StackDemo large />
              <span className="font-hand text-[34px] font-bold">{items.length ? "All struck. A clean sheet." : "A fresh sheet."}</span>
              <span className="text-mute">Press Space, or tap Write…, and put it down.</span>
            </span>
          </PaperSurface>
        ) : (
          <>
            <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 flex-col gap-3 sm:hidden`}>
              {onSheet.map((it) =>
                it.kind === "thought" ? (
                  <Fly key={it.id} from={flights.get(it.id)}>
                    <div data-item={it.id}>{tapToNumber(it.id, bubble(it.thought, { stream: true }))}</div>
                  </Fly>
                ) : (
                  <StreamStack
                    key={it.id}
                    numbering={numbering}
                    onNumberTap={() => tapNumber(it.id)}
                    stack={it.stack}
                    members={it.members}
                    when={whenOf(it.stack)}
                    open={openStack === it.id}
                    onToggleOpen={() => setOpenStack(openStack === it.id ? null : it.id)}
                    onRename={(name) => stackOp({ kind: "rename", stack: it.id, name })}
                    onWhen={() => setWhenFor(it.id)}
                    menu={stackMenu(it.stack)}
                    renderMember={(t) => bubble(t, { stream: true })}
                  />
                ),
              )}
            </PaperSurface>
            <div className={`${COLUMN} relative max-sm:hidden`}>
              <span className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNumbering(!numbering)}
                  aria-pressed={numbering}
                  title="Number it (Shift+N)"
                  className={`rounded-lg px-2.5 py-1 font-hand text-[16px] font-bold tracking-wide hover:bg-soft hover:text-ink ${numbering ? "bg-red-soft text-red-text" : "text-mute"}`}
                >
                  1 2 3
                </button>
                {arranged && (
                  <button type="button" onClick={tidy} className="rounded-lg px-2.5 py-1 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
                    Tidy up
                  </button>
                )}
              </span>
              <FreeCanvas
                label="Today's paper"
                items={onSheet}
                onArrange={onArrange}
                raised={openStack}
                canDropOn={(dragged) => byId.has(dragged)}
                onDropOn={stackOnto}
                onDetach={(id, at, pins) => {
                  stackOp({ kind: "takeOut", thought: id, x: at.x, y: at.y });
                  if (pins.length) onArrange(pins);
                }}
                renderGhost={(id) => {
                  const t = byId.get(id);
                  return t ? <ThoughtBubble {...bubbleProps(t, tz, false)} readOnly /> : null;
                }}
                render={(it, ctx) =>
                  it.kind === "thought" ? (
                    <Fly from={flights.get(it.id)}>
                      <div data-item={it.id} className={inking.has(it.id) ? "ink-in" : ""}>
                        {tapToNumber(it.id, bubble(it.thought, { movable: true, target: ctx.target }))}
                      </div>
                    </Fly>
                  ) : (
                    <div data-item={it.id}>
                    {tapToNumber(
                    it.id,
                    <StackCard
                      rank={it.stack.rank}
                      name={it.stack.name}
                      count={it.members.length}
                      done={it.members.filter((m) => m.status === "done").length}
                      top={topCard(it.members)}
                      peek={it.members.map((m) => m.text)}
                      carried={it.stack.carriedFrom ? weekday(it.stack.carriedFrom).slice(0, 3) : undefined}
                      when={whenOf(it.stack)}
                      open={openStack === it.id}
                      onToggleOpen={() => setOpenStack(openStack === it.id ? null : it.id)}
                      target={ctx.target}
                      leaving={leaving.get(it.id) ?? null}
                      onRename={(name) => stackOp({ kind: "rename", stack: it.id, name })}
                      onWhen={() => setWhenFor(it.id)}
                      menu={stackMenu(it.stack)}
                    >
                      {it.members.map((t) => (
                        <StackRow
                          key={t.id}
                          text={t.text}
                          done={t.status === "done"}
                          pencil={t.kind === "pencil"}
                          meta={meta(t, tz)}
                          when={whenOf(t)}
                          onGrab={ctx.grab(t.id)}
                          {...handlers(t)}
                        />
                      ))}
                    </StackCard>,
                    )}
                    </div>
                  )
                }
              />
            </div>
          </>
        )}

        <div className={`${COLUMN} flex flex-wrap items-center justify-between gap-2`}>
          <span className="flex items-center gap-1">
            {folded.length > 0 && <FoldedLine items={folded} today={paper.date} open={foldedOpen} onToggle={() => setFoldedOpen(!foldedOpen)} onUnfold={(id) => schedule(id, null)} />}
            {onSheet.length > 0 && (
              <button
                type="button"
                onClick={() => setNumbering(!numbering)}
                aria-pressed={numbering}
                className={`rounded-lg px-2.5 py-1.5 font-hand text-[16px] font-bold tracking-wide hover:bg-soft sm:hidden ${numbering ? "bg-red-soft text-red-text" : "text-mute"}`}
              >
                1 2 3
              </button>
            )}
          </span>
          {showClear && (
            <Link href="/drop/clear" className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
              Clear desk <kbd className="ml-1 rounded border border-line px-1 font-sans text-[11px] max-sm:hidden">⇧C</kbd>
            </Link>
          )}
        </div>

        {doneRow.length > 0 && (
          <section aria-label="Done today" className={`${COLUMN} flex flex-col gap-3`}>
            <h2 className="text-sm font-medium text-mute">Done today · {doneRow.reduce((n, it) => n + (it.kind === "stack" ? it.members.length : 1), 0)}</h2>
            <ul className="flex flex-wrap gap-2">
              {doneRow.map((it) =>
                it.kind === "thought" ? (
                  <DoneChip key={it.id} text={it.thought.text} onBringBack={() => patch(it.id, { status: "open" })} onDelete={() => crumple(it.id)} />
                ) : (
                  <DoneChip
                    key={it.id}
                    text={`${stackLabel(it.stack, it.members.length)} · ${it.members.length}`}
                    onBringBack={() => it.members.forEach((m) => patch(m.id, { status: "open" }))}
                    onDelete={() => crumpleStack(it.id)}
                  />
                ),
              )}
            </ul>
          </section>
        )}

        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike, left to crumple · hold to stack</p>
      </main>

      <PenButton ref={penButton} hidden={writing} onOpen={() => setWriting(true)} />
      {writing && mounted && <Writer draft={draft} onDraft={setDraft} kind={kind} onKind={setKind} onDrop={drop} onClose={closeWriter} />}

      {ordering && (
        <HelpOrder
          items={onSheet.filter(isOpenItem)}
          onClose={() => setOrdering(false)}
          onApply={(ids) => {
            setOrdering(false);
            stackOp({ kind: "order", ids });
          }}
        />
      )}

      {picking && (
        <StackPicker
          paper={paper}
          thought={picking}
          onRank={(r) => {
            const id = picking;
            setPicking(null);
            setRank(id, r);
          }}
          onClose={() => setPicking(null)}
          onPick={(onto) => {
            setPicking(null);
            stackOnto(picking, onto);
          }}
          onTakeOut={() => {
            setPicking(null);
            stackOp({ kind: "takeOut", thought: picking, x: null, y: null });
          }}
        />
      )}

      {whenFor && (
        <WhenPicker
          today={paper.date}
          current={byId.get(whenFor)?.scheduledFor ?? paper.stacks.find((s) => s.id === whenFor)?.scheduledFor ?? null}
          label={byId.get(whenFor)?.text ?? stackLabel(paper.stacks.find((s) => s.id === whenFor) ?? { name: null }, membersOf(paper, whenFor).length)}
          onClose={() => setWhenFor(null)}
          onPick={(on) => {
            const id = whenFor;
            setWhenFor(null);
            schedule(id, on);
          }}
        />
      )}

      {(toast || error) && (
        <div role={error ? "alert" : "status"} className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg">
          <span className="flex-1">{error || toast?.text}</span>
          {!error && toast?.undo ? (
            <button type="button" onClick={toast.undo} className="font-semibold underline-offset-2 hover:underline">
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setToast(null);
              }}
              className="font-semibold"
            >
              OK
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function bubbleProps(t: Thought, tz: string, fresh: boolean) {
  return {
    text: t.text,
    done: t.status === "done",
    kind: t.kind,
    shape: t.shape,
    seed: t.createdAt,
    meta: meta(t, tz),
    carried: t.carriedFrom ? weekday(t.carriedFrom).slice(0, 3) : undefined,
    rank: t.stackId ? null : t.rank,
    fresh,
  };
}

function topCard(members: Thought[]) {
  const t = members[0];
  return { text: t?.text ?? "", shape: t?.shape ?? 0, seed: t?.createdAt, done: t?.status === "done" };
}

/** A tiny looping picture of one note sliding onto another (still, with reduced motion). */
function StackDemo({ large = false }: { large?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${large ? "h-14 w-24" : "h-8 w-12"}`}>
      <span style={{ ...bubbleStyle(2, false, "demo-a") }} className="absolute top-1/2 left-0 h-[70%] w-[55%] -translate-y-1/2" />
      <span style={{ ...bubbleStyle(4, false, "demo-b") }} className="demo-slide absolute top-1/2 right-0 h-[70%] w-[55%] -translate-y-1/2" />
    </span>
  );
}

/** "2 folded for later": opens a small list by day, each one can come back to today. */
function FoldedLine({
  items,
  today,
  open,
  onToggle,
  onUnfold,
}: {
  items: { id: string; label: string; count: number; on: string; kind: "thought" | "stack" }[];
  today: string;
  open: boolean;
  onToggle: () => void;
  onUnfold: (id: string) => void;
}) {
  const days = [...new Set(items.map((i) => i.on))];
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={onToggle} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
        {items.length} folded for later {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 flex w-72 flex-col gap-3 rounded-2xl border border-line bg-sheet p-3 shadow-[0_18px_40px_-20px_var(--shadow)]">
          {days.map((d) => (
            <div key={d} className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-mute">{whenLabel(d, today)}</span>
              {items
                .filter((i) => i.on === d)
                .map((i) => (
                  <span key={i.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-note text-[15px]">
                      {i.label}
                      {i.kind === "stack" ? <span className="ml-1 font-sans text-[12px] text-mute">· {i.count}</span> : null}
                    </span>
                    <button type="button" onClick={() => onUnfold(i.id)} className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-medium text-mute hover:bg-soft hover:text-ink">
                      Unfold
                    </button>
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A struck thought (or a stack of them) in the "Done today" row: small and quiet. */
function DoneChip({ text, onBringBack, onDelete }: { text: string; onBringBack: () => void; onDelete: () => void }) {
  return (
    <li className="group is-done flex max-w-full items-center gap-1 rounded-full border border-line bg-soft py-1 pr-1 pl-3.5">
      <span className="pen-strike truncate font-note text-[15px] leading-tight">{text}</span>
      <button
        type="button"
        onClick={onBringBack}
        aria-label={`Bring back "${text}"`}
        title="Bring back"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] text-mute hover:bg-sheet hover:text-ink"
      >
        ↺
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Crumple "${text}"`}
        title="Crumple"
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-mute opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-sheet hover:text-red-text max-sm:opacity-100"
      >
        <CloseIcon size={10} />
      </button>
    </li>
  );
}

/** A stack in the phone stream: a collapsible group. */
function StreamStack({
  stack,
  members,
  when,
  numbering = false,
  onNumberTap,
  open,
  onToggleOpen,
  onRename,
  onWhen,
  menu,
  renderMember,
}: {
  stack: Stack;
  members: Thought[];
  when?: string;
  numbering?: boolean;
  onNumberTap?: () => void;
  open: boolean;
  onToggleOpen: () => void;
  onRename?: (name: string | null) => void;
  onWhen?: () => void;
  menu?: { label: string; onSelect: () => void }[];
  renderMember: (t: Thought) => ReactNode;
}) {
  const done = members.filter((m) => m.status === "done").length;
  const [draft, setDraft] = useState(stack.name ?? "");
  const look = bubbleStyle(members[0]?.shape ?? 0, false, members[0]?.createdAt);
  const summary = `${stack.name ? `${stack.name}, ` : ""}${members.length} thoughts${done ? `, ${done} done` : ""}, ${open ? "expanded" : "collapsed"}`;
  return (
    <div role="group" aria-label={summary} data-item={stack.id} className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={numbering && onNumberTap ? onNumberTap : onToggleOpen}
        style={{ ...look, transform: "none", boxShadow: `${look.boxShadow}, 4px 5px 0 -1px var(--soft)` }}
        className="paper-note flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {stack.rank ? <RankMark n={stack.rank} size="sm" /> : null}
        <span className="hand min-w-0 flex-1 truncate font-note text-[19px] leading-snug">{stack.name ?? members[0]?.text}</span>
        {when && <span className="text-[12px] font-medium text-mute">{when}</span>}
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full border border-line bg-sheet px-1.5 text-[12px] font-semibold">{members.length}</span>
        <span aria-hidden="true" className={`text-mute transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
          {onRename && (
            <input
              value={draft}
              maxLength={60}
              aria-label="Stack name"
              placeholder="Name this stack"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => (draft.trim() || null) !== stack.name && onRename(draft.trim() || null)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="h-11 rounded-xl border border-line bg-sheet px-3 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-mute"
            />
          )}
          {members.map((t) => (
            <div key={t.id}>{renderMember(t)}</div>
          ))}
          {(onWhen || menu) && (
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {onWhen && (
                <button type="button" onClick={onWhen} className="h-11 rounded-lg px-3 font-medium text-mute hover:bg-soft">
                  {when ? `When: ${when}` : "When…"}
                </button>
              )}
              {menu?.map((m) => (
                <button key={m.label} type="button" onClick={m.onSelect} className="h-11 rounded-lg px-3 font-medium text-mute hover:bg-soft">
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Keeps arrow keys moving between a dialog's buttons; Esc closes. */
function dialogKeys(onClose: () => void) {
  return (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };
}

/**
 * "Stack with…": the other thoughts and stacks on the sheet, nearest first.
 * A sheet on phones, a small dialog on wider screens. Arrows move, Enter picks, Esc closes.
 */
function StackPicker({
  paper,
  thought,
  onPick,
  onTakeOut,
  onRank,
  onClose,
}: {
  paper: DropPaper;
  thought: string;
  onPick: (onto: string) => void;
  onTakeOut: () => void;
  /** "Set number": shown for loose thoughts. */
  onRank?: (rank: number | null) => void;
  onClose: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const me = paper.thoughts.find((t) => t.id === thought);
  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  if (!me) return null;
  const home = me.stackId ? paper.stacks.find((s) => s.id === me.stackId) : null;
  const from = home ?? me;
  const distance = (it: SheetItem) =>
    from.x === null || from.y === null || it.x === null || it.y === null ? Number.POSITIVE_INFINITY : Math.hypot((it.x - from.x) * 1000, it.y - from.y);
  const options = sheetItems(paper)
    .filter((it) => it.id !== me.id && it.id !== me.stackId && isOpenItem(it))
    .sort((a, b) => distance(a) - distance(b));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stack with…"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={dialogKeys(onClose)}
      className="scrim-bg fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="flex max-h-[70dvh] w-full flex-col gap-3 rounded-t-[22px] border border-line bg-sheet p-4 shadow-[0_30px_60px_-30px_var(--shadow)] sm:max-w-sm sm:rounded-[22px]">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="font-hand text-[26px] leading-none font-bold">Stack with…</span>
          <span className="truncate text-[13px] text-mute">{me.text}</span>
        </div>
        {onRank && !me.stackId && (
          <div className="flex flex-col gap-1.5 px-1">
            <span className="text-[13px] font-medium text-mute">Set number</span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: MAX_RANK }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onRank(n)}
                  aria-pressed={me.rank === n}
                  className={`flex size-11 items-center justify-center rounded-full border font-hand text-[20px] font-bold ${me.rank === n ? "border-red-text bg-red-soft text-red-text" : "border-line hover:bg-soft"}`}
                >
                  {n}
                </button>
              ))}
              {me.rank && (
                <button type="button" onClick={() => onRank(null)} className="h-11 rounded-full px-3 text-sm font-medium text-mute hover:bg-soft">
                  Clear
                </button>
              )}
            </div>
            <span className="pt-1 text-[13px] font-medium text-mute">Stack with…</span>
          </div>
        )}
        <div ref={list} className="flex flex-col gap-1 overflow-y-auto">
          {me.stackId && (
            <button type="button" onClick={onTakeOut} className="rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-soft focus-visible:bg-soft">
              Take out of {home?.name ?? "the stack"}
            </button>
          )}
          {options.length === 0 && !me.stackId && <span className="px-3 py-2.5 text-sm text-mute">Nothing else on the sheet to stack with yet.</span>}
          {options.map((it) => (
            <button key={it.id} type="button" onClick={() => onPick(it.id)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-soft focus-visible:bg-soft">
              <span className="min-w-0 flex-1 truncate font-note text-[16px]">{it.kind === "thought" ? it.thought.text : stackLabel(it.stack, it.members.length)}</span>
              {it.kind === "stack" && <span className="text-[12px] text-mute">{it.members.length} thoughts</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="h-10 rounded-xl text-sm font-medium text-mute hover:bg-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * "Help me order": pick up to six, then answer "Which first?" for a few pairs
 * (a binary insertion, so six take at most ten questions). The result becomes
 * the numbers 1…n.
 */
function HelpOrder({ items, onApply, onClose }: { items: SheetItem[]; onApply: (ids: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(() => items.filter((it) => (it.kind === "thought" ? it.thought.rank : it.stack.rank) !== null).map((it) => it.id).slice(0, MAX_RANK));
  const [sort, setSort] = useState<{ sorted: string[]; rest: string[]; lo: number; hi: number } | null>(null);
  const label = (id: string) => {
    const it = items.find((x) => x.id === id);
    return !it ? "" : it.kind === "thought" ? it.thought.text : stackLabel(it.stack, it.members.length);
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_RANK ? [...p, id] : p));

  /** One answer: is the new one before the one it's being compared with? */
  const answer = (newFirst: boolean) => {
    if (!sort) return;
    const mid = Math.floor((sort.lo + sort.hi) / 2);
    let { lo, hi } = sort;
    if (newFirst) hi = mid;
    else lo = mid + 1;
    if (lo < hi) return setSort({ ...sort, lo, hi });
    const sorted = [...sort.sorted];
    sorted.splice(lo, 0, sort.rest[0]);
    const rest = sort.rest.slice(1);
    if (!rest.length) return onApply(sorted);
    setSort({ sorted, rest, lo: 0, hi: sorted.length });
  };

  const mid = sort ? Math.floor((sort.lo + sort.hi) / 2) : 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help me order"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={dialogKeys(onClose)}
      className="scrim-bg fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="flex max-h-[80dvh] w-full flex-col gap-3 rounded-t-[22px] border border-line bg-sheet p-4 shadow-[0_30px_60px_-30px_var(--shadow)] sm:max-w-md sm:rounded-[22px]">
        {!sort ? (
          <>
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="font-hand text-[26px] leading-none font-bold">Which ones matter today?</span>
              <span className="text-[13px] text-mute">
                {picked.length} of {MAX_RANK}
              </span>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {items.map((it) => (
                <label key={it.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-soft">
                  <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} className="size-4 accent-[var(--red)]" />
                  <span className="min-w-0 flex-1 truncate font-note text-[16px]">{label(it.id)}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-10 rounded-xl px-3 text-sm font-medium text-mute hover:bg-soft">
                Cancel
              </button>
              <button
                type="button"
                disabled={picked.length < 2}
                onClick={() => setSort({ sorted: [picked[0]], rest: picked.slice(1), lo: 0, hi: 1 })}
                className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-bg disabled:opacity-40"
              >
                Order these
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="px-1 font-hand text-[28px] leading-none font-bold">Which first?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => answer(true)} className="min-h-20 rounded-2xl border border-line bg-bg px-4 py-3 text-left font-note text-[18px] hover:bg-soft">
                {label(sort.rest[0])}
              </button>
              <button type="button" onClick={() => answer(false)} className="min-h-20 rounded-2xl border border-line bg-bg px-4 py-3 text-left font-note text-[18px] hover:bg-soft">
                {label(sort.sorted[mid])}
              </button>
            </div>
            <span className="px-1 text-[13px] text-mute">
              {sort.sorted.length} of {sort.sorted.length + sort.rest.length} in order
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * "When": today, tomorrow, this weekend, or a day on the calendar (past days
 * can't be picked); Clear brings it back to no particular day.
 */
function WhenPicker({ today, current, label, onPick, onClose }: { today: string; current: string | null; label: string; onPick: (on: string | null) => void; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(current && current > today ? current : addDays(today, 2));
  useEffect(() => {
    list.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  const weekend = thisWeekend(today);
  const options: { label: string; hint: string; on: string }[] = [
    { label: "Today", hint: shortDate(today), on: today },
    { label: "Tomorrow", hint: shortDate(addDays(today, 1)), on: addDays(today, 1) },
    ...(weekend !== today && weekend !== addDays(today, 1) ? [{ label: "This weekend", hint: shortDate(weekend), on: weekend }] : []),
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`When is "${label}" for?`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={dialogKeys(onClose)}
      className="scrim-bg fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="flex w-full flex-col gap-3 rounded-t-[22px] border border-line bg-sheet p-4 shadow-[0_30px_60px_-30px_var(--shadow)] sm:max-w-sm sm:rounded-[22px]">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="font-hand text-[26px] leading-none font-bold">When?</span>
          <span className="truncate text-[13px] text-mute">{label}</span>
        </div>
        <div ref={list} className="flex flex-col gap-1">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => onPick(o.on)}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-soft focus-visible:bg-soft ${current === o.on ? "bg-soft" : ""}`}
            >
              <span className="font-medium">{o.label}</span>
              <span className="text-[13px] text-mute">{o.hint}</span>
            </button>
          ))}
          <form
            className="flex items-center gap-2 px-1 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (date >= today) onPick(date);
            }}
          >
            <label className="flex flex-1 flex-col gap-1 text-[13px] font-medium text-mute">
              Pick a date
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-xl border border-line bg-bg px-3 text-[15px] text-ink outline-none"
              />
            </label>
            <button type="submit" className="mt-5 h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-bg">
              Fold
            </button>
          </form>
          {current && (
            <button type="button" onClick={() => onPick(null)} className="mt-1 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mute hover:bg-soft focus-visible:bg-soft">
              Clear (no particular day)
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="h-10 rounded-xl text-sm font-medium text-mute hover:bg-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- History ---------- */

export function HistoryList({ me, papers }: { me: Me; papers: { date: string; total: number; done: number; cleared: boolean }[] }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader me={me} />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-4 pt-4 pb-16 sm:px-8">
        <div className="flex items-center justify-between">
          <h1 className="font-hand text-[44px] leading-none font-bold">Past papers</h1>
          <Link href="/drop" className="text-sm font-semibold">
            Today →
          </Link>
        </div>
        {papers.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-line p-6 text-mute">No past papers yet. Today&apos;s will show up here tomorrow.</p>
        ) : (
          <ul className="flex flex-col rounded-[20px] border border-line bg-sheet">
            {papers.map((p, i) => (
              <li key={p.date} className={i < papers.length - 1 ? "border-b border-line" : ""}>
                <Link href={`/drop/history/${p.date}`} className="flex items-center gap-3 px-5 py-4 hover:bg-soft">
                  <span className="flex-1 font-medium">{longDate(p.date)}</span>
                  {p.cleared && <DeskStamp date={shortDate(p.date)} small />}
                  <span className="text-sm text-mute">
                    {p.total} {p.total === 1 ? "thought" : "thoughts"}
                    {p.done ? ` · ${p.done} struck` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export function HistoryPaper({ me, paper }: { me: Me; paper: DropPaper }) {
  const tz = useViewerTz();
  const [openStack, setOpenStack] = useState<string | null>(null);
  const items = sheetItems(paper);
  const toggle = (id: string) => setOpenStack(openStack === id ? null : id);
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader me={me} />
      <main className="flex w-full flex-1 flex-col gap-5 px-4 pt-3 pb-12 sm:px-8">
        <div className={`${COLUMN} flex flex-wrap items-center justify-between gap-3`}>
          <span className="flex items-center gap-4">
            <h1 className="font-hand text-[40px] leading-none font-bold">{shortDate(paper.date)}</h1>
            {paper.clearedAt && <DeskStamp date={shortDate(paper.date)} small />}
          </span>
          <Link href="/drop/history" className="text-sm font-semibold">
            ← All papers
          </Link>
        </div>
        <span className={`${COLUMN} text-sm text-mute`}>
          Read-only · {paper.thoughts.filter((t) => t.status === "done").length} of {paper.thoughts.length} struck
        </span>
        <PaperSurface label={`Paper for ${longDate(paper.date)}`} className={`${COLUMN} flex flex-col gap-3 sm:hidden`}>
          {items.map((it) =>
            it.kind === "thought" ? (
              <ThoughtBubble key={it.id} {...bubbleProps(it.thought, tz, false)} stream readOnly />
            ) : (
              <StreamStack
                key={it.id}
                stack={it.stack}
                members={it.members}
                open={openStack === it.id}
                onToggleOpen={() => toggle(it.id)}
                renderMember={(t) => <ThoughtBubble {...bubbleProps(t, tz, false)} stream readOnly />}
              />
            ),
          )}
        </PaperSurface>
        <FreeCanvas
          label={`Paper for ${longDate(paper.date)}`}
          className={`${COLUMN} max-sm:hidden`}
          items={items}
          raised={openStack}
          render={(it) =>
            it.kind === "thought" ? (
              <ThoughtBubble {...bubbleProps(it.thought, tz, false)} readOnly />
            ) : (
              <StackCard
                name={it.stack.name}
                count={it.members.length}
                done={it.members.filter((m) => m.status === "done").length}
                top={topCard(it.members)}
                peek={it.members.map((m) => m.text)}
                rank={it.stack.rank}
                open={openStack === it.id}
                onToggleOpen={() => toggle(it.id)}
              >
                {it.members.map((t) => (
                  <StackRow key={t.id} text={t.text} done={t.status === "done"} pencil={t.kind === "pencil"} meta={meta(t, tz)} readOnly />
                ))}
              </StackCard>
            )
          }
        />
      </main>
    </div>
  );
}
