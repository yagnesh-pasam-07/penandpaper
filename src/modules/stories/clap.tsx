"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_CLAPS, shortCount } from "./reach";
import { readerId } from "./track";

let ctx: AudioContext | null = null;

/** Both clap buttons on a page (floating and at the end) share one count. */
const SYNC = "pp-clap-sync";
type ClapState = { slug: string; mine: number; total: number; burst: number };
const announce = (d: ClapState) => window.dispatchEvent(new CustomEvent<ClapState>(SYNC, { detail: d }));

/**
 * The clap's sound, made on the spot (no file to load, so it's instant and
 * overlaps itself on quick taps): a soft pen tap on paper, then a small warm
 * chime that climbs a note each time, so fifty claps sound like a little
 * melody rising, not fifty identical clicks.
 */
function clapSound(step: number) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.22;
    out.connect(ctx.destination);
    // The tap: a very short burst of filtered noise.
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 5));
    const tap = ctx.createBufferSource();
    tap.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    tap.connect(bp).connect(out);
    tap.start(t);
    // The chime: a pentatonic step up the scale per clap (never a sour note).
    const scale = [0, 2, 4, 7, 9];
    const semis = scale[step % 5] + 12 * Math.floor((step % 15) / 5);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 523.25 * 2 ** (semis / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + 0.01);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g).connect(out);
    osc.start(t + 0.01);
    osc.stop(t + 0.5);
  } catch {
    // No audio here: the clap still counts.
  }
}

function HandsGlyph({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 11.5 6.8 8.8a1.3 1.3 0 0 1 1.8-1.8l4.2 4.2" />
      <path d="m8.6 7-1-1a1.3 1.3 0 0 1 1.8-1.8l4.9 4.9" />
      <path d="M11.4 6.2a1.3 1.3 0 0 1 1.8-1.8l4 4c2.7 2.7 2.7 6.6 0 9.3a6.6 6.6 0 0 1-9.3 0l-3.6-3.6a1.3 1.3 0 0 1 1.8-1.8l2.1 2.1" />
      <path d="M15.5 3.2 16.3 1.6M18.6 4.8l1.5-.9M19.7 8l1.7-.2" />
    </svg>
  );
}

/**
 * Clap: tap as many times as a story moved you, up to 50. Each tap: a sound,
 * a tiny buzz on phones, a "+n" that floats up, and the count grows. Quick
 * taps are sent together a moment later. On a phone it floats at the bottom
 * right, under the thumb; on a computer it sits beside the share buttons.
 */
export function Clap({ slug, floating = false }: { slug: string; floating?: boolean }) {
  const [total, setTotal] = useState<number | null>(null);
  const [mine, setMine] = useState(0);
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the other button on the page.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ClapState>).detail;
      if (d.slug !== slug) return;
      setMine(d.mine);
      setTotal(d.total);
    };
    window.addEventListener(SYNC, on);
    return () => window.removeEventListener(SYNC, on);
  }, [slug]);

  // The floating one steps aside when the big clap at the end is on screen.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!floating) return;
    const end = document.querySelector(".story-clap-end");
    if (!end) return;
    const io = new IntersectionObserver((es) => setHidden(es.some((x) => x.isIntersecting)));
    io.observe(end);
    return () => io.disconnect();
  }, [floating]);

  useEffect(() => {
    let live = true;
    void fetch(`/api/stories/clap?slug=${encodeURIComponent(slug)}&reader=${encodeURIComponent(readerId())}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { mine: number; total: number }) => {
        if (!live) return;
        setTotal(d.total);
        setMine(d.mine);
      })
      .catch(() => setTotal(0));
    return () => {
      live = false;
    };
  }, [slug]);

  const send = useCallback(() => {
    const n = pending.current;
    pending.current = 0;
    if (!n) return;
    void fetch("/api/stories/clap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, reader: readerId(), n }), keepalive: true })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mine: number; total: number } | null) => {
        if (d) {
          setTotal(d.total);
          setMine(d.mine);
          announce({ slug, mine: d.mine, total: d.total, burst: 0 });
        }
      })
      .catch(() => {});
  }, [slug]);

  // Send anything still waiting when the reader leaves.
  useEffect(() => {
    const flush = () => document.visibilityState === "hidden" && send();
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      send();
    };
  }, [send]);

  const full = mine >= MAX_CLAPS;
  const clap = () => {
    if (full) return;
    clapSound(mine);
    try {
      navigator.vibrate?.(12);
    } catch {}
    const nextMine = mine + 1;
    const nextTotal = (total ?? 0) + 1;
    setMine(nextMine);
    setTotal(nextTotal);
    announce({ slug, mine: nextMine, total: nextTotal, burst: 0 });
    setBurst((b) => b + 1);
    setPop((p) => p + 1);
    pending.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      send();
      setBurst(0);
    }, 900);
  };

  const label = full ? "You gave this story all 50 claps" : mine ? `Clap again (you've given ${mine})` : "Clap for this story";
  return (
    <div
      aria-hidden={floating && hidden ? true : undefined}
      className={
        floating
          ? `story-clap-float fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 transition-[opacity,transform] duration-200 sm:hidden ${hidden ? "pointer-events-none translate-y-4 opacity-0" : ""}`
          : "story-clap-end flex items-center gap-3"
      }
    >
      <button
        type="button"
        onClick={clap}
        aria-label={label}
        title={label}
        className={`story-clap relative flex items-center justify-center rounded-full border font-sans transition-transform active:scale-90 ${
          floating ? "size-16 bg-sheet shadow-[0_12px_32px_-12px_var(--shadow)]" : "size-14"
        } ${mine ? "border-red text-red-text" : "border-line text-ink hover:border-ink"}`}
      >
        <span key={pop} className={pop ? "story-clap-pop flex" : "flex"}>
          <HandsGlyph filled={mine > 0} />
        </span>
        {burst > 0 && (
          <span key={`b${pop}`} aria-hidden="true" className="story-clap-plus absolute -top-9 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full bg-red text-[13px] font-semibold text-on-red">
            +{burst}
          </span>
        )}
        {floating && total !== null && total > 0 && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-ink px-1.5 text-[11px] leading-[18px] font-semibold text-bg tabular-nums">{shortCount(total)}</span>
        )}
      </button>
      {!floating && (
        <span className="flex flex-col font-sans leading-tight">
          <span className="text-[18px] font-semibold text-ink tabular-nums">{total === null ? "…" : shortCount(total)}</span>
          <span className="text-[12px] text-mute">{full ? "All 50 given. Thank you." : mine ? `${mine} from you` : "claps · tap more if it moved you"}</span>
        </span>
      )}
    </div>
  );
}
