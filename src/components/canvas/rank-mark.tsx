/**
 * A number in marker red at a note's corner, so the order jumps out: a solid
 * red disc, slightly uneven like a marker dot, with the number handwritten in
 * white. Struck notes keep theirs, muted and crossed through.
 */
export function RankMark({ n, struck = false, size = "md", className = "" }: { n: number; struck?: boolean; size?: "sm" | "md"; className?: string }) {
  // Placed by the caller (absolute at a corner) or, by default, in the flow.
  const place = /\b(absolute|fixed)\b/.test(className) ? "" : "relative";
  const box = size === "sm" ? "size-7 text-[17px]" : "size-11 text-[28px]";
  return (
    <span
      role="img"
      aria-label={`Number ${n}${struck ? ", done" : ""}`}
      className={`pointer-events-none ${place} inline-flex shrink-0 items-center justify-center font-hand leading-none font-bold ${box} ${struck ? "text-mute" : "text-on-red"} ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 36 36" className={`absolute inset-0 ${struck ? "text-soft" : "text-red"}`} style={{ filter: struck ? undefined : "drop-shadow(0 3px 4px rgba(0,0,0,0.22))" }}>
        <path d={BLOTS[n % BLOTS.length]} fill="currentColor" />
        {struck ? <path d={BLOTS[n % BLOTS.length]} fill="none" stroke="var(--line)" strokeWidth="1.5" /> : null}
      </svg>
      <span className={`relative -mt-0.5 ${struck ? "line-through decoration-2" : ""}`}>{n}</span>
    </span>
  );
}

/** A few hand-made marker dots, so neighbouring numbers aren't stamped copies. */
const BLOTS = [
  "M18.6 2.6c8.3.3 14.6 6.6 14 15-.6 8.4-7.3 14.8-15.4 14.3C9 31.4 2.9 25 3.4 16.9 3.9 8.6 10.3 2.3 18.6 2.6z",
  "M17.4 3c8.6-.4 15.1 5.8 15 14-.1 8.6-6.6 15-15.2 14.8C9 31.6 2.8 25.1 3.2 17.1 3.6 9.3 9.5 3.4 17.4 3z",
  "M19.6 3.3c7.9 1.1 13.2 7.6 12.4 15.4-.8 8-7.8 13.7-15.6 13C8.6 31 2.9 24.6 3.6 16.6 4.3 8.6 11.3 2.1 19.6 3.3z",
];
