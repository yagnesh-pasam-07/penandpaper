"use client";

import { useRef, useState, type KeyboardEvent } from "react";

export type Shot = {
  id: string;
  label: string;
  alt: string;
  light: string;
  /** The dark twin; the light file shows in both themes when there isn't one. */
  dark: string | null;
  /** Light and dark halves of one screen, cut diagonally (the "Themes" tab). */
  split?: boolean;
};

const FRAME = "relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-line bg-soft/40 shadow-[0_30px_60px_-36px_var(--shadow)]";

/** One screenshot, or both of its themes (the page's own theme picks which). */
function Picture({ shot, eager }: { shot: Shot; eager: boolean }) {
  const loading = eager ? "eager" : "lazy";
  if (shot.split && shot.dark) {
    // Light on the left, dark on the right, cut on a slant. The page theme doesn't matter here.
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} className="absolute inset-0 size-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.dark} alt="" aria-hidden="true" width={1600} height={1000} loading={loading} className="absolute inset-0 size-full object-cover [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]" />
      </>
    );
  }
  if (shot.dark) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} className="shot-light absolute inset-0 size-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shot.dark} alt="" aria-hidden="true" width={1600} height={1000} loading={loading} className="shot-dark absolute inset-0 size-full object-cover" />
      </>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={shot.light} alt={shot.alt} width={1600} height={1000} loading={loading} className="absolute inset-0 size-full object-cover" />;
}

/**
 * The hero screenshot with a few small text tabs under it. The first screen is
 * server-rendered, so the page shows it with no script; the tabs switch the picture.
 */
export function ShotTabs({ shots }: { shots: Shot[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const shot = shots[active] ?? shots[0];

  /** Fetch a screen's pictures ahead of the click, so the swap is instant. */
  const warm = (s: Shot) => {
    for (const src of [s.light, s.dark]) {
      if (!src) continue;
      const img = new Image();
      img.src = src;
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + shots.length) % shots.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div id="shot-panel" role="tabpanel" aria-labelledby={`shot-tab-${shot.id}`} className={FRAME}>
        <div key={shot.id} className="shot-fade absolute inset-0">
          <Picture shot={shot} eager={active === 0} />
        </div>
      </div>
      <div role="tablist" aria-label="What Pen & Paper looks like" onKeyDown={onKey} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {shots.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`shot-tab-${s.id}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="shot-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onPointerEnter={() => warm(s)}
            onFocus={() => warm(s)}
            className={`rounded-md px-1 py-1.5 text-[14px] underline-offset-[6px] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text ${
              i === active ? "text-ink underline decoration-red-text decoration-2" : "text-mute"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
