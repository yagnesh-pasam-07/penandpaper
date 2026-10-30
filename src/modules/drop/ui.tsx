"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fly } from "@/components/canvas/fly";
import { FreeCanvas, type Placement } from "@/components/canvas/free-canvas";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { uid } from "@/lib/mutations";
import { viewKey } from "@/components/canvas/view";
import { call, COLUMN, DropHeader, meta, useMounted, useViewerTz, type Me } from "./chrome";
import { paperTitle, type DropPaper, type PaperMeta, type Thought } from "./logic";
import { draggingFiles, imageFiles, shrinkImage, type Picture } from "./image";
import { PaperBar, SearchButton, UNDO_PAPER_KEY } from "./papers-ui";
import { TonightButton } from "./tonight-button";
import { importTryPaper } from "./try-import";
import { useCanvasView, ViewControls } from "./use-view";
import { PenButton, Writer } from "./writer";

/* ---------- A paper ---------- */

/** One thing on the sheet: a thought, with where it sits. */
type SheetItem = { id: string; x: number | null; y: number | null; thought: Thought };

/** The thoughts on the sheet, newest first, right under the writer. */
function sheetItems(paper: DropPaper): SheetItem[] {
  const order = new Map(paper.thoughts.map((t, i) => [t.id, i]));
  return paper.thoughts.map((t) => ({ id: t.id, x: t.x, y: t.y, thought: t })).sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
}

/** A half-written thought is kept per paper, on this device. */
const draftKey = (paperId: string) => `pp-drop-draft:${paperId}`;

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Undo window for crumpling (and how long the toast stays). */
const UNDO_MS = 6000;
const CRUMPLE_MS = 450;

type Toast = { text: string; undo?: () => void; action?: { label: string; run: () => void } };
type Leaving = Map<string, "crumple">;

