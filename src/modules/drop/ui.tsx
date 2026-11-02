"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fly } from "@/components/canvas/fly";
import { FreeCanvas, type CanvasApi, type Offset, type Placement } from "@/components/canvas/free-canvas";
import { InkLayer, type InkStroke } from "@/components/canvas/ink-layer";
import { insidePolygon, isLoop, shapeOutline, shift, type Pt } from "@/components/canvas/ink";
import { PaperText } from "@/components/canvas/paper-text";
import { PaperSurface } from "@/components/canvas/paper-surface";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { uid } from "@/lib/mutations";
import { viewKey } from "@/components/canvas/view";
import { call, COLUMN, DropHeader, meta, useMounted, useViewerTz, type Me } from "./chrome";
import { isDrop, isInk, mentionedEmails, paperTitle, type DropPaper, type InkName, type PaperMeta, type ShapeKind, type Stroke, type Thought, type ThoughtKind } from "./logic";
import { DueChip, DuePicker } from "./due";
import { ShareButton } from "./share-ui";
import { useReminders } from "./use-reminders";
import { draggingFiles, imageFiles, shrinkImage, type Picture } from "./image";
import { PaperBar, SearchButton, UNDO_PAPER_KEY } from "./papers-ui";
import { TodayThought } from "./today";
import { TonightButton } from "./tonight-button";
import { importTryPaper } from "./try-import";
import { Toolbar, TOOL_ORDER, type Tool } from "./tools";
import { useCanvasView, ViewControls } from "./use-view";
import { useVoice } from "./use-voice";
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

const DEFAULT_PEN: { color: InkName; shape: ShapeKind } = { color: "ink", shape: "rect" };
function readPen(): { color: InkName; shape: ShapeKind } {
  try {
    const saved = JSON.parse(localStorage.getItem("pp-pen") ?? "{}") as { color?: unknown; shape?: unknown };
    return { color: isInk(saved.color) ? saved.color : "ink", shape: saved.shape === "ellipse" ? "ellipse" : "rect" };
  } catch {
    return DEFAULT_PEN;
  }
}

/** Undo window for crumpling (and how long the toast stays). */
const UNDO_MS = 6000;
const CRUMPLE_MS = 450;

type Toast = { text: string; undo?: () => void; action?: { label: string; run: () => void } };
type Leaving = Map<string, "crumple">;

