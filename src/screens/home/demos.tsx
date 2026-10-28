"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";

const reducedQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");

/** True when the visitor asked for less motion (false while the server renders). */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const q = reducedQuery();
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => reducedQuery().matches,
    () => false,
  );
}

/**
 * Steps through a demo's frames while it's on screen, and stops when it isn't
 * (or with reduced motion, where it rests on `still`).
 */
function useLoop(frames: number, ms: number, still = frames - 1): [number, RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || reduced) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % frames), ms);
    return () => clearInterval(t);
  }, [visible, reduced, frames, ms]);
  return [reduced ? still : frame, ref, visible && !reduced];
}

/** The little dotted paper each demo sits on. */
function Mini({ children, active, className = "" }: { children: ReactNode; active: boolean; className?: string }) {
  return (
    <div className={`dot-grid relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-[20px] border border-line bg-bg p-5 ${active ? "" : "demo-paused"} ${className}`}>
      {children}
    </div>
  );
}

const SAMPLE = ["call amma", "read the design doc", "weekend photo walk", "renew passport"];

export function DropDemo() {
  const [frame, ref, active] = useLoop(5, 1300);
  return (
    <div ref={ref}>
      <Mini active={active} className="flex-wrap content-center gap-3">
        {SAMPLE.slice(0, frame).map((t, i) => (
          <ThoughtBubble key={`${t}-${frame > i}`} text={t} done={false} shape={i} seed={`drop-${i}`} fresh={i === frame - 1} readOnly />
        ))}
        {frame === 0 && <span className="font-hand text-[22px] text-mute">a fresh sheet…</span>}
      </Mini>
    </div>
  );
}

export function StrikeDemo() {
  const [frame, ref, active] = useLoop(2, 1600, 1);
  return (
    <div ref={ref}>
      <Mini active={active}>
        <ThoughtBubble text="book the dentist" done={frame === 1} shape={2} seed="strike-demo" readOnly />
      </Mini>
    </div>
  );
}

export function CrumpleDemo() {
  const [frame, ref, active] = useLoop(3, 1100, 0);
  return (
    <div ref={ref}>
      <Mini active={active}>
        {frame < 2 && <ThoughtBubble key={frame} text="that idea from 2019" done={false} shape={3} seed="crumple-demo" leaving={frame === 1 ? "crumple" : null} returning={frame === 0} readOnly />}
      </Mini>
    </div>
  );
}

export function EmailDemo() {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-[20px] border border-line bg-bg p-5">
      <div className="w-full max-w-[300px] -rotate-1 rounded-2xl border border-line bg-sheet p-4 shadow-[0_18px_40px_-24px_var(--shadow)]">
        <span className="flex items-center justify-between text-[12px] text-mute">
          <span className="font-semibold text-red-text">pen &amp; paper</span>
          <span>9:00 PM</span>
        </span>
        <p className="mt-2 text-[15px] font-semibold">Here&apos;s what you dropped today</p>
        <ul className="mt-2 flex flex-col gap-1 text-[14px]">
          <li className="rounded-md bg-t1 px-2 py-0.5">renew passport</li>
          <li className="rounded-md bg-t1 px-2 py-0.5">call the plumber</li>
          <li className="px-2 text-mute line-through decoration-red-text">reply to Ravi</li>
        </ul>
        <span className="mt-3 inline-block rounded-lg bg-red px-3 py-1.5 text-[13px] font-semibold text-on-red">Open my paper</span>
      </div>
    </div>
  );
}
