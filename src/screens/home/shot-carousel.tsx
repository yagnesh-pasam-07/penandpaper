"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type Shot = {
  id: string;
  label: string;
  alt: string;
  /** One plain line under the stage when this slide is in front. */
  blurb: string;
  light: string;
  /** The dark twin; the light file shows in both themes when there isn't one. */
  dark: string | null;
  /** Light and dark halves of one screen, cut diagonally (the "Light & dark" slide). */
  split?: boolean;
};

/** How long a slide stays in front, and how soon it starts again after you stop touching it. */
const EVERY_MS = 4500;
const RESUME_MS = 2000;
/** Pointer travel (px) before a press counts as a swipe. */
const SWIPE_PX = 40;

/** Where slide `i` sits relative to the front one: 0 in front, ±1 beside it, anything else out of sight. */
export function relativeTo(i: number, active: number, n: number): number {
  const d = (((i - active) % n) + n) % n;
  return d > n / 2 ? d - n : d;
}

function Picture({ shot, eager }: { shot: Shot; eager: boolean }) {
  const loading = eager ? "eager" : "lazy";
  const img = "absolute inset-0 size-full object-cover select-none";
  if (shot.split && shot.dark) {
    // Light on the left, dark on the right, cut on a slant. The page theme doesn't matter here.
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} draggable={false} className={img} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.dark} alt="" aria-hidden="true" width={1600} height={1000} loading={loading} draggable={false} className={`${img} [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]`} />
      </>
    );
  }
  if (shot.dark) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} draggable={false} className={`shot-light ${img}`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.dark} alt="" aria-hidden="true" width={1600} height={1000} loading={loading} draggable={false} className={`shot-dark ${img}`} />
      </>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} draggable={false} className={img} />;
}

