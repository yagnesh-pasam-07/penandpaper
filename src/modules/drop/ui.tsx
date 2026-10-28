"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Fly } from "@/components/canvas/fly";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { CloseIcon } from "@/components/icons";
import { uid } from "@/lib/mutations";
import { addDays, fullDate, longDate, shortDate, weekday } from "@/lib/time";
import { call, COLUMN, DeskStamp, DropHeader, meta, useMounted, useViewerTz, type Me } from "./chrome";
import {
  applyPaperOp,
  counts,
  foldedItems,
  pencilFade,
  thoughtLabel,
  thisWeekend,
  visiblePaper,
  whenLabel,
  type DropPaper,
  type Kind,
  type PaperOp,
  type Thought,
} from "./logic";
import { draggingFiles, imageFiles, shrinkImage, type Picture } from "./image";
import { importTryPaper } from "./try-import";
import { useCanvasView, ViewControls } from "./use-view";
import { PenButton, Writer } from "./writer";

/* ---------- Today's paper ---------- */

/** One thing on the sheet: a thought, with where it sits. */
type SheetItem = { id: string; x: number | null; y: number | null; thought: Thought };

/** The thoughts that show today (folded ones tucked away), newest first, right under the writer. */
function sheetItems(paper: DropPaper): SheetItem[] {
  const order = new Map(paper.thoughts.map((t, i) => [t.id, i]));
  return visiblePaper(paper)
    .thoughts.map((t) => ({ id: t.id, x: t.x, y: t.y, thought: t }))
    .sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
}

/** Still wants attention: an open thought (ideas always are). */
const isOpenItem = (it: SheetItem) => it.thought.status === "open";

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

type Toast = { text: string; undo?: () => void; action?: { label: string; run: () => void } };
type Leaving = Map<string, "crumple" | "fold">;

