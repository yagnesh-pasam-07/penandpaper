"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { bubbleStyle } from "@/components/canvas/bubble";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { Fly } from "@/components/canvas/fly";
import { StackCard } from "@/components/canvas/stack-card";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { CloseIcon, PenIcon } from "@/components/icons";
import { AccountMenu, Logo, ThemeToggle } from "@/components/ui";
import { uid } from "@/lib/mutations";
import { useStore } from "@/lib/store";
import { browserTz, clock, longDate, shortDate, weekday } from "@/lib/time";
import { applyStackOp, membersOf, settleStacks, stackLabel, type DropPaper, type Stack, type StackOp, type Thought } from "./logic";
import { PenButton, Writer } from "./writer";

type Me = { name: string; email: string };

/** The reading column for headings and the input; the sheet itself spreads wider. */
const COLUMN = "mx-auto w-full max-w-[1056px]";

const noSubscribe = () => () => {};
/** The viewer's time zone; "UTC" while the server renders, so hydration matches. */
function useViewerTz(): string {
  return useSyncExternalStore(noSubscribe, browserTz, () => "UTC");
}

/* ---------- Chrome ---------- */

/** One slim row: logo, the day (when there is one), then History, theme and the account. */
function DropHeader({ me, title, right }: { me: Me; title?: ReactNode; right?: ReactNode }) {
  const router = useRouter();
  const signOut = useStore((s) => s.signOut);
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center gap-3 px-4 pt-4 pb-1 sm:px-8">
      <Link href="/drop" aria-label="Today's paper" className="shrink-0">
        <span className="max-sm:hidden">
          <Logo size="sm" />
        </span>
        <span className="text-red-text sm:hidden">
          <PenIcon size={22} />
        </span>
      </Link>
      {title && (
        <>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line max-sm:hidden" />
          <div className="flex min-w-0 items-baseline gap-2">{title}</div>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {right}
        <ThemeToggle />
        <AccountMenu
          name={me.name}
          email={me.email}
          onSignOut={async () => {
            await signOut();
            router.push("/");
          }}
        />
      </span>
    </header>
  );
}

function meta(t: Thought, tz: string): string {
  return clock(new Date(t.createdAt), tz);
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  if (res.status === 401) {
    // A full load on purpose: the session is gone, so nothing on screen should survive.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?next=/drop";
    throw new Error("Signed out.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Couldn't reach your paper. Check your connection.");
  }
  return (res.status === 204 ? null : res.json()) as Promise<T>;
}

/* ---------- Today's paper ---------- */

/** One thing on the sheet: a loose thought or a stack of them. */
type SheetItem =
  | { kind: "thought"; id: string; x: number | null; y: number | null; at: string; thought: Thought }
  | { kind: "stack"; id: string; x: number | null; y: number | null; at: string; stack: Stack; members: Thought[] };

/** Loose thoughts and stacks, newest first (right under the pen). */
function sheetItems(paper: DropPaper): SheetItem[] {
  const loose: SheetItem[] = paper.thoughts
    .filter((t) => !t.stackId)
    .map((t) => ({ kind: "thought", id: t.id, x: t.x, y: t.y, at: t.createdAt, thought: t }));
  const stacks: SheetItem[] = paper.stacks.map((s) => ({ kind: "stack", id: s.id, x: s.x, y: s.y, at: s.createdAt, stack: s, members: membersOf(paper, s.id) }));
  const order = new Map(paper.thoughts.map((t, i) => [t.id, i]));
  // Thoughts keep the order they were dropped in; a stack sits where it was made.
  const rank = (it: SheetItem) => (it.kind === "thought" ? (order.get(it.id) ?? 0) : Math.max(...it.members.map((m) => order.get(m.id) ?? 0)));
  return [...loose, ...stacks].sort((a, b) => rank(b) - rank(a));
}

const isOpenItem = (it: SheetItem) => (it.kind === "thought" ? it.thought.status === "open" : it.members.some((m) => m.status === "open"));

const DRAFT_KEY = "pp-drop-draft";

function readDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Undo window for crumpling a stack. */
const UNDO_MS = 6000;

type Toast = { text: string; undo?: () => void };

export function DropCanvas({ initial, me }: { initial: DropPaper; me: Me }) {
  const [paper, setPaper] = useState(initial);
  // The latest paper, updated in step with every change so quick ones in a row build on each other.
  const live = useRef(initial);
  const update = useCallback((change: (p: DropPaper) => DropPaper) => {
    live.current = change(live.current);
    setPaper(live.current);
  }, []);
  // The writer: open, and what's half-written in it (kept on close, and across reloads on this device).
  const [writing, setWriting] = useState(initial.thoughts.length === 0);
  const [draft, setDraft] = useState(readDraft);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, draft);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [draft]);
  // Where each new note was written, so it can fly from there to its place.
  const [flights, setFlights] = useState<Map<string, { x: number; y: number }>>(new Map());
  const penButton = useRef<HTMLButtonElement>(null);
  // The draft lives in this browser only, so the writer appears once the page is live.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  // Just struck: stays on the sheet long enough to see the pen line, then sinks to "done today".
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const [openStack, setOpenStack] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const pending = useRef(0);
  // Saves go out one at a time, in order: drops land in the order typed, and
  // an edit never overtakes the drop it edits.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Crumples waiting out their undo window; sent at once if the page goes away.
  const waiting = useRef(new Map<string, () => void>());
  const tz = useViewerTz();

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
  useEffect(() => {
    const open = (first?: string) => {
      if (first) setDraft((d) => d + first);
      setWriting(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      // A selected thought keeps S ("Stack with…") for itself.
      if (el?.closest("[data-keys]") && e.key.toLowerCase() === "s") return;
      if (e.key === " ") {
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
  }, []);

  const closeWriter = () => {
    setWriting(false);
    // Back to where writing started.
    requestAnimationFrame(() => penButton.current?.focus());
  };

  const settle = (ids: string[]) => {
    setSettling((s) => new Set([...s, ...ids]));
    setTimeout(
      () =>
        setSettling((s) => {
          const next = new Set(s);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
      900,
    );
  };

  const drop = (value: string, from: { x: number; y: number }) => {
    const thought: Thought = {
      id: uid(),
      text: value,
      status: "open",
      shape: Math.floor(Math.random() * 6),
      createdAt: new Date().toISOString(),
      doneAt: null,
      carriedFrom: null,
      x: null,
      y: null,
      stackId: null,
      stackOrder: 0,
    };
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    setFlights((m) => new Map(m).set(thought.id, from));
    setDraft("");
    void save(
      () => call("/api/drop/thoughts", { method: "POST", body: JSON.stringify({ id: thought.id, text: thought.text, shape: thought.shape }) }),
      () => {
        update((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== thought.id) }));
        setDraft((current) => current || value);
      },
    );
  };

  const patch = (id: string, change: Partial<Pick<Thought, "text" | "status">>) => {
    const before = live.current.thoughts.find((t) => t.id === id);
    if (!before) return;
    const after = { ...before, ...change, doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt };
    update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? after : t)) }));
    if (change.status === "done") {
      // The last open one in a stack: the whole stack gets out of the way too.
      const lastInStack = before.stackId && live.current.thoughts.every((t) => t.stackId !== before.stackId || t.status === "done");
      settle(lastInStack ? [id, before.stackId!] : [id]);
    }
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
      () => update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? before : t)) })),
    );
  };

  const remove = (id: string) => {
    const before = live.current;
    if (!before.thoughts.some((t) => t.id === id)) return;
    update((p) => settleStacks({ ...p, thoughts: p.thoughts.filter((t) => t.id !== id) }));
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "DELETE" }),
      () => update(() => before),
    );
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

  /** Shows a stack change at once and saves it; puts it back if saving fails. */
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
  };

  /** Every thought back on the sheet, fanned out in a short row around where the stack was. */
  const unstack = (stackId: string) => {
    const s = live.current.stacks.find((x) => x.id === stackId);
    if (!s) return;
    const members = membersOf(live.current, stackId);
    const spots =
      s.x === null || s.y === null
        ? []
        : members.map((m, i) => ({
            id: m.id,
            x: Math.min(0.95, Math.max(0.05, s.x! + (i - (members.length - 1) / 2) * 0.13)),
            y: Math.max(0, s.y! + (i % 2) * 36),
          }));
    setOpenStack(null);
    stackOp({ kind: "unstack", stack: stackId, spots });
  };

  /** Throws the pile away, with a few seconds to change your mind. */
  const crumpleStack = (stackId: string) => {
    const stack = live.current.stacks.find((x) => x.id === stackId);
    if (!stack) return;
    const members = live.current.thoughts.filter((t) => t.stackId === stackId);
    const op: StackOp = { kind: "crumple", stack: stackId };
    update((p) => applyStackOp(p, op));
    setOpenStack(null);
    const send = () => {
      waiting.current.delete(stackId);
      void save(
        () => call("/api/drop/stacks", { method: "POST", body: JSON.stringify(op), keepalive: true }),
        () => update((p) => ({ ...p, stacks: [...p.stacks, stack], thoughts: [...p.thoughts, ...members] })),
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
        update((p) => ({ ...p, stacks: [...p.stacks, stack], thoughts: [...p.thoughts, ...members] }));
        setToast(null);
      },
    });
  };

  const handlers = (t: Thought) => ({
    onEdit: (v: string) => patch(t.id, { text: v }),
    onToggle: () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => remove(t.id),
    onStackWith: () => setPicking(t.id),
  });

  const items = sheetItems(paper);
  const onSheet = items.filter((it) => isOpenItem(it) || settling.has(it.id));
  const doneRow = items.filter((it) => !isOpenItem(it) && !settling.has(it.id));
  const struck = paper.thoughts.filter((t) => t.status === "done").length;
  const open = paper.thoughts.length - struck;
  const byId = new Map(paper.thoughts.map((t) => [t.id, t]));

  const stackMenu = (s: Stack) => [
    { label: "Unstack", onSelect: () => unstack(s.id) },
    { label: "Crumple stack", onSelect: () => crumpleStack(s.id) },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader
        me={me}
        title={
          <>
            <h1 className="font-hand text-[26px] leading-none font-bold">{weekday(paper.date)}</h1>
            <span className="truncate text-[13px] text-mute" aria-live="polite">
              {longDate(paper.date).replace(/^\w+, /, "").replace(/ \w+$/, (m) => m.slice(0, 4))}
              {paper.thoughts.length ? ` · ${open} open${struck ? ` · ${struck} done` : ""}` : ""}
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
        {onSheet.length === 0 ? (
          <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 items-center justify-center sm:min-h-[420px]`}>
            <span className="flex flex-col items-center gap-1 py-16 text-center">
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
                    <ThoughtBubble {...bubbleProps(it.thought, tz, fresh.has(it.id) && !flights.has(it.id))} stream {...handlers(it.thought)} />
                  </Fly>
                ) : (
                  <StreamStack
                    key={it.id}
                    stack={it.stack}
                    members={it.members}
                    open={openStack === it.id}
                    onToggleOpen={() => setOpenStack(openStack === it.id ? null : it.id)}
                    onRename={(name) => stackOp({ kind: "rename", stack: it.id, name })}
                    menu={stackMenu(it.stack)}
                    renderMember={(t) => <ThoughtBubble {...bubbleProps(t, tz, false)} stream {...handlers(t)} />}
                  />
                ),
              )}
            </PaperSurface>
            <div className={`${COLUMN} relative max-sm:hidden`}>
              {arranged && (
                <button
                  type="button"
                  onClick={tidy}
                  className="absolute top-2 right-2 z-10 rounded-lg px-2.5 py-1 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink"
                >
                  Tidy up
                </button>
              )}
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
                  return t ? <ThoughtBubble {...bubbleProps(t, tz, false)} stream readOnly /> : null;
                }}
                render={(it, ctx) =>
                  it.kind === "thought" ? (
                    <Fly from={flights.get(it.id)}>
                      <ThoughtBubble {...bubbleProps(it.thought, tz, fresh.has(it.id) && !flights.has(it.id))} movable target={ctx.target} {...handlers(it.thought)} />
                    </Fly>
                  ) : (
                    <StackCard
                      name={it.stack.name}
                      count={it.members.length}
                      done={it.members.filter((m) => m.status === "done").length}
                      top={topCard(it.members)}
                      carried={it.stack.carriedFrom ? weekday(it.stack.carriedFrom).slice(0, 3) : undefined}
                      open={openStack === it.id}
                      onToggleOpen={() => setOpenStack(openStack === it.id ? null : it.id)}
                      target={ctx.target}
                      onRename={(name) => stackOp({ kind: "rename", stack: it.id, name })}
                      menu={stackMenu(it.stack)}
                    >
                      {it.members.map((t) => (
                        <div key={t.id} onPointerDown={ctx.grab(t.id)} className="cursor-grab touch-none active:cursor-grabbing">
                          <ThoughtBubble {...bubbleProps(t, tz, false)} stream {...handlers(t)} />
                        </div>
                      ))}
                    </StackCard>
                  )
                }
              />
            </div>
          </>
        )}

        {doneRow.length > 0 && (
          <section aria-label="Done today" className={`${COLUMN} flex flex-col gap-3`}>
            <h2 className="text-sm font-medium text-mute">Done today · {doneRow.reduce((n, it) => n + (it.kind === "stack" ? it.members.length : 1), 0)}</h2>
            <ul className="flex flex-wrap gap-2">
              {doneRow.map((it) =>
                it.kind === "thought" ? (
                  <DoneChip
                    key={it.id}
                    text={it.thought.text}
                    onBringBack={() => patch(it.id, { status: "open" })}
                    onDelete={() => remove(it.id)}
                  />
                ) : (
                  <DoneChip
                    key={it.id}
                    text={`${stackLabel(it.stack, it.members.length)} · ${it.members.length}`}
                    onBringBack={() => it.members.forEach((m) => patch(m.id, { status: "open" }))}
                    onDelete={() => crumpleStack(it.id)}
                    deleteLabel="Crumple"
                  />
                ),
              )}
            </ul>
          </section>
        )}

        <p className="hidden text-center text-[13px] text-mute sm:block">
          Space or just type to write · drag onto another to stack · double-click to strike · emailed at 9 PM
        </p>
        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike · hold to stack · emailed at 9 PM</p>
      </main>

      <PenButton ref={penButton} hidden={writing} onOpen={() => setWriting(true)} />
      {writing && hydrated && <Writer draft={draft} onDraft={setDraft} onDrop={drop} onClose={closeWriter} />}

      {picking && (
        <StackPicker
          paper={paper}
          thought={picking}
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

      {(toast || error) && (
        <div role={error ? "alert" : "status"} className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg">
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
  return { text: t.text, done: t.status === "done", shape: t.shape, seed: t.createdAt, meta: meta(t, tz), carried: t.carriedFrom ? weekday(t.carriedFrom).slice(0, 3) : undefined, fresh };
}

function topCard(members: Thought[]) {
  const t = members[0];
  return { text: t?.text ?? "", shape: t?.shape ?? 0, seed: t?.createdAt, done: t?.status === "done" };
}

/** A struck thought (or a stack of them) in the "Done today" row: small and quiet. */
function DoneChip({ text, onBringBack, onDelete, deleteLabel = "Delete" }: { text: string; onBringBack: () => void; onDelete: () => void; deleteLabel?: string }) {
  return (
    <li className="group is-done flex max-w-full items-center gap-1 rounded-full border border-line bg-soft py-1 pr-1 pl-3.5">
      <span className="pen-strike truncate font-hand text-[17px] leading-tight">{text}</span>
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
        aria-label={`${deleteLabel} "${text}"`}
        title={deleteLabel}
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
  open,
  onToggleOpen,
  onRename,
  menu,
  renderMember,
}: {
  stack: Stack;
  members: Thought[];
  open: boolean;
  onToggleOpen: () => void;
  onRename?: (name: string | null) => void;
  menu?: { label: string; onSelect: () => void }[];
  renderMember: (t: Thought) => ReactNode;
}) {
  const done = members.filter((m) => m.status === "done").length;
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState(stack.name ?? "");
  const look = bubbleStyle(members[0]?.shape ?? 0, false, members[0]?.createdAt);
  const summary = `${stack.name ? `${stack.name}, ` : ""}${members.length} thoughts${done ? `, ${done} done` : ""}, ${open ? "expanded" : "collapsed"}`;
  return (
    <div role="group" aria-label={summary} className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggleOpen}
        style={{ ...look, transform: "none", boxShadow: `${look.boxShadow}, 4px 5px 0 -1px var(--soft)` }}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          {stack.name && <span className="text-[13px] font-medium text-mute">{stack.name}</span>}
          <span className="truncate font-hand text-[22px] leading-snug font-semibold">{members[0]?.text}</span>
        </span>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full border border-line bg-sheet px-1.5 text-[12px] font-semibold">{members.length}</span>
        <span aria-hidden="true" className={`text-mute transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
          {members.map((t) => (
            <div key={t.id}>{renderMember(t)}</div>
          ))}
          {(onRename || menu) && (
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {onRename &&
                (naming ? (
                  <input
                    autoFocus
                    value={draft}
                    maxLength={60}
                    aria-label="Stack name"
                    placeholder="Name this stack"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      setNaming(false);
                      if ((draft.trim() || null) !== stack.name) onRename(draft.trim() || null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="h-9 rounded-lg border border-line bg-sheet px-2.5 outline-none"
                  />
                ) : (
                  <button type="button" onClick={() => setNaming(true)} className="h-9 rounded-lg px-2.5 font-medium text-mute hover:bg-soft">
                    {stack.name ? "Rename" : "Name"}
                  </button>
                ))}
              {menu?.map((m) => (
                <button key={m.label} type="button" onClick={m.onSelect} className="h-9 rounded-lg px-2.5 font-medium text-mute hover:bg-soft">
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

/**
 * "Stack with…": the other thoughts and stacks on the sheet, nearest first.
 * A sheet on phones, a small dialog on wider screens. Arrows move, Enter picks, Esc closes.
 */
function StackPicker({
  paper,
  thought,
  onPick,
  onTakeOut,
  onClose,
}: {
  paper: DropPaper;
  thought: string;
  onPick: (onto: string) => void;
  onTakeOut: () => void;
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
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}
      className="scrim-bg fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div className="flex max-h-[70dvh] w-full flex-col gap-3 rounded-t-[22px] border border-line bg-sheet p-4 shadow-[0_30px_60px_-30px_var(--shadow)] sm:max-w-sm sm:rounded-[22px]">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="font-hand text-[26px] leading-none font-bold">Stack with…</span>
          <span className="truncate text-[13px] text-mute">{me.text}</span>
        </div>
        <div ref={list} className="flex flex-col gap-1 overflow-y-auto">
          {me.stackId && (
            <button type="button" onClick={onTakeOut} className="rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-soft focus-visible:bg-soft">
              Take out of {home?.name ?? "the stack"}
            </button>
          )}
          {options.length === 0 && !me.stackId && <span className="px-3 py-2.5 text-sm text-mute">Nothing else on the sheet to stack with yet.</span>}
          {options.map((it) => (
            <button key={it.id} type="button" onClick={() => onPick(it.id)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-soft focus-visible:bg-soft">
              <span className="min-w-0 flex-1 truncate font-hand text-[19px]">
                {it.kind === "thought" ? it.thought.text : stackLabel(it.stack, it.members.length)}
              </span>
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

/* ---------- History ---------- */

export function HistoryList({ me, papers }: { me: Me; papers: { date: string; total: number; done: number }[] }) {
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
        <div className={`${COLUMN} flex flex-wrap items-baseline justify-between gap-3`}>
          <h1 className="font-hand text-[40px] leading-none font-bold">{shortDate(paper.date)}</h1>
          <Link href="/drop/history" className="text-sm font-semibold">
            ← All papers
          </Link>
        </div>
        <span className={`${COLUMN} text-sm text-mute`}>Read-only · {paper.thoughts.filter((t) => t.status === "done").length} of {paper.thoughts.length} struck</span>
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
                open={openStack === it.id}
                onToggleOpen={() => toggle(it.id)}
              >
                {it.members.map((t) => (
                  <ThoughtBubble key={t.id} {...bubbleProps(t, tz, false)} stream readOnly />
                ))}
              </StackCard>
            )
          }
        />
      </main>
    </div>
  );
}
