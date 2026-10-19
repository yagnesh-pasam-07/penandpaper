"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { bubbleStyle } from "@/components/canvas/bubble";
import { HandText } from "@/components/canvas/thought-bubble";
import { shortDate } from "@/lib/time";
import { btn } from "@/components/ui";
import { call, DeskStamp, DropHeader, type Me } from "./chrome";
import { RankMark } from "@/components/canvas/rank-mark";
import { deskCards, deskSummary, MAX_NEXT_RANK, type DeskCard, type DeskChoice, type DropPaper } from "./logic";

const CHOICES: { choice: DeskChoice; key: string; label: string; hint: string }[] = [
  { choice: "tomorrow", key: "t", label: "→ Tomorrow", hint: "T" },
  { choice: "keep", key: "k", label: "✎ Keep as idea", hint: "K" },
  { choice: "crumple", key: "x", label: "✕ Crumple", hint: "X" },
  { choice: "done", key: "d", label: "✓ Done already", hint: "D" },
];

/** The thoughts a card stands for: one, or a stack's open ones. */
const idsOf = (card: DeskCard) => (card.kind === "thought" ? [card.id] : card.open.map((t) => t.id));

const SWIPE = 70;

/**
 * Clear desk: once a day, decide what happens to each open task, one card at
 * a time, then stamp the desk cleared. Each decision saves as it's made
 * (crumples go out when you finish or leave, so Back can still take one back).
 */