export function DropCanvas({ initial, me }: { initial: DropPaper; me: Me }) {
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
  // A picture pasted into the writer, dropped with the next thought.
  const [draftImage, setDraftImage] = useState<Picture | null>(null);
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
  const [whenFor, setWhenFor] = useState<string | null>(null);
  const [foldedOpen, setFoldedOpen] = useState(false);
  // Image files dragged over the page: "let go to pin it".
  const [filesOver, setFilesOver] = useState(false);
  // Where the pointer is on the sheet, so a paste lands there.
  const spot = useRef<{ x: number; y: number } | null>(null);
  // Zoom and pan: the page carries the pattern, the sheet's wrapper is the origin the notes are measured from.
  const page = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLDivElement>(null);
  const { view, zoomBy, reset } = useCanvasView(page, origin);
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
      if (e.key === "Escape") return;
      // A selected thought keeps its own keys (W when, Delete crumple).
      if (el?.closest("[data-keys]") && ["s", "w", "delete", "backspace"].includes(e.key.toLowerCase())) return;
      if (e.key === "C" && e.shiftKey) {
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

  /** Puts a new thought on the paper and saves it; a picture and a spot are optional. */
  const add = (value: string, extra: { image?: string | null; x?: number | null; y?: number | null; from?: { x: number; y: number } }) => {
    const thought: Thought = {
      id: uid(),
      text: value,
      status: "open",
      kind,
      shape: Math.floor(Math.random() * 6),
      createdAt: new Date().toISOString(),
      doneAt: null,
      carriedFrom: null,
      x: extra.x ?? null,
      y: extra.y ?? null,
      scheduledFor: null,
      image: extra.image ?? null,
    };
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    if (extra.from) setFlights((m) => new Map(m).set(thought.id, extra.from!));
    void save(
      () =>
        call("/api/drop/thoughts", {
          method: "POST",
          body: JSON.stringify({ id: thought.id, text: thought.text, shape: thought.shape, kind: thought.kind, image: thought.image, x: thought.x, y: thought.y }),
        }),
      () => {
        update((p) => ({ ...p, thoughts: p.thoughts.filter((t) => t.id !== thought.id) }));
        if (extra.from) setDraft((current) => current || value);
      },
    );
    return thought.id;
  };

  const drop = (value: string, from: { x: number; y: number }) => {
    add(value, { image: draftImage?.url, from });
    setDraft("");
    setDraftImage(null);
  };

  /**
   * Pictures pasted or dropped onto the page (not into the writer): each lands
   * as a taped photo where the pointer is (a little apart when there are
   * several), with a moment to take it back.
   */
  const pin = async (files: File[]) => {
    const at = spot.current;
    const ids: string[] = [];
    for (const [i, file] of files.entries()) {
      try {
        const pic = await shrinkImage(file);
        ids.push(add("", { image: pic.url, x: at ? at.x + i * 0.03 : null, y: at ? at.y + i * 30 : null }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (!ids.length) return;
    setToast({
      text: `${ids.length === 1 ? "Picture" : `${ids.length} pictures`} pinned · click to caption`,
      undo: () => {
        update((p) => ({ ...p, thoughts: p.thoughts.filter((t) => !ids.includes(t.id)) }));
        ids.forEach((id) => void save(() => call(`/api/drop/thoughts/${id}`, { method: "DELETE" })));
        setToast(null);
      },
    });
  };
  const pinRef = useRef(pin);
  useEffect(() => {
    pinRef.current = pin;
  });

  // ⌘V a screenshot anywhere (the writer takes its own pastes), or drop image files on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, [contenteditable='true']")) return;
      const files = imageFiles(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      void pinRef.current(files);
    };
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!draggingFiles(e.dataTransfer)) return;
      depth += 1;
      setFilesOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (draggingFiles(e.dataTransfer)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!draggingFiles(e.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setFilesOver(false);
    };
    const onDropFiles = (e: DragEvent) => {
      if (!draggingFiles(e.dataTransfer)) return;
      e.preventDefault();
      depth = 0;
      setFilesOver(false);
      const files = imageFiles(e.dataTransfer);
      if (files.length) void pinRef.current(files);
      else setError("Only pictures can go on the paper: PNG, JPG, GIF or WebP.");
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDropFiles);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDropFiles);
    };
  }, []);

  const patch = (id: string, change: Partial<Pick<Thought, "text" | "status">>) => {
    const before = live.current.thoughts.find((t) => t.id === id);
    if (!before) return;
    // Ideas aren't "done": ink them first.
    if (change.status && before.kind === "pencil") return;
    const after = { ...before, ...change, doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt };
    update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? after : t)) }));
    if (change.status === "done") briefly(setSettling, [id], 900);
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify(change) }),
      () => update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? before : t)) })),
    );
  };

  /** Puts things back exactly as they were in `before` (an undo). */
  const restore = (before: DropPaper, id: string) => {
    update((p) => ({ ...p, thoughts: [...p.thoughts.filter((t) => t.id !== id), ...before.thoughts.filter((t) => t.id === id)] }));
    briefly(setReturning, [id], CRUMPLE_MS);
  };

  /**
   * Crumples it: the note scrunches up and rolls away, with a few seconds to
   * take it back. Nothing is sent until the undo window closes.
   */
  const crumple = (id: string) => {
    const t = live.current.thoughts.find((x) => x.id === id);
    if (!t || waiting.current.has(id)) return;
    const before = live.current;
    playOut(id, "crumple", CRUMPLE_MS, () => update((p) => ({ ...p, thoughts: p.thoughts.filter((x) => x.id !== id) })));
    const send = () => {
      waiting.current.delete(id);
      void save(
        () => call(`/api/drop/thoughts/${id}`, { method: "DELETE", keepalive: true }),
        () => restore(before, id),
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
        restore(before, id);
        setToast(null);
      },
    });
  };

  /** Saves where thoughts were dragged (or, with null spots, sends them back into rows). */
  const arrange = (placements: { id: string; x: number | null; y: number | null }[], body: object) => {
    const before = live.current;
    const at = new Map(placements.map((p) => [p.id, p]));
    const moved = <T extends { id: string }>(x: T) => (at.has(x.id) ? { ...x, x: at.get(x.id)!.x, y: at.get(x.id)!.y } : x);
    update((p) => ({ ...p, thoughts: p.thoughts.map(moved) }));
    void save(
      () => call("/api/drop/arrange", { method: "POST", body: JSON.stringify(body) }),
      () => update(() => before),
    );
  };
  const onArrange = (placements: Placement[]) => arrange(placements, { placements });
  const tidy = () => {
    const all = live.current.thoughts.map((x) => ({ id: x.id, x: null, y: null }));
    arrange(all, { tidy: true });
  };
  const arranged = paper.thoughts.some((t) => t.x !== null);

  /** Shows a change at once and saves it; puts it back if saving fails. */
  const paperOp = (op: PaperOp) => {
    const before = live.current;
    try {
      update((p) => applyPaperOp(p, op));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    void save(
      () => call("/api/drop/changes", { method: "POST", body: JSON.stringify(op) }),
      () => update(() => before),
    );
  };

  const ink = (id: string, to: Kind) => {
    paperOp({ kind: "ink", thought: id, to });
    if (to === "pen") briefly(setInking, [id], 600);
  };

  /** Folds a thought away till a day (it folds out of sight), or brings it back to today. */
  const schedule = (id: string, on: string | null) => {
    const was = live.current.thoughts.find((t) => t.id === id)?.scheduledFor ?? null;
    const op: PaperOp = { kind: "schedule", id, on };
    if (on && on > live.current.date) {
      playOut(id, "fold", FOLD_MS, () => paperOp(op));
      setToast({
        text: `Folded till ${whenLabel(on, live.current.date)}`,
        undo: () => {
          paperOp({ kind: "schedule", id, on: was });
          setToast(null);
        },
      });
    } else paperOp(op);
  };

  const handlers = (t: Thought) => ({
    onEdit: (v: string) => patch(t.id, { text: v }),
    onToggle: () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => crumple(t.id),
    onWhen: () => setWhenFor(t.id),
    onInk: () => ink(t.id, t.kind === "pencil" ? "pen" : "pencil"),
  });

  const whenOf = (x: { scheduledFor: string | null }) => (x.scheduledFor ? whenLabel(x.scheduledFor, paper.date) : undefined);

  const items = sheetItems(paper);
  const onSheet = items.filter((it) => isOpenItem(it) || settling.has(it.id) || leaving.has(it.id));
  const doneRow = items.filter((it) => !isOpenItem(it) && !settling.has(it.id) && !leaving.has(it.id));
  const { open } = counts(paper);
  const folded = foldedItems(paper);
  const byId = new Map(paper.thoughts.map((t) => [t.id, t]));
  // A pencil thought's weight: written again makes it matter more.
  const weightOf = (t: Thought) => {
    const score = Math.min(2, t.echoes?.length ?? 0);
    // Nothing has come back to it and it's been left a night or more: written lightly.
    if (!score) return pencilFade(t, paper.date) < 1 ? 0 : 1;
    return Math.min(3, 1 + score);
  };
  // Clear desk shows in the evening (or once the paper fills up); Shift+C always works.
  const evening = mounted && new Date().getHours() >= 18;
  const showClear = mounted && (evening || open >= 5) && open > 0;

  const bubble = (t: Thought, extra: { stream?: boolean; movable?: boolean } = {}) => (
    <ThoughtBubble
      {...bubbleProps(t, tz, fresh.has(t.id))}
      image={t.image}
      echoes={t.echoes}
      weight={weightOf(t)}
      when={whenOf(t)}
      leaving={leaving.get(t.id) ?? null}
      returning={returning.has(t.id)}
      {...extra}
      {...handlers(t)}
    />
  );

  return (
    <div ref={page} className="canvas-surface canvas-page flex min-h-dvh flex-col bg-bg">
      <DropHeader
        me={me}
        title={
          <>
            <h1 className="font-hand text-[26px] leading-none font-bold">{weekday(paper.date)}</h1>
            <span className="truncate text-[13px] text-mute" aria-live="polite">
              {fullDate(paper.date)}
            </span>

          </>
        }
        right={
          <>
            <Link href="/drop/history" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              History
            </Link>
          </>
        }
      />
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-3 pb-28 sm:px-8">
        {onSheet.length === 0 ? (
          <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 items-center justify-center sm:min-h-[420px]`}>
            <span className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="font-hand text-[34px] font-bold">{items.length ? "All struck. A clean sheet." : "A fresh sheet."}</span>
              <span className="text-mute">Press Space, or tap Write…, and put it down.</span>
            </span>
          </PaperSurface>
        ) : (
          <>
            <PaperSurface label="Today's paper" className={`${COLUMN} flex flex-1 flex-col gap-3 sm:hidden`}>
              {onSheet.map((it) => (
                <Fly key={it.id} from={flights.get(it.id)}>
                  <div data-item={it.id} style={{ opacity: pencilFade(it.thought, paper.date) }}>
                    {bubble(it.thought, { stream: true })}
                  </div>
                </Fly>
              ))}
            </PaperSurface>
            {/* The page is the canvas: this runs the full width, and notes can go anywhere on it. */}
            <div ref={origin} className="relative -mx-4 max-sm:hidden sm:-mx-8">
              <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-4 sm:px-8">
                <span className="mx-auto flex w-full max-w-[1056px] items-center justify-end gap-1 px-2">
                  {arranged && (
                    <button type="button" onClick={tidy} className="pointer-events-auto rounded-lg px-2.5 py-1 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
                      Tidy up
                    </button>
                  )}
                </span>
              </div>
              <FreeCanvas
                bare
                view={view}
                minHeight="calc(100dvh - 12rem)"
                label="Today's paper"
                items={onSheet}
                onArrange={onArrange}
                spotRef={spot}
                render={(it) => (
                  <Fly from={flights.get(it.id)}>
                    <div data-item={it.id} className={inking.has(it.id) ? "ink-in" : ""} style={{ opacity: pencilFade(it.thought, paper.date) }}>
                      {bubble(it.thought, { movable: true })}
                    </div>
                  </Fly>
                )}
              />
            </div>
          </>
        )}

        <div className={`${COLUMN} flex flex-wrap items-center justify-between gap-2`}>
          <span className="flex items-center gap-1">
            {folded.length > 0 && <FoldedLine items={folded} today={paper.date} open={foldedOpen} onToggle={() => setFoldedOpen(!foldedOpen)} onUnfold={(id) => schedule(id, null)} />}
          </span>
          {showClear && (
            <Link href="/drop/clear" className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
              Clear desk <kbd className="ml-1 rounded border border-line px-1 font-sans text-[11px] max-sm:hidden">⇧C</kbd>
            </Link>
          )}
        </div>

        {doneRow.length > 0 && (
          <section aria-label="Done today" className={`${COLUMN} flex flex-col gap-3`}>
            <h2 className="text-sm font-medium text-mute">Done today · {doneRow.length}</h2>
            <ul className="flex flex-wrap gap-2">
              {doneRow.map((it) => (
                <DoneChip key={it.id} text={it.thought.text} onBringBack={() => patch(it.id, { status: "open" })} onDelete={() => crumple(it.id)} />
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike, left to crumple</p>
      </main>

      {onSheet.length > 0 && <ViewControls view={view} onZoom={(f) => zoomBy(f)} onReset={reset} />}

      <PenButton ref={penButton} hidden={writing} onOpen={() => setWriting(true)} />
      {writing && mounted && (
        <Writer draft={draft} onDraft={setDraft} kind={kind} onKind={setKind} image={draftImage} onImage={setDraftImage} onDrop={drop} onClose={closeWriter} />
      )}

      {filesOver && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-[55] flex flex-col items-center justify-center gap-2 rounded-[18px] border-[2.5px] border-dashed border-red-text bg-red-soft/55">
          <span className="font-hand text-[34px] font-bold text-red-text">Let go to pin it on today&apos;s paper</span>
          <span className="text-[13px] text-mute">PNG, JPG, GIF or WebP · up to 10 MB · several at once is fine</span>
        </div>
      )}

      {whenFor && (
        <WhenPicker
          today={paper.date}
          current={byId.get(whenFor)?.scheduledFor ?? null}
          label={byId.get(whenFor) ? thoughtLabel(byId.get(whenFor)!) : ""}
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
          {!error && toast?.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
              className="rounded-lg bg-bg/15 px-3 py-1 font-semibold"
            >
              {toast.action.label}
            </button>
          )}
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
    image: t.image,
    done: t.status === "done",
    kind: t.kind,
    shape: t.shape,
    seed: t.createdAt,
    meta: meta(t, tz),
    carried: t.carriedFrom ? weekday(t.carriedFrom).slice(0, 3) : undefined,
    fresh,
  };
}

/** "2 folded for later": opens a small list by day, each one can come back to today. */
function FoldedLine({
  items,
  today,
  open,
  onToggle,
  onUnfold,
}: {
  items: { id: string; label: string; on: string }[];
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
                    <span className="min-w-0 flex-1 truncate font-note text-[15px]">{i.label}</span>
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

/** A struck thought in the "Done today" row: small and quiet. */
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
  const items = sheetItems(paper);
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
          {items.map((it) => (
            <ThoughtBubble key={it.id} {...bubbleProps(it.thought, tz, false)} stream readOnly />
          ))}
        </PaperSurface>
        <FreeCanvas
          label={`Paper for ${longDate(paper.date)}`}
          className={`${COLUMN} max-sm:hidden`}
          items={items}
          render={(it) => <ThoughtBubble {...bubbleProps(it.thought, tz, false)} readOnly />}
        />
      </main>
    </div>
  );
}