function Arrow({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={dir === "prev" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROUND =
  "absolute top-[calc(var(--shot-w)*0.3125_+_1rem)] z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-sheet/90 text-ink opacity-0 shadow-[0_8px_24px_-12px_var(--shadow)] backdrop-blur transition-opacity hover:bg-sheet focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text group-hover/stage:opacity-100 max-sm:hidden";

/**
 * The hero screenshots as a looping carousel: the front slide sharp, its two
 * neighbours blurred beside it. It advances on its own (and stops for hover,
 * focus, touch, a hidden tab and reduced motion, with a pause button); you can
 * also swipe, scroll sideways, use the arrow keys, the round buttons or the dots.
 * Slide one is rendered in front on the server, so the page works with no script.
 */
export function ShotCarousel({ shots }: { shots: Shot[] }) {
  const n = shots.length;
  const [active, setActive] = useState(0);
  // The visitor's own choice to pause, and the temporary reasons (hover, focus, drag, hidden tab).
  const [userPaused, setUserPaused] = useState(false);
  const [hold, setHold] = useState({ hover: false, focus: false, drag: false, hidden: false });
  const [reduced, setReduced] = useState(false);
  // After letting go of the carousel, start again sooner than a full turn.
  const [soon, setSoon] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const wheelAt = useRef(0);
  const swipedAt = useRef(0);

  const held = hold.hover || hold.focus || hold.drag || hold.hidden;
  const playing = !userPaused && !reduced;
  const running = playing && !held;

  const go = useCallback(
    (to: number) => {
      setActive(((to % n) + n) % n);
    },
    [n],
  );

  // Reduced motion: never advance on its own.
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);

  // A hidden tab shouldn't keep turning.
  useEffect(() => {
    const set = () => setHold((h) => ({ ...h, hidden: document.visibilityState === "hidden" }));
    set();
    document.addEventListener("visibilitychange", set);
    return () => document.removeEventListener("visibilitychange", set);
  }, []);

  // The turn itself: one timeout per slide, so any change of slide or of pause restarts it.
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      setSoon(false);
      setActive((a) => (a + 1) % n);
    }, soon ? RESUME_MS : EVERY_MS);
    return () => clearTimeout(t);
  }, [running, active, soon, n]);

  // Fetch the next two screens' pictures ahead of time, so the swap is instant.
  useEffect(() => {
    for (const k of [1, 2]) {
      const s = shots[(active + k) % n];
      for (const src of [s.light, s.dark]) {
        if (!src) continue;
        const img = new Image();
        img.src = src;
      }
    }
  }, [active, shots, n]);

  // Sideways wheel or trackpad scroll turns it (non-passive, so the page doesn't also pan).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 18) return;
      e.preventDefault();
      const now = Date.now();
      if (now - wheelAt.current < 550) return;
      wheelAt.current = now;
      setActive((a) => (a + (e.deltaX > 0 ? 1 : -1) + n) % n);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [n]);

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(active - 1);
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { x: e.clientX, id: e.pointerId, moved: false };
    setHold((h) => ({ ...h, drag: true }));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (Math.abs(e.clientX - p.x) > SWIPE_PX) p.moved = true;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    setHold((h) => ({ ...h, drag: false }));
    setSoon(true);
    const dx = e.clientX - p.x;
    if (p.moved) {
      swipedAt.current = Date.now();
      go(active + (dx < 0 ? 1 : -1));
    }
  };

  const front = shots[active];
  const label = `${active + 1} of ${n}`;

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="What Pen & Paper looks like"
      tabIndex={0}
      onKeyDown={onKey}
      onFocus={() => setHold((h) => ({ ...h, focus: true }))}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setHold((h) => ({ ...h, focus: false }));
        setSoon(true);
      }}
      onPointerEnter={() => setHold((h) => ({ ...h, hover: true }))}
      onPointerLeave={() => {
        setHold((h) => ({ ...h, hover: false }));
        setSoon(true);
      }}
      className="shot-carousel flex w-full flex-col items-center gap-5 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-text"
    >
      <div
        ref={stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="group/stage relative w-full touch-pan-y overflow-hidden py-4 select-none shot-stage"
        style={{ height: "calc(var(--shot-w) * 0.625 + 2rem)" }}
      >
        <button type="button" aria-label="Previous screen" onClick={() => go(active - 1)} className={`${ROUND} left-[max(0.75rem,calc(50%_-_var(--shot-w)/2_-_1.5rem))]`}>
          <Arrow dir="prev" />
        </button>
        <button type="button" aria-label="Next screen" onClick={() => go(active + 1)} className={`${ROUND} right-[max(0.75rem,calc(50%_-_var(--shot-w)/2_-_1.5rem))]`}>
          <Arrow dir="next" />
        </button>
        {shots.map((s, i) => {
          const rel = relativeTo(i, active, n);
          const pos = rel === 0 ? "0" : rel === 1 ? "1" : rel === -1 ? "-1" : "far";
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${s.label}`}
              aria-hidden={rel === 0 ? undefined : true}
              data-pos={pos}
              onClick={() => {
                // A swipe also ends in a click; only a plain click on a side slide brings it forward.
                if (rel !== 0 && Date.now() - swipedAt.current > 300 && Math.abs(rel) === 1) {
                  go(i);
                  setSoon(true);
                }
              }}
              className="shot-slide absolute top-4 left-1/2 aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-soft/40 shadow-[0_30px_60px_-36px_var(--shadow)]"
            >
              <Picture shot={s} eager={Math.abs(rel) <= 1} />
            </div>
          );
        })}
      </div>

      <div className="flex min-h-[3.25rem] flex-col items-center gap-1 text-center">
        <p className="text-[16px]" aria-live={running ? "off" : "polite"} aria-atomic="true">
          <span className="font-medium text-ink">{front.label}</span>
          <span className="text-mute">
            {"  "}
            {front.blurb}
          </span>
          <span className="sr-only"> ({label})</span>
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setUserPaused((p) => !p);
            setSoon(false);
          }}
          aria-label={userPaused ? "Play the carousel" : "Pause the carousel"}
          aria-pressed={userPaused}
          className="flex size-8 items-center justify-center rounded-full text-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2" y="1.5" width="2.8" height="9" rx="0.8" fill="currentColor" />
              <rect x="7.2" y="1.5" width="2.8" height="9" rx="0.8" fill="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-1.5">
          {shots.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${s.label}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => {
                go(i);
                setSoon(true);
              }}
              className="group flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-text"
            >
              <span className={`block rounded-full transition-all duration-300 ${i === active ? "h-2 w-5 bg-red-text" : "size-2 bg-line group-hover:bg-mute"}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