export function DropCanvas({ initial, papers, me, focus = null, write = false, today = false }: { initial: DropPaper; papers: PaperMeta[]; me: Me; focus?: string | null; write?: boolean; today?: boolean }) {
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
  // The tool in hand (desktop canvas): Select, Text, Draw or the eraser.
  const [tool, setTool] = useState<Tool>("select");
  // Text just placed with the Text tool, open for writing.
  const [writingText, setWritingText] = useState<string | null>(null);
  const [freshInk, setFreshInk] = useState<Set<string>>(new Set());
  // Text placed but not written in yet: never sent until it has words.
  const unsaved = useRef(new Set<string>());
  const strokes = paper.strokes ?? [];
  // The shape the Shape tool draws, and the ink in the pen (both remembered on this device).
  // Read from this device once mounted (the server can't know it), kept once chosen.
  const [pen, setPen] = useState<{ color: InkName; shape: ShapeKind } | null>(null);
  const penNow = pen ?? (mounted ? readPen() : DEFAULT_PEN);
  const shapeKind = penNow.shape;
  const inkColor = penNow.color;
  const setShapeKind = (f: ShapeKind | ((k: ShapeKind) => ShapeKind)) => setPen((p) => {
    const base = p ?? readPen();
    return { ...base, shape: typeof f === "function" ? f(base.shape) : f };
  });
  const setInkColor = (color: InkName) => setPen((p) => ({ ...(p ?? readPen()), color }));
  useEffect(() => {
    if (!pen) return;
    try {
      localStorage.setItem("pp-pen", JSON.stringify(pen));
    } catch {}
  }, [pen]);
  // Select: what's picked (written text, or a line / shape / loop).
  const [picked, setPicked] = useState<{ kind: "text" | "ink"; id: string } | null>(null);
  // A loop or shape being carried, with everything inside it.
  const [carry, setCarry] = useState<{ strokeIds: Set<string>; noteIds: Set<string>; dx: number; dy: number } | null>(null);
  const [labelling, setLabelling] = useState<string | null>(null);
  const [dueFor, setDueFor] = useState<string | null>(null);
  const canvasApi = useRef<CanvasApi | null>(null);
  const boxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  // A tool change puts down whatever was picked.
  const [toolSeen, setToolSeen] = useState(tool);
  if (toolSeen !== tool) {
    setToolSeen(tool);
    setPicked(null);
    setLabelling(null);
  }

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

  const pickedRef = useRef(picked);
  const eraseRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    pickedRef.current = picked;
  });

  // Hold Space to speak: the words land as text on the paper, where the pointer
  // is (or into the text being written). A tap of Space still opens the writer.
  const voiceAt = useRef<{ x: number; y: number } | null>(null);
  const heard = useRef<(words: string) => void>(() => {});
  const voice = useVoice((words) => heard.current(words), { hold: true });
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });
  const voiceFailed = voice.state.kind === "failed" ? voice.state.message : "";

  // Keyboard first: Space, or simply typing, opens the writer from anywhere on
  // the page (the first letter goes into it), so a thought never needs the mouse.
  // Holding Space speaks instead; 1–4 pick a tool; Esc puts the tool down.
  useEffect(() => {
    const HOLD_MS = 280;
    let held: { timer: ReturnType<typeof setTimeout>; talking: boolean } | null = null;
    const open = (first?: string) => {
      if (first) setDraft((d) => d + first);
      setWriting(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (e.key === "Escape") {
        setTool("select");
        setPicked(null);
        return;
      }
      // A picked line or shape: Delete rubs it out (with Undo).
      if ((e.key === "Delete" || e.key === "Backspace") && pickedRef.current?.kind === "ink") {
        e.preventDefault();
        eraseRef.current(pickedRef.current.id);
        setPicked(null);
        return;
      }
      // A selected thought keeps its own keys (Enter edit, Delete crumple).
      if (el?.closest("[data-keys]") && ["delete", "backspace"].includes(e.key.toLowerCase())) return;
      const pick = ["1", "2", "3", "4", "5"].indexOf(e.key);
      if (pick >= 0 && window.matchMedia("(min-width: 640px)").matches) {
        e.preventDefault();
        const next = TOOL_ORDER[pick];
        // Shape again switches rectangle ⇄ ellipse.
        setTool((t) => {
          if (t === "shape" && next === "shape") setShapeKind((k) => (k === "rect" ? "ellipse" : "rect"));
          return next;
        });
        return;
      }
      if (e.key === " ") {
        // A focused button or link keeps Space for itself.
        if (el?.closest("button, a, summary")) return;
        e.preventDefault();
        if (e.repeat || held) return;
        // A tap opens the writer; held, it listens (where the browser can).
        if (!voiceRef.current.supported) {
          open();
          return;
        }
        held = {
          talking: false,
          timer: setTimeout(() => {
            if (!held) return;
            held.talking = true;
            voiceAt.current = spot.current;
            voiceRef.current.start();
          }, HOLD_MS),
        };
      } else if (e.key.length === 1) {
        e.preventDefault();
        open(e.key);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== " " || !held) return;
      clearTimeout(held.timer);
      if (held.talking) voiceRef.current.stop();
      else open();
      held = null;
    };
    // Switching away mid-hold: stop listening and keep what was heard.
    const onBlur = () => {
      if (!held) return;
      clearTimeout(held.timer);
      if (held.talking) voiceRef.current.stop();
      held = null;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
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

  // People already offered for this paper (so a mention asks once).
  const offered = useRef(new Set<string>());
  /** Words with "@name@company.com": offer to share the paper with them (never shares on its own). */
  const offerMentions = (text: string) => {
    const fresh = mentionedEmails(text).filter((e) => !offered.current.has(e) && e !== me.email.toLowerCase());
    if (!fresh.length) return;
    fresh.forEach((e) => offered.current.add(e));
    const who = fresh.length === 1 ? fresh[0] : `${fresh.length} people`;
    setToast({
      text: `You mentioned ${who}. Share this paper with ${fresh.length === 1 ? "them" : "them all"}? (view only)`,
      action: {
        label: "Share",
        run: () => {
          for (const email of fresh) {
            void call(`/api/drop/papers/${paperId}/share`, { method: "POST", body: JSON.stringify({ invite: email }) })
              .then(() => setToast({ text: `Shared with ${email}: they'll get an email` }))
              .catch((e) => setError(e instanceof Error ? e.message : String(e)));
          }
        },
      },
    });
  };

  /** Puts a new thought on the paper and saves it; a picture and a spot are optional. */
  const add = (value: string, extra: { image?: string | null; x?: number | null; y?: number | null; from?: { x: number; y: number }; kind?: ThoughtKind; id?: string }) => {
    const thought: Thought = {
      id: extra.id ?? uid(),
      text: value,
      status: "open",
      shape: Math.floor(Math.random() * 6),
      createdAt: new Date().toISOString(),
      doneAt: null,
      x: extra.x ?? null,
      y: extra.y ?? null,
      image: extra.image ?? null,
      kind: extra.kind ?? "note",
    };
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setFresh((f) => new Set(f).add(thought.id));
    if (value.includes("@")) offerMentions(value);
    if (extra.from) setFlights((m) => new Map(m).set(thought.id, extra.from!));
    void save(
      () =>
        call("/api/drop/thoughts", {
          method: "POST",
          body: JSON.stringify({ paperId, id: thought.id, text: thought.text, shape: thought.shape, image: thought.image, x: thought.x, y: thought.y, kind: thought.kind }),
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

  const patch = (id: string, change: Partial<Pick<Thought, "text" | "status" | "size" | "color">> & { due?: { at: string; hasTime: boolean } | null }) => {
    const before = live.current.thoughts.find((t) => t.id === id);
    if (!before) return;
    const { due, ...rest } = change;
    if (change.text?.includes("@")) offerMentions(change.text);
    const after: Thought = {
      ...before,
      ...rest,
      ...(due !== undefined ? { dueAt: due?.at ?? null, dueHasTime: due?.hasTime ?? false } : {}),
      doneAt: change.status === "done" ? new Date().toISOString() : change.status === "open" ? null : before.doneAt,
    };
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

  /** Text tool: a click on bare paper puts the pen down there (the sheet keeps `spot` on the pointer). */
  const placeText = () => {
    const at = spot.current;
    if (!at) return;
    const id = uid();
    // Shown at once and saved when the first words are written (an empty one is never saved).
    const thought: Thought = { id, text: "", status: "open", shape: 0, createdAt: new Date().toISOString(), doneAt: null, x: at.x, y: at.y, image: null, kind: "text", color: inkColor };
    unsaved.current.add(id);
    update((p) => ({ ...p, thoughts: [...p.thoughts, thought] }));
    setWritingText(id);
  };

  /** Written text saved for the first time, or edited. */
  const writeText = (id: string, value: string) => {
    const t = live.current.thoughts.find((x) => x.id === id);
    if (!t) return;
    if (unsaved.current.has(id) || !t.text) {
      unsaved.current.delete(id);
      update((p) => ({ ...p, thoughts: p.thoughts.filter((x) => x.id !== id) }));
      add(value, { kind: "text", x: t.x, y: t.y, id });
      // Its colour and size go with it once it has words.
      if ((t.color && t.color !== "ink") || (t.size && t.size !== 1)) patch(id, { ...(t.color && t.color !== "ink" ? { color: t.color } : {}), ...(t.size && t.size !== 1 ? { size: t.size } : {}) });
      return;
    }
    patch(id, { text: value });
  };

  // What Space-held speech on bare paper does with the words: new text where the pointer was.
  // (Text being written listens for itself: see PaperText.)
  useEffect(() => {
    heard.current = (words) => {
      const at = voiceAt.current;
      add(words, { kind: "text", x: at?.x ?? null, y: at?.y ?? null });
    };
  });

  /** Rubs out written text: a blank one just goes; a saved one is crumpled (with Undo). */
  const rubText = (id: string) => {
    const t = live.current.thoughts.find((x) => x.id === id);
    if (!t) return;
    if (!t.text) update((p) => ({ ...p, thoughts: p.thoughts.filter((x) => x.id !== id) }));
    else crumple(id);
  };

  /** Ink put down with the Draw tool. */
  const draw = (stroke: InkStroke) => {
    const s: Stroke = { ...stroke, id: uid() };
    update((p) => ({ ...p, strokes: [...(p.strokes ?? []), s] }));
    briefly(setFreshInk, [s.id], 500);
    void save(
      () => call("/api/drop/strokes", { method: "POST", body: JSON.stringify({ paperId, ...s }) }),
      () => update((p) => ({ ...p, strokes: (p.strokes ?? []).filter((x) => x.id !== s.id) })),
    );
  };

  /** Rubbed out with the eraser, with a moment to take it back. */
  const erase = (id: string) => {
    const s = (live.current.strokes ?? []).find((x) => x.id === id);
    if (!s) return;
    const gone = () => update((p) => ({ ...p, strokes: (p.strokes ?? []).filter((x) => x.id !== id) }));
    const back = () => update((p) => ({ ...p, strokes: [...(p.strokes ?? []).filter((x) => x.id !== id), s] }));
    gone();
    void save(() => call(`/api/drop/strokes/${id}?paper=${paperId}`, { method: "DELETE" }), back);
    setToast({
      text: "Rubbed out",
      undo: () => {
        back();
        void save(() => call(`/api/drop/strokes/${id}`, { method: "PATCH", body: JSON.stringify({ paperId }) }), gone);
        setToast(null);
      },
    });
  };

  useEffect(() => {
    eraseRef.current = erase;
  });

  /** Changes a line or shape (moved, reshaped, re-coloured, words inside), with a rollback. */
  const editStroke = (id: string, change: Partial<Pick<Stroke, "points" | "color" | "label" | "fromId" | "toId">>) => {
    const before = (live.current.strokes ?? []).find((x) => x.id === id);
    if (!before) return;
    update((p) => ({ ...p, strokes: (p.strokes ?? []).map((x) => (x.id === id ? { ...x, ...change } : x)) }));
    void save(
      () => call(`/api/drop/strokes/${id}`, { method: "PATCH", body: JSON.stringify({ paperId, ...change }) }),
      () => update((p) => ({ ...p, strokes: (p.strokes ?? []).map((x) => (x.id === id ? before : x)) })),
    );
  };

  /**
   * What a loop or shape holds: every note whose centre is inside it, and every
   * line or shape lying wholly inside it. Carrying it carries all of them; each
   * can still be picked and moved on its own.
   */
  const contentsOf = (id: string) => {
    const all = live.current.strokes ?? [];
    const s = all.find((x) => x.id === id);
    const noteIds = new Set<string>();
    const strokeIds = new Set<string>([id]);
    if (!s) return { noteIds, strokeIds };
    const ring: Pt[] | null = s.shape ? shapeOutline(s.shape, s.points) : isLoop(s.points) ? s.points : null;
    if (!ring) return { noteIds, strokeIds };
    for (const [nid, b] of boxesRef.current) if (insidePolygon({ x: b.x, y: b.y }, ring)) noteIds.add(nid);
    for (const o of all) {
      if (o.id === id) continue;
      const pts = o.shape ? shapeOutline(o.shape, o.points) : o.points;
      // A connector whose both ends are tied to things inside follows them anyway; a free line moves if it sits inside.
      if (o.fromId || o.toId) continue;
      if (pts.every(([x, y]) => insidePolygon({ x, y }, ring))) strokeIds.add(o.id);
    }
    return { noteIds, strokeIds };
  };

  /** Select carried a line or shape: live, then saved when let go (with everything inside it). */
  // What's being carried is worked out once, when the carry starts (before anything has moved).
  const carryGroup = useRef<{ id: string; noteIds: Set<string>; strokeIds: Set<string> } | null>(null);
  const carryInk = (id: string, dx: number, dy: number, done: boolean) => {
    if (carryGroup.current?.id !== id) carryGroup.current = { id, ...contentsOf(id) };
    const group = carryGroup.current;
    if (!done) {
      setCarry({ noteIds: group.noteIds, strokeIds: group.strokeIds, dx, dy });
      return;
    }
    carryGroup.current = null;
    setCarry(null);
    if (!dx && !dy) return;
    const all = live.current.strokes ?? [];
    for (const sid of group.strokeIds) {
      const s = all.find((x) => x.id === sid);
      // A tied connector follows its notes; only free lines and shapes move by their points.
      if (s && (s.shape || (!s.fromId && !s.toId))) editStroke(sid, { points: shift(s.points, dx, dy) });
    }
    if (group.noteIds.size) canvasApi.current?.moveBy([...group.noteIds], dx, dy);
  };

  const handlers = (t: Thought) => ({
    onEdit: (v: string) => patch(t.id, { text: v }),
    // A drop (a picture) isn't a to-do: no strike, so a stray double-click or tick can't cross it out.
    onToggle: isDrop(t) ? undefined : () => patch(t.id, { status: t.status === "done" ? "open" : "done" }),
    onDelete: () => crumple(t.id),
  });

  const pickedColor =
    picked?.kind === "ink" ? ((paper.strokes ?? []).find((x) => x.id === picked.id)?.color ?? "ink") : picked?.kind === "text" ? (paper.thoughts.find((x) => x.id === picked.id)?.color ?? "ink") : null;
  useReminders(paper.thoughts, (t) => setToast({ text: `Reminder: ${t.text.length > 60 ? `${t.text.slice(0, 59)}…` : t.text}`, action: { label: "Show", run: () => router.push(`/drop/${paperId}?note=${encodeURIComponent(t.id)}`) } }));
  const items = sheetItems(paper);
  const onSheet = items;

  const todo = (t: Thought) => !isDrop(t);
  const bubble = (t: Thought, extra: { stream?: boolean; movable?: boolean } = {}) => (
    <ThoughtBubble
      {...bubbleProps(t, tz, fresh.has(t.id))}
      image={t.image}
      previews
      leaving={leaving.get(t.id) ?? null}
      returning={returning.has(t.id)}
      {...extra}
      {...handlers(t)}
      onDue={todo(t) ? () => setDueFor(t.id) : undefined}
      footer={t.dueAt && todo(t) ? <DueChip dueAt={t.dueAt} hasTime={!!t.dueHasTime} tz={tz} onClick={() => setDueFor(t.id)} /> : undefined}
      popover={
        dueFor === t.id ? (
          <DuePicker
            dueAt={t.dueAt ?? null}
            hasTime={!!t.dueHasTime}
            tz={tz}
            onClose={() => setDueFor(null)}
            onSave={(due) => {
              setDueFor(null);
              patch(t.id, { due });
              if (due?.hasTime) setToast({ text: "I'll remind you then" });
            }}
          />
        ) : undefined
      }
    />
  );

  const textItem = (t: Thought, stream = false) => (
    <PaperText
      text={t.text}
      seed={t.createdAt}
      fresh={fresh.has(t.id)}
      editing={writingText === t.id && !stream}
      interim={writingText === t.id ? voice.interim : ""}
      leaving={leaving.get(t.id) ?? null}
      onEdit={(v) => writeText(t.id, v)}
      onDelete={() => rubText(t.id)}
      onDone={() => setWritingText((w) => (w === t.id ? null : w))}
      size={t.size ?? 1}
      color={t.color ?? "ink"}
      selectable={!stream && tool === "select"}
      selected={!stream && picked?.kind === "text" && picked.id === t.id}
      onSelect={() => setPicked({ kind: "text", id: t.id })}
      onResize={(size) => (unsaved.current.has(t.id) ? update((p) => ({ ...p, thoughts: p.thoughts.map((x) => (x.id === t.id ? { ...x, size } : x)) })) : patch(t.id, { size }))}
    />
  );

  return (
    <div ref={page} className="canvas-surface canvas-page flex min-h-dvh flex-col bg-bg">
      <DropHeader
        floating
        me={me}
        title={<PaperBar paper={{ id: paperId, name: initial.name, createdAt: initial.createdAt, archivedAt: initial.archivedAt }} papers={papers} />}
        right={
          <>
            <TonightButton />
            <ShareButton paperId={paperId} />
            <SearchButton />
            <Link href="/drop/library" className="rounded-lg px-2.5 py-2 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
              Library
            </Link>
          </>
        }
      />
      <Toolbar
        tool={tool}
        onTool={setTool}
        listening={voice.state.kind === "recording"}
        shape={shapeKind}
        onShape={(k) => {
          setShapeKind(k);
          setTool("shape");
        }}
        color={pickedColor ?? inkColor}
        onColor={(c) => {
          setInkColor(c);
          // Something picked takes the colour too.
          if (picked?.kind === "ink") editStroke(picked.id, { color: c });
          else if (picked?.kind === "text") patch(picked.id, { color: c });
        }}
        showColors={tool === "draw" || tool === "shape" || tool === "text" || !!picked}
      />
      <main className="flex w-full flex-1 flex-col gap-4 px-4 pt-[72px] pb-28 sm:px-8 sm:pt-[76px]">
        {/* On a phone: a vertical stream of the notes. */}
        {onSheet.length === 0 ? (
          <PaperSurface label={paperTitle(initial)} className={`${COLUMN} flex flex-1 items-center justify-center sm:hidden`}>
            <span className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="font-hand text-[34px] font-bold">A fresh sheet.</span>
              <span className="text-mute">Tap Write…, and put it down.</span>
            </span>
          </PaperSurface>
        ) : (
          <PaperSurface label={paperTitle(initial)} className={`${COLUMN} flex flex-1 flex-col gap-3 sm:hidden`}>
            {onSheet.map((it) => (
              <Fly key={it.id} from={flights.get(it.id)}>
                <div data-item={it.id}>{it.thought.kind === "text" ? textItem(it.thought, true) : bubble(it.thought, { stream: true })}</div>
              </Fly>
            ))}
          </PaperSurface>
        )}
        {/* The page is the canvas: this runs the full width, and anything can go anywhere on it. */}
        <div
          ref={origin}
          onPointerDown={(e) => {
            // Select: a press on bare paper puts down whatever was picked.
            if (tool === "select" && !(e.target as HTMLElement).closest("[data-note], [data-ink-hit], button, textarea")) setPicked(null);
            // Text tool: a click on bare paper puts the pen down right there.
            if (tool !== "text" || e.button !== 0 || (e.target as HTMLElement).closest("[data-note], button, a, textarea")) return;
            e.preventDefault();
            placeText();
          }}
          // Text, Draw and the eraser keep a left press for themselves (the middle button or a scroll still pans).
          data-no-pan={tool === "select" ? undefined : ""}
          className={`relative -mx-4 flex-1 max-sm:hidden sm:-mx-8 ${tool === "text" ? "tool-text" : tool === "draw" ? "tool-draw" : tool === "erase" ? "tool-erase" : tool === "shape" ? "tool-shape" : ""}`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 px-4 sm:px-8">
            <span className="mx-auto flex w-full max-w-[1056px] items-center justify-end gap-1 px-2">
              {arranged && tool === "select" && (
                <button type="button" onClick={tidy} className="pointer-events-auto rounded-lg px-2.5 py-1 text-[13px] font-medium text-mute hover:bg-soft hover:text-ink">
                  Tidy up
                </button>
              )}
            </span>
          </div>
          {onSheet.length === 0 && strokes.length === 0 && (
            <span className="pointer-events-none absolute inset-x-0 top-[22vh] flex flex-col items-center gap-3 text-center">
              <span className="font-hand text-[40px] font-bold">A fresh sheet.</span>
              <span className="text-mute">
                {tool === "text"
                  ? "Click anywhere and write. Hold Space to speak."
                  : tool === "draw"
                    ? "Draw anything. A line from one thought to another ties them. A ring round things holds them together."
                    : tool === "shape"
                      ? "Drag a box or an ellipse. Shift for a square or circle."
                    : "Press Space to write, hold it to speak, or pick a tool above."}
              </span>
            </span>
          )}
          <FreeCanvas
            bare
            view={view}
            onPanBy={panBy}
            minHeight="calc(100dvh - 12rem)"
            label={paperTitle(initial)}
            items={onSheet}
            onArrange={onArrange}
            spotRef={spot}
            dragEnabled={tool === "select" || tool === "text"}
            apiRef={canvasApi}
            offset={carry ? ({ ids: carry.noteIds, dx: carry.dx, dy: carry.dy } satisfies Offset) : null}
            overlay={({ boxes, zoom }) => {
              boxesRef.current = boxes;
              return (
                <InkLayer
                  strokes={strokes}
                  boxes={boxes}
                  zoom={zoom}
                  mode={tool === "draw" ? "draw" : tool === "erase" ? "erase" : tool === "shape" ? "shape" : tool === "select" ? "select" : null}
                  shapeKind={shapeKind}
                  color={inkColor}
                  fresh={freshInk}
                  selectedId={picked?.kind === "ink" ? picked.id : null}
                  carry={carry ? { ids: carry.strokeIds, dx: carry.dx, dy: carry.dy } : null}
                  labelling={labelling}
                  onDraw={draw}
                  onErase={erase}
                  onPick={(id) => setPicked(id ? { kind: "ink", id } : null)}
                  onCarry={carryInk}
                  onReshape={(id, corners) => editStroke(id, { points: corners })}
                  onLabelStart={(id) => setLabelling(id)}
                  onLabel={(id, text) => {
                    setLabelling(null);
                    const s = (live.current.strokes ?? []).find((x) => x.id === id);
                    if (s && (s.label ?? "") !== text) editStroke(id, { label: text || null });
                  }}
                />
              );
            }}
            render={(it) => (
              <Fly from={flights.get(it.id)}>
                <div data-item={it.id}>{it.thought.kind === "text" ? textItem(it.thought) : bubble(it.thought, { movable: true })}</div>
              </Fly>
            )}
          />
        </div>

        <p className="text-center text-[13px] text-mute sm:hidden">Tap to edit · swipe right to strike, left to crumple</p>
      </main>

      {(onSheet.length > 0 || strokes.length > 0) && <ViewControls view={view} onZoom={(f) => zoomBy(f)} onReset={reset} onFit={fit} />}

      <TodayThought
        force={today}
        onUsed={(onPaper, newId) => {
          // Used: it lands on today's paper. Here, show it at once; elsewhere, go there with it highlighted.
          if (onPaper !== paperId) {
            router.push(`/drop/${onPaper}?note=${encodeURIComponent(newId)}`);
            return;
          }
          void call<DropPaper>(`/api/drop/papers/${paperId}`)
            .then((next) => {
              update(() => next);
              briefly(setFresh, [newId], 1200);
            })
            .catch(() => {});
          setToast({ text: "On today's paper" });
        }}
      />
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

      {(toast || error || voiceFailed) && (
        <div role={error || voiceFailed ? "alert" : "status"} className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-bg">
          <span className="flex-1">{error || voiceFailed || toast?.text}</span>
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
                voice.cancel();
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
