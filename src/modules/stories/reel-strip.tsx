"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * The projector's voice, made live (no file): a short metal *clack* as each
 * frame passes the gate, a softer *thunk* when the strip settles. Like a
 * 1990s slide projector or a film viewer's ratchet, kept quiet.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** A clack (`hard`, a frame passing) or a thunk (the strip coming to rest). `speed` 0–1 lifts it a little. */
function clack(hard: boolean, speed = 0) {
  const a = ctx;
  if (!a || a.state !== "running" || !noise) return;
  const t = a.currentTime;
  const out = a.createGain();
  out.gain.value = hard ? 0.16 : 0.11;
  out.connect(a.destination);

  // The metal: a burst of noise through a narrow band, gone in a few milliseconds.
  const click = a.createBufferSource();
  click.buffer = noise;
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = (hard ? 2400 : 1500) + speed * 900 + Math.random() * 300;
  band.Q.value = 2.5;
  const cg = a.createGain();
  cg.gain.setValueAtTime(hard ? 0.9 : 0.5, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + (hard ? 0.025 : 0.04));
  click.connect(band).connect(cg).connect(out);
  click.start(t);
  click.stop(t + 0.05);

  // The body: a low knock as the frame drops into the gate.
  const knock = a.createOscillator();
  knock.type = "triangle";
  knock.frequency.setValueAtTime(hard ? 170 : 120, t);
  knock.frequency.exponentialRampToValueAtTime(hard ? 70 : 50, t + 0.06);
  const kg = a.createGain();
  kg.gain.setValueAtTime(hard ? 0.55 : 0.7, t);
  kg.gain.exponentialRampToValueAtTime(0.001, t + (hard ? 0.07 : 0.12));
  knock.connect(kg).connect(out);
  knock.start(t);
  knock.stop(t + 0.14);
}

const SOUND_KEY = "pp-reel-sound";


/** Sound on or off, remembered on this device; on until someone turns it off. */
const soundListeners = new Set<() => void>();
const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
};
const subscribeSound = (f: () => void) => {
  soundListeners.add(f);
  return () => soundListeners.delete(f);
};
function writeSound(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {}
  soundListeners.forEach((f) => f());
}

/**
 * A strip of clippings that runs like film through a projector: no scrollbar,
 * a clack as each frame passes, and grab-and-pull with the mouse. Swipe and trackpad work as usual; the page's own
 * up-and-down scroll is never taken over.
 */
export function ReelStrip({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLUListElement>(null);
  const sound = useSyncExternalStore(subscribeSound, readSound, () => true);
  const soundRef = useRef(true);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const dragged = useRef(false);

  // Browsers keep sound off until the visitor touches the page: wake it on their first press anywhere.
  useEffect(() => {
    const wake = () => {
      if (!soundRef.current) return;
      const a = audio();
      if (a && a.state === "suspended") void a.resume();
    };
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // A clack each time a frame passes the gate; a thunk when the strip comes to rest.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const pitch = () => {
      const first = el.querySelector("li");
      const next = first?.nextElementSibling as HTMLElement | null;
      return first && next ? next.offsetLeft - (first as HTMLElement).offsetLeft : 250;
    };
    let frame = Math.round(el.scrollLeft / pitch());
    let lastAt = 0;
    let lastX = el.scrollLeft;
    let lastT = performance.now();
    let rest: ReturnType<typeof setTimeout> | null = null;
    let moved = false;
    const onScroll = () => {
      const now = performance.now();
      const speed = Math.min(1, Math.abs(el.scrollLeft - lastX) / Math.max(1, now - lastT) / 3);
      lastX = el.scrollLeft;
      lastT = now;
      moved = true;
      const f = Math.round(el.scrollLeft / pitch());
      if (f !== frame && now - lastAt > 45) {
        frame = f;
        lastAt = now;
        if (soundRef.current) clack(true, speed);
      }
      if (rest) clearTimeout(rest);
      rest = setTimeout(() => {
        if (moved && soundRef.current) clack(false);
        moved = false;
      }, 140);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rest) clearTimeout(rest);
    };
  }, []);

  // Grab and pull with the mouse, like pulling film by hand (touch and trackpads scroll natively).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let start: { x: number; left: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      start = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
      dragged.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      if (!dragged.current && Math.abs(dx) < 5) return;
      if (!dragged.current) {
        dragged.current = true;
        el.setPointerCapture(e.pointerId);
        // Free movement while held; it clicks into a frame when let go.
        el.style.scrollSnapType = "none";
        el.style.cursor = "grabbing";
      }
      el.scrollLeft = start.left - dx;
    };
    const up = () => {
      if (!start) return;
      start = null;
      el.style.cursor = "";
      if (dragged.current) {
        el.style.scrollSnapType = "";
        // Let the browser settle it on the nearest frame.
        el.scrollBy({ left: 1, behavior: "smooth" });
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  const toggle = () => {
    const on = !sound;
    soundRef.current = on;
    writeSound(on);
    if (on) {
      const a = audio();
      if (a?.state === "suspended") void a.resume();
      clack(true);
    }
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        aria-label={label}
        // A pull ends in a click; don't open the post you were dragging past.
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault();
            e.stopPropagation();
            dragged.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
        data-reel=""
        className="relative flex cursor-grab snap-x snap-mandatory gap-10 overflow-x-auto scroll-px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] pt-12 pb-12 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={sound}
        aria-label={sound ? "Projector sound on. Turn it off" : "Projector sound off. Turn it on"}
        title={sound ? "Sound on" : "Sound off"}
        className="absolute -top-1 right-[max(1.25rem,calc((100vw-1120px)/2+2rem))] flex size-8 items-center justify-center rounded-full text-mute hover:bg-soft hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
          {sound ? (
            <>
              <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8" />
              <path d="M12.4 3.9a6 6 0 0 1 0 8.2" />
            </>
          ) : (
            <path d="M10.5 6l3.5 4M14 6l-3.5 4" />
          )}
        </svg>
      </button>
    </div>
  );
}
