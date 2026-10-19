"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { CloseIcon, PenIcon } from "@/components/icons";
import { AccountMenu, Logo, ThemeToggle } from "@/components/ui";
import { uid } from "@/lib/mutations";
import { useStore } from "@/lib/store";
import { browserTz, clock, longDate, shortDate, weekday } from "@/lib/time";
import { MAX_THOUGHT, type DropPaper, type Thought } from "./logic";

type Me = { name: string; email: string };

/** The reading column for headings and the input; the sheet itself spreads wider. */
const COLUMN = "mx-auto w-full max-w-[1056px]";

const noSubscribe = () => () => {};
/** The viewer's time zone; "UTC" while the server renders, so hydration matches. */
function useViewerTz(): string {
  return useSyncExternalStore(noSubscribe, browserTz, () => "UTC");
}

/* ---------- Chrome ---------- */

function DropHeader({ me, right }: { me: Me; right?: ReactNode }) {
  const router = useRouter();
  const signOut = useStore((s) => s.signOut);
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 pt-5 pb-2 sm:px-8">
      <Link href="/drop" aria-label="Today's paper">
        <Logo size="sm" />
      </Link>
      <span className="flex items-center gap-1.5">
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

export function DropCanvas({ initial, me }: { initial: DropPaper; me: Me }) {
  const [paper, setPaper] = useState(initial);
  const [text, setText] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  // Just struck: stays on the sheet long enough to see the pen line, then sinks to "done today".
  const [settling, setSettling] = useState<Set<string>>(new Set());
  const pending = useRef(0);
  // Saves go out one at a time, in order: drops land in the order typed, and
  // an edit never overtakes the drop it edits.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(true);
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
      if (document.visibilityState !== "visible" || pending.current > 0) return;
      try {
        const next = await call<DropPaper>("/api/drop/today");
        if (pending.current === 0) setPaper(next);
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
  }, []);

  // Keyboard first: Space (or simply typing) puts the cursor in the drop box
  // from anywhere on the page, so a thought never needs the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      const box = input.current;
      if (!box) return;
      if (e.key === " ") {
        // A focused button or link keeps Space for itself.
        if (el?.closest("button, a, summary")) return;
        e.preventDefault();
        box.focus();
      } else if (e.key.length === 1) {
        // Focus moves before the key lands, so the letter is typed into the box.
        box.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const drop = () => {
    const value = text.trim().slice(0, MAX_THOUGHT);
    if (!value) return;
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
    };
    setPaper((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    setText("");
    input.current?.focus();
    void save(
      () => call("/api/drop/thoughts", { method: "POST", body: JSON.stringify({ id: thought.id, text: thought.text, shape: thought.shape }) }),
      () => {
        setPaper((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== thought.id) }));
        setText((current) => current || value);
      },
    );
  };

  const patch = (id: string, change: Partial<Pick<Thought, "text" | "status">>) => {
    const before = paper.thoughts.find((t) => t.id === id);
    if (!before) return;
    const after = { ...before, ...change, doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt };
    setPaper((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? after : t)) }));
    if (change.status === "done") {
      setSettling((s) => new Set(s).add(id));
      setTimeout(() => setSettling((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      }), 900);
    }
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
      () => setPaper((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? before : t)) })),
    );
  };

  const remove = (id: string) => {
    const index = paper.thoughts.findIndex((t) => t.id === id);
    const before = paper.thoughts[index];
    if (!before) return;
    setPaper((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== id) }));
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "DELETE" }),
      () =>
        setPaper((p) => {
          const thoughts = [...p.thoughts];
          thoughts.splice(index, 0, before);
          return { ...p, thoughts };
        }),
    );
  };

  /** Saves where thoughts were dragged (or, with null spots, sends them back into rows). */
  const arrange = (placements: { id: string; x: number | null; y: number | null }[], body: object) => {
    const before = paper.thoughts;
    const at = new Map(placements.map((p) => [p.id, p]));
    setPaper((p) => ({ ...p, thoughts: p.thoughts.map((t) => (at.has(t.id) ? { ...t, x: at.get(t.id)!.x, y: at.get(t.id)!.y } : t)) }));
    void save(
      () => call("/api/drop/arrange", { method: "POST", body: JSON.stringify(body) }),
      () => setPaper((p) => ({ ...p, thoughts: before })),
    );
  };
  const onArrange = (placements: Placement[]) => arrange(placements, { placements });
  const tidy = () => {
    const all = paper.thoughts.map((t) => ({ id: t.id, x: null, y: null }));
    arrange(all, { tidy: true });
  };
  const arranged = paper.thoughts.some((t) => t.x !== null);

  // Newest first, right under the pen. Done ones get out of the way.
  const shown = [...paper.thoughts].reverse();
  const onSheet = shown.filter((t) => t.status === "open" || settling.has(t.id));
  const doneRow = shown.filter((t) => t.status === "done" && !settling.has(t.id));
  const handlers = (t: Thought) => ({
    onEdit: (v: string) => patch(t.id, { text: v }),
    onToggle: () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => remove(t.id),
  });
  const struck = paper.thoughts.filter((t) => t.status === "done").length;
  const open = paper.thoughts.length - struck;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader
        me={me}
        right={
          <Link href="/drop/history" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
            History
          </Link>
        }
      />
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-3 pb-10 sm:gap-5 sm:px-8">
        <div className={`${COLUMN} flex items-baseline justify-between gap-3`}>
          <h1 className="font-hand text-[40px] leading-none font-bold sm:text-5xl">{weekday(paper.date)}</h1>
          <span className="text-sm text-mute">{longDate(paper.date).replace(/^\w+, /, "")}</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            drop();
          }}
          className={`${COLUMN} sticky top-2 z-40`}
        >
          <label className="flex h-[60px] items-center gap-3 rounded-2xl border-[1.5px] border-ink bg-sheet px-5 text-red-text shadow-[0_10px_30px_-22px_var(--shadow)]">
            <PenIcon size={22} />
            <input
              ref={input}
              aria-label="Drop a thought"
              value={text}
              maxLength={MAX_THOUGHT}
              autoFocus
              autoComplete="off"
              enterKeyHint="send"
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                // First Esc clears; the next one steps out so Space works again.
                if (text) setText("");
                else e.currentTarget.blur();
              }}
              placeholder="What's on your mind?"
              className="min-w-0 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-mute focus-visible:outline-none"
            />
            <span className="hidden text-[13px] text-mute sm:inline" aria-hidden="true">
              {focused ? "Enter to drop" : (
                <>
                  <kbd className="rounded-md border border-line bg-soft px-1.5 py-0.5 font-sans text-[12px]">Space</kbd> to write
                </>
              )}
            </span>
          </label>
        </form>

        <div className={`${COLUMN} flex min-h-8 items-center justify-between gap-3`}>
          <span className="text-sm text-mute" aria-live="polite">
            {paper.thoughts.length === 0
              ? "Nothing dropped yet today."
              : `${open} open${struck ? ` · ${struck} done today` : ""}`}
          </span>
          {arranged && (
            <button type="button" onClick={tidy} className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium text-mute hover:bg-soft hover:text-ink sm:block">
              Tidy up
            </button>
          )}
        </div>

        {onSheet.length === 0 ? (
          <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 items-center justify-center sm:min-h-[420px]`}>
            <span className="flex flex-col items-center gap-1 py-16 text-center">
              <span className="font-hand text-[34px] font-bold">{shown.length ? "All struck. A clean sheet." : "A fresh sheet."}</span>
              <span className="text-mute">Type anything above and press Enter.</span>
            </span>
          </PaperSurface>
        ) : (
          <>
            <PaperSurface label="Today's paper" className="flex flex-1 flex-col gap-3 sm:hidden">
              {onSheet.map((t) => (
                <ThoughtBubble key={t.id} {...bubbleProps(t, tz, fresh.has(t.id))} stream {...handlers(t)} />
              ))}
            </PaperSurface>
            <FreeCanvas
              label="Today's paper"
              className={`${COLUMN} max-sm:hidden`}
              items={onSheet}
              onArrange={onArrange}
              render={(t) => <ThoughtBubble {...bubbleProps(t, tz, fresh.has(t.id))} movable {...handlers(t)} />}
            />
          </>
        )}

        {doneRow.length > 0 && (
          <section aria-label="Done today" className={`${COLUMN} flex flex-col gap-3`}>
            <h2 className="text-sm font-medium text-mute">Done today · {doneRow.length}</h2>
            <ul className="flex flex-wrap gap-2">
              {doneRow.map((t) => (
                <li key={t.id} className="group is-done flex max-w-full items-center gap-1 rounded-full border border-line bg-soft py-1 pr-1 pl-3.5">
                  <span className="pen-strike truncate font-hand text-[17px] leading-tight">{t.text}</span>
                  <button
                    type="button"
                    onClick={() => patch(t.id, { status: "open" })}
                    aria-label={`Bring back "${t.text}"`}
                    title="Bring back"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] text-mute hover:bg-sheet hover:text-ink"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    aria-label={`Delete "${t.text}"`}
                    title="Delete"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-mute opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-sheet hover:text-red-text max-sm:opacity-100"
                  >
                    <CloseIcon size={10} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="hidden text-center text-[13px] text-mute sm:block">
          Space or just type to write · Enter to drop · drag to arrange · double-click to strike · emailed at 9 PM
        </p>
        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike · emailed at 9 PM</p>
      </main>

      {error && (
        <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="font-semibold">
            OK
          </button>
        </div>
      )}
    </div>
  );
}

function bubbleProps(t: Thought, tz: string, fresh: boolean) {
  return { text: t.text, done: t.status === "done", shape: t.shape, seed: t.createdAt, meta: meta(t, tz), carried: t.carriedFrom ? weekday(t.carriedFrom).slice(0, 3) : undefined, fresh };
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
          {paper.thoughts.map((t) => (
            <ThoughtBubble key={t.id} {...bubbleProps(t, tz, false)} stream readOnly />
          ))}
        </PaperSurface>
        <FreeCanvas
          label={`Paper for ${longDate(paper.date)}`}
          className={`${COLUMN} max-sm:hidden`}
          items={paper.thoughts}
          render={(t) => <ThoughtBubble {...bubbleProps(t, tz, false)} readOnly />}
        />
      </main>
    </div>
  );
}
