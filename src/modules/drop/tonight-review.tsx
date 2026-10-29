"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { bubbleStyle } from "@/components/canvas/bubble";
import { HandText } from "@/components/canvas/thought-bubble";
import { CloseIcon } from "@/components/icons";
import { clock, shortDate } from "@/lib/time";
import { useViewerTz } from "./chrome";
import { firstYoutube } from "./logic";
import { countsOf, progressText, summaryText, TZ_COOKIE, type Decision } from "./tonight";
import type { TonightCard, TonightState } from "./tonight-server";

/** How long each choice plays before the next card comes (a pen line, a scrunch, a nudge). */
const PLAY_MS: Record<Decision, number> = { strike: 380, crumple: 450, keep: 170 };
/** How far a swipe has to go to count as a choice. */
const SWIPE = 80;
/** Less than this is a tap, not a swipe. */
const TAP = 10;
const UNDO_MS = 6000;

const KEYS: { action: Decision; label: string; key: string; hint: string }[] = [
  { action: "strike", label: "Strike", key: "s", hint: "S" },
  { action: "keep", label: "Keep", key: "k", hint: "K" },
  { action: "crumple", label: "Crumple", key: "x", hint: "X" },
];

function setTzCookie(tz: string) {
  document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
}

async function send(thoughtId: string, action: Decision | "undo"): Promise<void> {
  const res = await fetch("/api/drop/tonight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thoughtId, action }), cache: "no-store" });
  if (res.status === 401) {
    // The session is gone: a full load on purpose, so nothing on screen survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?next=/tonight";
    throw new Error("Signed out.");
  }
  if (res.status === 409 || res.status === 404) throw new Gone();
  if (!res.ok) throw new Error("Couldn't save that. Try again.");
}

/** The thought was changed or removed somewhere else; it just leaves the review. */
class Gone extends Error {}

/** A red rubber stamp, slightly askew, that comes down when the paper is closed. */
function ClosedStamp({ date }: { date: string }) {
  return (
    <span
      role="img"
      aria-label={`Paper closed, ${date}`}
      className="stamp-in inline-flex -rotate-[8deg] flex-col items-center rounded-[10px] border-[3px] border-red-text px-6 py-3 font-bold tracking-[0.14em] text-red-text uppercase"
    >
      <span className="text-[28px] leading-none">Paper closed ✓</span>
      <span className="mt-1.5 font-mono text-[13px] font-medium tracking-normal normal-case">{date}</span>
    </span>
  );
}

/**
 * Tonight's paper: one thought at a time, across every paper, each to be
 * struck, kept or crumpled. Everything arrives in one load, so going through
 * the cards never waits on the network; choices are saved in the background, in
 * order. Back puts the last card back as it was. Refreshing resumes at the
 * first card not decided, because the choices live on the thoughts.
 */
export function TonightReview({ initial, serverTz }: { initial: TonightState; serverTz: string }) {
  const router = useRouter();
  const tz = useViewerTz();
  const [cards, setCards] = useState<TonightCard[]>(initial.cards);
  const [index, setIndex] = useState(() => {
    const first = initial.cards.findIndex((c) => !c.decision);
    return first === -1 ? initial.cards.length : first;
  });
  const [playing, setPlaying] = useState<Decision | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; moved: boolean } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // The latest cards for the handlers and timers below (kept in step after each render).
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  const total = cards.length;
  const card: TonightCard | undefined = cards[index];
  const finished = total > 0 && index >= total;
  const summary = countsOf(cards.map((c) => c.decision));
  const decidedCount = cards.filter((c) => c.decision).length;

  // The server works out "today" from this cookie; the first visit (no cookie yet) may have used the default zone.
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser) return;
    setTzCookie(browser);
    if (browser !== serverTz) {
      try {
        if (sessionStorage.getItem("pp-tz-refreshed") === browser) return;
        sessionStorage.setItem("pp-tz-refreshed", browser);
      } catch {}
      router.refresh();
    }
  }, [serverTz, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [toast]);

  /** Saves in the background, one at a time and in order; a failure puts the card back. */
  const save = useCallback((thoughtId: string, action: Decision | "undo", onFail: (gone: boolean) => void) => {
    queue.current = queue.current.then(async () => {
      try {
        await send(thoughtId, action);
        setError("");
      } catch (e) {
        onFail(e instanceof Gone);
        if (!(e instanceof Gone)) setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
      }
    });
  }, []);

  const decide = useCallback(
    (action: Decision) => {
      const current = cardsRef.current[index];
      if (!current || busy.current) return;
      busy.current = true;
      setPlaying(action);
      setDrag(null);
      save(current.id, action, (gone) => {
        // It didn't save: take the choice back and show that card again.
        if (gone) {
          setCards((cs) => cs.filter((c) => c.id !== current.id));
          setIndex((i) => Math.min(i, cardsRef.current.length));
          return;
        }
        setCards((cs) => cs.map((c) => (c.id === current.id ? { ...c, decision: null } : c)));
        const at = cardsRef.current.findIndex((c) => c.id === current.id);
        if (at !== -1) setIndex(at);
      });
      setTimeout(() => {
        setCards((cs) => cs.map((c) => (c.id === current.id ? { ...c, decision: action } : c)));
        setIndex((i) => i + 1);
        setPlaying(null);
        busy.current = false;
        setToast(action === "crumple" ? current.id : null);
      }, PLAY_MS[action]);
    },
    [index, save],
  );

  /** Back: the last card goes back as it was, and is on screen again to be decided again. */
  const back = useCallback(() => {
    if (busy.current || index <= 0) return;
    const prev = cardsRef.current[index - 1];
    if (!prev) return;
    setToast(null);
    setCards((cs) => cs.map((c) => (c.id === prev.id ? { ...c, decision: null } : c)));
    setIndex(index - 1);
    save(prev.id, "undo", (gone) => {
      if (gone) setCards((cs) => cs.filter((c) => c.id !== prev.id));
    });
  }, [index, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/drop");
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        back();
        return;
      }
      const hit = KEYS.find((k) => k.key === e.key.toLowerCase());
      if (hit && card && !finished) {
        e.preventDefault();
        decide(hit.action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, card, decide, finished, router]);

  const onDown = (e: ReactPointerEvent) => {
    if (busy.current || (e.target as HTMLElement).closest("a")) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, dx: 0, moved: false });
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    setDrag({ ...drag, dx, moved: drag.moved || Math.abs(dx) > TAP || Math.abs(e.clientY - drag.y) > TAP });
  };
  const onUp = () => {
    if (!drag) return;
    const { dx, moved } = drag;
    setDrag(null);
    if (dx > SWIPE) decide("strike");
    else if (dx < -SWIPE) decide("crumple");
    else if (!moved) decide("keep");
  };

  const youtube = card ? firstYoutube(card.text) : null;
  const leaving = playing;
  const swipe = drag?.moved ? drag.dx : 0;
  const struckNow = playing === "strike" || card?.decision === "strike";
  const paperLabel = card ? card.paperName?.trim() || "Untitled" : "";

  const shell = "canvas-surface canvas-page flex min-h-dvh flex-col bg-bg text-ink";

  if (total === 0) {
    return (
      <main className={`${shell} items-center justify-center gap-5 px-6 text-center`}>
        <h1 className="font-hand text-[40px] leading-none font-bold">Nothing to review</h1>
        <p className="max-w-[360px] text-mute">Nothing was dropped today, or it has all been dealt with already.</p>
        <Link href="/drop" className="inline-flex h-12 items-center rounded-2xl bg-ink px-6 font-semibold text-bg">
          Back to my paper
        </Link>
      </main>
    );
  }

  if (finished) {
    return (
      <main className={`${shell} items-center justify-center gap-7 px-6 text-center`} aria-live="polite">
        <ClosedStamp date={shortDate(initial.date)} />
        <p className="font-hand text-[32px] leading-tight font-bold">{summaryText(summary)}</p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/drop" className="inline-flex h-12 items-center rounded-2xl bg-ink px-8 font-semibold text-bg">
            Good night
          </Link>
          <button type="button" onClick={back} className="rounded-lg px-3 py-1.5 text-sm font-medium text-mute hover:bg-soft hover:text-ink">
            ← Change the last one
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-text">{error}</p>}
      </main>
    );
  }

  return (
    <main className={shell}>
      <header className="mx-auto flex w-full max-w-[720px] items-center gap-3 px-4 pt-4 sm:px-8">
        <Link href="/drop" aria-label="Leave the review (Esc)" title="Leave (Esc). Your progress is kept." className="flex size-10 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink">
          <CloseIcon size={14} />
        </Link>
        <h1 className="font-hand text-[26px] leading-none font-bold">Tonight&apos;s paper</h1>
        <span className="ml-auto text-[15px] font-medium text-mute" aria-live="polite" data-testid="progress">
          {progressText(index, total)}
        </span>
      </header>
      <div className="mx-auto mt-3 h-1 w-[calc(100%-2rem)] max-w-[656px] overflow-hidden rounded-full bg-line sm:w-[calc(100%-4rem)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={decidedCount} aria-label="Reviewed">
        <div className="h-full rounded-full bg-red-text motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${(decidedCount / total) * 100}%` }} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-44 sm:pb-16">
        <div
          key={card!.id}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDrag(null)}
          style={{ transform: swipe ? `translateX(${swipe}px) rotate(${swipe / 40}deg)` : undefined, touchAction: "pan-y" }}
          className={`relative w-full max-w-[560px] cursor-pointer select-none ${leaving === "crumple" ? "crumple-away" : ""} ${leaving === "keep" ? "-translate-y-2 opacity-0 motion-safe:transition-all motion-safe:duration-150" : ""} ${drag ? "" : "motion-safe:transition-transform"}`}
        >
          {drag?.moved && Math.abs(swipe) > 24 && (
            <span aria-hidden="true" className={`absolute top-1/2 -translate-y-1/2 font-hand text-3xl font-bold text-red-text ${swipe > 0 ? "left-4" : "right-4"}`}>
              {swipe > 0 ? "strike" : "crumple"}
            </span>
          )}
          <div
            style={bubbleStyle(card!.shape, false, card!.id)}
            className={`paper-note relative flex min-h-[260px] flex-col items-start justify-center gap-4 px-8 py-10 text-left ${struckNow ? "is-done" : ""}`}
            aria-label={`Thought ${index + 1} of ${total}`}
          >
            {card!.image && (
              // eslint-disable-next-line @next/next/no-img-element -- a small data URL the person pasted; nothing for next/image to optimise
              <img src={card!.image} alt="" draggable={false} className="max-h-[34dvh] w-full rounded-xl object-contain" />
            )}
            {youtube && !card!.image && (
              // eslint-disable-next-line @next/next/no-img-element -- a YouTube thumbnail
              <img src={`https://i.ytimg.com/vi/${youtube.id}/hqdefault.jpg`} alt="" draggable={false} className="aspect-video w-full rounded-xl object-cover" />
            )}
            {card!.text && (
              <span className="hand font-note text-[28px] leading-snug break-words whitespace-pre-wrap sm:text-[34px]">
                <span className="pen-strike">
                  <HandText text={card!.text} seed={card!.id} />
                </span>
              </span>
            )}
          </div>
        </div>
        <p className="text-center text-[13px] text-mute" data-testid="where">
          {paperLabel} · {clock(new Date(card!.createdAt), tz)}
        </p>

        <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6 pb-5 sm:static sm:bg-none sm:p-0">
          <div className="flex w-full max-w-[560px] gap-2 sm:gap-3">
            <button type="button" onClick={back} disabled={index === 0} aria-label="Back (←)" title="Back (← or Backspace)" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-sheet text-xl text-mute hover:bg-soft disabled:opacity-35 sm:h-12 sm:w-12">
              ←
            </button>
            {KEYS.map((k) => (
              <button
                key={k.action}
                type="button"
                onClick={() => decide(k.action)}
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-2xl border text-base font-semibold sm:h-12 ${k.action === "strike" ? "border-red-text/60 bg-red-soft text-red-text hover:bg-red-soft/70" : "border-line bg-sheet text-ink hover:bg-soft"}`}
              >
                {k.label}
                <span className="text-[11px] font-normal text-mute max-sm:hidden" aria-hidden="true">
                  {k.hint}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-mute max-sm:hidden">S strike · K or click keep · X crumple · ← back · Esc leave</p>
          <p className="text-[12px] text-mute sm:hidden">Swipe right to strike, left to crumple, tap to keep</p>
          {error && (
            <p role="alert" className="text-sm text-red-text">
              {error}
            </p>
          )}
        </div>
      </div>

      {toast && cards[index - 1]?.id === toast && (
        <div role="status" className="fixed top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-sheet px-4 py-2.5 text-sm shadow-[0_18px_40px_-24px_var(--shadow)]">
          Crumpled
          <button type="button" onClick={back} className="font-semibold text-red-text underline-offset-2 hover:underline">
            Undo
          </button>
        </div>
      )}
    </main>
  );
}