export function ClearDesk({ initial, me }: { initial: DropPaper; me: Me }) {
  const [cards, setCards] = useState<DeskCard[]>(() => deskCards(initial));
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<DeskChoice[]>([]);
  // Nothing open: the desk is already clear.
  const [finished, setFinished] = useState(() => deskCards(initial).length === 0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  // The last step: which of tomorrow's thoughts start tomorrow numbered 1, 2, 3.
  const [picking, setPicking] = useState(false);
  const [top, setTop] = useState<string[]>([]);
  // Crumples wait here until the end (or the page closing), so Back can undo them.
  const crumples = useRef(new Map<number, () => Promise<unknown>>());
  const empty = cards.length === 0;
  const card = cards[step];

  const flush = useCallback(() => {
    const sends = [...crumples.current.values()];
    crumples.current.clear();
    return Promise.all(sends.map((s) => s().catch(() => {})));
  }, []);

  useEffect(() => {
    const leave = () => void flush();
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [flush]);

  const finish = useCallback(async () => {
    setFinished(true);
    await flush();
    await call("/api/drop/clear", { method: "POST" }).catch(() => {});
  }, [flush]);

  useEffect(() => {
    if (empty) void call("/api/drop/clear", { method: "POST" }).catch(() => {});
  }, [empty]);

  const send = async (work: Promise<unknown>) => {
    try {
      await work;
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const decide = useCallback(
    (choice: DeskChoice) => {
      if (!card || finished) return;
      const ids = idsOf(card);
      if (choice === "keep") {
        void send(Promise.all(ids.map((id) => call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "ink", thought: id, to: "pencil" }) }))));
      } else if (choice === "done") {
        void send(Promise.all(ids.map((id) => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) }))));
      } else if (choice === "crumple") {
        const c = card;
        crumples.current.set(step, () =>
          c.kind === "stack"
            ? call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "crumple", stack: c.id }), keepalive: true })
            : call(`/api/drop/thoughts/${c.id}`, { method: "DELETE", keepalive: true }),
        );
      }
      const next = [...choices.slice(0, step), choice];
      setChoices(next);
      if (step + 1 < cards.length) setStep(step + 1);
      // Anything going to tomorrow? Pick its top 3 first.
      else if (next.includes("tomorrow")) setPicking(true);
      else void finish();
    },
    [card, cards.length, choices, finish, finished, step],
  );

  /** Back: changes the last decision (puts it back as it was). */
  const back = useCallback(() => {
    if (step === 0 || finished) return;
    const prev = step - 1;
    const was = choices[prev];
    const ids = idsOf(cards[prev]);
    if (was === "keep") void send(Promise.all(ids.map((id) => call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "ink", thought: id, to: "pen" }) }))));
    if (was === "done") void send(Promise.all(ids.map((id) => call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "open" }) }))));
    crumples.current.delete(prev);
    setChoices(choices.slice(0, prev));
    setStep(prev);
  }, [cards, choices, finished, step]);

  /** A stack split into its thoughts, each decided on its own. */
  const split = () => {
    if (!card || card.kind !== "stack") return;
    void send(call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "unstack", stack: card.id, spots: [] }) }));
    const loose: DeskCard[] = card.open.map((t) => ({ kind: "thought", id: t.id, text: t.text }));
    setCards([...cards.slice(0, step), ...loose, ...cards.slice(step + 1)]);
  };

  const tomorrow = cards.filter((_, i) => choices[i] === "tomorrow");
  const pickTop = (id: string) => setTop((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < MAX_NEXT_RANK ? [...t, id] : t));
  const finishTop = async () => {
    if (top.length) await send(call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "nextRank", ids: top }) }));
    setPicking(false);
    void finish();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || finished || picking) return;
      if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        back();
        return;
      }
      const c = CHOICES.find((x) => x.key === e.key.toLowerCase());
      if (c) {
        e.preventDefault();
        decide(c.choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, decide, finished, picking]);

  // Swipes on a phone: right = tomorrow, left = crumple, up = keep as idea.
  const onDown = (e: ReactPointerEvent) => e.pointerType !== "mouse" && setDrag({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
  const onMove = (e: ReactPointerEvent) => drag && setDrag({ ...drag, dx: e.clientX - drag.x, dy: e.clientY - drag.y });
  const onUp = () => {
    if (!drag) return;
    const { dx, dy } = drag;
    setDrag(null);
    if (dy < -SWIPE && Math.abs(dy) > Math.abs(dx)) decide("keep");
    else if (dx > SWIPE) decide("tomorrow");
    else if (dx < -SWIPE) decide("crumple");
  };

  const today = shortDate(initial.date);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DropHeader me={me} title={<h1 className="font-hand text-[26px] leading-none font-bold">Clear desk</h1>} />
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center gap-7 px-4 pt-6 pb-16 text-center">
        {picking && !finished ? (
          <div className="flex w-full max-w-[460px] flex-col items-center gap-5">
            <h2 className="font-hand text-[34px] leading-tight font-bold">Pick tomorrow&apos;s top 3</h2>
            <p className="text-mute">Tap in order. They&apos;ll be waiting tomorrow, numbered.</p>
            <ul className="flex w-full flex-col gap-2">
              {tomorrow.map((c) => {
                const n = top.indexOf(c.id) + 1;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickTop(c.id)}
                      aria-pressed={n > 0}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left ${n ? "border-red-text/50 bg-red-soft/40" : "border-line bg-sheet hover:bg-soft"}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center">{n ? <RankMark n={n} size="sm" /> : null}</span>
                      <span className="min-w-0 flex-1 truncate font-note text-[18px]">{c.kind === "thought" ? c.text : `${c.label} · ${c.open.length}`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              {!top.length && (
                <button type="button" onClick={() => void finishTop()} className="h-12 rounded-2xl px-4 font-medium text-mute hover:bg-soft">
                  Skip
                </button>
              )}
              <button type="button" onClick={() => void finishTop()} disabled={!top.length} className={`${btn.primary} disabled:opacity-40`}>
                Done
              </button>
            </div>
          </div>
        ) : finished ? (
          <div className="flex flex-col items-center gap-6" aria-live="polite">
            <DeskStamp date={today} animate />
            <p className="font-hand text-[30px] leading-tight font-bold">{deskSummary(choices)}</p>
            {choices.length === 0 && !empty ? null : <p className="text-mute">Your head can rest. Tomorrow starts with what you chose to keep.</p>}
            <Link href="/drop" className={btn.primary}>
              Back to my paper
            </Link>
          </div>
        ) : card ? (
          <>
            <div className="flex w-full items-center justify-between text-sm text-mute">
              <button type="button" onClick={back} disabled={step === 0} className="rounded-lg px-2.5 py-1.5 font-medium hover:bg-soft hover:text-ink disabled:opacity-40">
                ← Back
              </button>
              <span aria-live="polite">
                {step + 1} of {cards.length}
              </span>
              <Link href="/drop" className="rounded-lg px-2.5 py-1.5 font-medium hover:bg-soft hover:text-ink">
                Stop here
              </Link>
            </div>

            <div
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              style={{
                ...bubbleStyle(step % 6, false, `desk-${card.id}`),
                transform: drag ? `translate(${drag.dx}px, ${Math.min(0, drag.dy)}px) rotate(${drag.dx / 30}deg)` : "rotate(-1deg)",
              }}
              className="paper-note flex min-h-[220px] w-full max-w-[460px] touch-none flex-col items-start justify-center gap-3 px-8 py-8 text-left"
            >
              {card.kind === "thought" ? (
                <span className="hand font-note text-[28px] leading-tight">
                  <HandText text={card.text} seed={card.id} />
                </span>
              ) : (
                <>
                  <span className="text-[15px] font-semibold text-mute">
                    {card.label} · {card.open.length} open
                  </span>
                  <ul className="flex flex-col gap-1">
                    {card.open.map((t) => (
                      <li key={t.id} className="hand font-note text-[22px] leading-tight">
                        {t.text}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={split} className="text-sm font-medium text-mute underline underline-offset-2 hover:text-ink">
                    Decide each one on its own
                  </button>
                </>
              )}
            </div>

            <div className="grid w-full max-w-[460px] grid-cols-2 gap-2.5">
              {CHOICES.map((c) => (
                <button
                  key={c.choice}
                  type="button"
                  onClick={() => decide(c.choice)}
                  className={`flex h-14 items-center justify-between rounded-2xl border border-line px-4 text-[15px] font-semibold hover:bg-soft ${
                    c.choice === "tomorrow" ? "bg-ink text-bg hover:bg-ink" : "bg-sheet"
                  }`}
                >
                  {c.label}
                  <kbd className="rounded border border-current/30 px-1.5 font-sans text-[11px] opacity-70">{c.hint}</kbd>
                </button>
              ))}
            </div>
            <p className="text-[13px] text-mute sm:hidden">Swipe right for tomorrow, left to crumple, up to keep as an idea.</p>
            <p className="text-[13px] text-mute max-sm:hidden">Ideas in pencil aren&apos;t here: they&apos;re already kept.</p>
          </>
        ) : null}
        {error && (
          <p role="alert" className="text-sm text-red-text">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