export function DropCanvas({ initial, papers, me, focus = null, write = false }: { initial: DropPaper; papers: PaperMeta[]; me: Me; focus?: string | null; write?: boolean }) {
  const router = useRouter();
  // One paper per mount (the page keys this by paper), so its id is fixed.
  const paperId = initial.id;
  const [paper, setPaper] = useState(initial);
  // The latest paper, updated in step with every change so quick ones in a row build on each other.
  const live = useRef(initial);
  const update = useCallback((change: (p: DropPaper) => DropPaper) => {
    live.current = change(live.current);
    setPaper(live.current);
  }, []);
  // The writer: open, and what's half-written in it (kept on close, and across reloads on this device).
  const [writing, setWriting] = useState(initial.thoughts.length === 0 || write);
  const [draft, setDraft] = useState(() => readDraft(draftKey(paperId)));
  // A picture pasted into the writer, dropped with the next thought.
  const [draftImage, setDraftImage] = useState<Picture | null>(null);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(draftKey(paperId), draft);
      else localStorage.removeItem(draftKey(paperId));
    } catch {}
  }, [draft, paperId]);
  // Where each new note was written, so it can fly from there to its place.
  const [flights, setFlights] = useState<Map<string, { x: number; y: number }>>(new Map());
  const penButton = useRef<HTMLButtonElement>(null);
  const mounted = useMounted();
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  // On their way out (crumpled) or back in (undo): kept on screen for the animation.
  const [leaving, setLeaving] = useState<Leaving>(new Map());
  const [returning, setReturning] = useState<Set<string>>(new Set());
  // Image files dragged over the page: "let go to pin it".
  const [filesOver, setFilesOver] = useState(false);
  // Where the pointer is on the sheet, so a paste lands there.
  const spot = useRef<{ x: number; y: number } | null>(null);
  // Zoom and pan: the page carries the pattern, the sheet's wrapper is the origin the notes are measured from.
  const page = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLDivElement>(null);
  const { view, zoomBy, reset, panBy, fit } = useCanvasView(page, origin, viewKey(paperId));
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

  // Thoughts tried on the homepage before signing up land on a paper of their own.
  useEffect(() => {
    void importTryPaper({ id: paperId, blank: initial.thoughts.length === 0 && !initial.name }).then(async (into) => {
      if (!into) return;
      if (into !== paperId) {
        router.push(`/drop/${into}`);
        return;
      }
      // They came onto this very paper: show what was just added, and its new name.
      try {
        const next = await call<DropPaper>(`/api/drop/papers/${paperId}`);
        update(() => next);
        router.refresh();
      } catch {
        // Keep what's on screen.
      }
    });
    // Once, when the paper opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A paper deleted from the paper before this one is waiting for its Undo.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(UNDO_PAPER_KEY);
      if (raw) sessionStorage.removeItem(UNDO_PAPER_KEY);
    } catch {}
    if (!raw) return;
    const gone = JSON.parse(raw) as { id: string; title: string };
    // After this render, not during it.
    const timer = setTimeout(
      () =>
        setToast({
          text: `Deleted "${gone.title}"`,
          undo: () => {
            void call(`/api/drop/papers/${gone.id}`, { method: "PATCH", body: JSON.stringify({ deleted: false }) })
              .then(() => router.push(`/drop/${gone.id}`))
              .catch((e) => setError(e instanceof Error ? e.message : String(e)));
            setToast(null);
          },
        }),
      0,
    );
    return () => clearTimeout(timer);
  }, [router]);

  // "I'm here" each minute while this paper is on screen, for Studio's "online now".
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void fetch("/api/drop/presence", { method: "POST", keepalive: true }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  // Back to the tab: pick up changes from other devices.
  useEffect(() => {
    const sync = async () => {
      if (document.visibilityState !== "visible" || pending.current > 0 || waiting.current.size > 0) return;
      try {
        const next = await call<DropPaper>(`/api/drop/papers/${paperId}`);
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
  }, [update, paperId]);

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

  // Arriving from a search: bring the note into view and let it pulse.
  useEffect(() => {
    if (!focus) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const find = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-item="${CSS.escape(focus)}"]`)].find((x) => x.offsetParent !== null);
      if (!el) {
        // The sheet measures its notes a moment after it opens.
        if (++tries < 12) timer = setTimeout(find, 150);
        return;
      }
      reset();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("note-pulse");
      timer = setTimeout(() => el.classList.remove("note-pulse"), 2000);
    };
    timer = setTimeout(find, 200);
    return () => clearTimeout(timer);
    // Only when the note to find changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
      if (e.key === "Escape") return;
      // A selected thought keeps its own keys (Enter edit, Delete crumple).
      if (el?.closest("[data-keys]") && ["delete", "backspace"].includes(e.key.toLowerCase())) return;
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

  const playOut = (id: string, ms: number, then: () => void) => {
    setLeaving((m) => new Map(m).set(id, "crumple"));
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
      shape: Math.floor(Math.random() * 6),
      createdAt: new Date().toISOString(),
      doneAt: null,
      x: extra.x ?? null,
      y: extra.y ?? null,
      image: extra.image ?? null,
    };
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    if (extra.from) setFlights((m) => new Map(m).set(thought.id, extra.from!));
    void save(
      () =>
        call("/api/drop/thoughts", {
          method: "POST",
          body: JSON.stringify({ paperId, id: thought.id, text: thought.text, shape: thought.shape, image: thought.image, x: thought.x, y: thought.y }),
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
        ids.forEach((id) => void save(() => call(`/api/drop/thoughts/${id}?paper=${paperId}`, { method: "DELETE" })));
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
    const after = { ...before, ...change, doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt };
    update((p) => ({ ...p, thoughts: p.thoughts.map((t) => (t.id === id ? after : t)) }));
    void save(
      () => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ ...change, paperId }) }),
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
    playOut(id, CRUMPLE_MS, () => update((p) => ({ ...p, thoughts: p.thoughts.filter((x) => x.id !== id) })));
    const send = () => {
      waiting.current.delete(id);
      void save(
        () => call(`/api/drop/thoughts/${id}?paper=${paperId}`, { method: "DELETE", keepalive: true }),
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
  const onArrange = (placements: Placement[]) => arrange(placements, { paperId, placements });
  const tidy = () => {
    const all = live.current.thoughts.map((x) => ({ id: x.id, x: null, y: null }));
    arrange(all, { paperId, tidy: true });
  };
  const arranged = paper.thoughts.some((t) => t.x !== null);

  const handlers = (t: Thought) => ({
    onEdit: (v: string) => patch(t.id, { text: v }),
    onToggle: () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => crumple(t.id),
  });

  const items = sheetItems(paper);
  const onSheet = items;

  const bubble = (t: Thought, extra: { stream?: boolean; movable?: boolean } = {}) => (
    <ThoughtBubble
      {...bubbleProps(t, tz, fresh.has(t.id))}
      image={t.image}
      previews
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
        title={<PaperBar paper={{ id: paperId, name: initial.name, createdAt: initial.createdAt, archivedAt: initial.archivedAt }} papers={papers} />}
        right={
          <>
            <TonightButton />
            <SearchButton />
            <Link href="/drop/library" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              Library
            </Link>
          </>
        }
      />
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-3 pb-28 sm:px-8">
        {onSheet.length === 0 ? (
          <PaperSurface label={paperTitle(initial)} className={`${COLUMN} flex flex-1 items-center justify-center sm:min-h-[420px]`}>
            <span className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="font-hand text-[34px] font-bold">A fresh sheet.</span>
              <span className="text-mute">Press Space, or tap Write…, and put it down.</span>
            </span>
          </PaperSurface>
        ) : (
          <>
            <PaperSurface label={paperTitle(initial)} className={`${COLUMN} flex flex-1 flex-col gap-3 sm:hidden`}>
              {onSheet.map((it) => (
                <Fly key={it.id} from={flights.get(it.id)}>
                  <div data-item={it.id}>
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
                onPanBy={panBy}
                minHeight="calc(100dvh - 12rem)"
                label={paperTitle(initial)}
                items={onSheet}
                onArrange={onArrange}
                spotRef={spot}
                render={(it) => (
                  <Fly from={flights.get(it.id)}>
                    <div data-item={it.id}>
                      {bubble(it.thought, { movable: true })}
                    </div>
                  </Fly>
                )}
              />
            </div>
          </>
        )}

        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike, left to crumple</p>
      </main>

      {onSheet.length > 0 && <ViewControls view={view} onZoom={(f) => zoomBy(f)} onReset={reset} onFit={fit} />}

      <PenButton ref={penButton} hidden={writing} onOpen={() => setWriting(true)} />
      {writing && mounted && (
        <Writer draft={draft} onDraft={setDraft} image={draftImage} onImage={setDraftImage} onDrop={drop} onClose={closeWriter} />
      )}

      {filesOver && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-3 z-[55] flex flex-col items-center justify-center gap-2 rounded-[18px] border-[2.5px] border-dashed border-red-text bg-red-soft/55">
          <span className="font-hand text-[34px] font-bold text-red-text">Let go to pin it on this paper</span>
          <span className="text-[13px] text-mute">PNG, JPG, GIF or WebP · up to 10 MB · several at once is fine</span>
        </div>
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
    shape: t.shape,
    seed: t.createdAt,
    meta: meta(t, tz),
    fresh,
  };
}
