"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { DeskStamp } from "@/modules/drop/chrome";

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

const SAMPLE = ["call amma", "read the design doc", "idea: weekend photo walk", "renew passport"];

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

export function PencilDemo() {
  const [frame, ref, active] = useLoop(2, 1800, 1);
  return (
    <div ref={ref}>
      <Mini active={active}>
        <div className={frame === 1 ? "ink-in" : ""}>
          <ThoughtBubble text="weekend photo walk" done={false} kind={frame === 0 ? "pencil" : "pen"} shape={1} seed="pencil-demo" readOnly />
        </div>
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

export function FoldDemo() {
  const [frame, ref, active] = useLoop(3, 1300, 1);
  return (
    <div ref={ref}>
      <Mini active={active}>
        <ThoughtBubble key={frame === 0 ? "a" : "b"} text="pay the electricity bill" done={false} shape={0} seed="fold-demo" when={frame >= 1 ? "Fri" : undefined} leaving={frame === 2 ? "fold" : null} readOnly />
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

export function CarryDemo() {
  const [frame, ref, active] = useLoop(2, 1800, 1);
  const moved = frame === 1;
  return (
    <div ref={ref}>
      <Mini active={active} className="items-stretch gap-3">
        {["Mon", "Tue"].map((day, d) => (
          <div key={day} className="flex flex-1 flex-col gap-2 rounded-2xl border border-dashed border-line p-3">
            <span className="font-hand text-[20px] font-bold">{day}</span>
            <span className="min-h-[60px]">
              {d === 0 && <span className="text-[13px] text-mute line-through decoration-red-text">reply to Ravi</span>}
            </span>
          </div>
        ))}
        {["renew passport", "call the plumber"].map((t, i) => (
          <span
            key={t}
            className="absolute transition-[left] duration-700 ease-in-out"
            style={{ top: 70 + i * 52, left: moved ? "calc(50% + 16px)" : "28px" }}
          >
            <span className="inline-block scale-[0.72] origin-left">
              <ThoughtBubble text={t} done={false} shape={i + 2} seed={`carry-${i}`} carried={moved ? "Mon" : undefined} readOnly />
            </span>
          </span>
        ))}
      </Mini>
    </div>
  );
}

export function ClearDeskDemo() {
  const [frame, ref, active] = useLoop(5, 1100, 4);
  const cards = [
    { t: "renew passport", label: "→ Tomorrow" },
    { t: "weekend photo walk", label: "✎ Keep as idea" },
    { t: "old meeting notes", label: "✕ Crumple" },
  ];
  return (
    <div ref={ref}>
      <Mini active={active} className="flex-col gap-2">
        {frame < 4 ? (
          cards.map((c, i) => (
            <span key={c.t} className={`flex w-full max-w-[300px] items-center justify-between gap-3 rounded-xl border border-line bg-sheet px-3.5 py-2 transition-opacity ${i < frame ? "opacity-60" : ""}`}>
              <span className="font-hand text-[20px]">{c.t}</span>
              <span className={`text-[12px] font-semibold ${i < frame ? "text-ink" : "text-transparent"}`}>{c.label}</span>
            </span>
          ))
        ) : (
          <DeskStamp date="Tue, 21 Oct" animate />
        )}
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
        <p className="mt-2 text-[15px] font-semibold">Today&apos;s paper: 6 thoughts</p>
        <ul className="mt-2 flex flex-col gap-1 text-[14px]">
          <li className="rounded-md bg-t1 px-2 py-0.5">renew passport</li>
          <li className="rounded-md bg-t1 px-2 py-0.5">call the plumber</li>
          <li className="px-2 text-mute line-through decoration-red-text">reply to Ravi</li>
          <li className="px-2 text-[12px] font-semibold text-mute">Coming up</li>
          <li className="px-2 text-mute">Fri · pay the electricity bill</li>
        </ul>
        <span className="mt-3 inline-block rounded-lg bg-red px-3 py-1.5 text-[13px] font-semibold text-on-red">Clear your desk</span>
      </div>
    </div>
  );
}
