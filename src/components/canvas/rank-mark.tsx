/**
 * A number circled in marker red at a note's corner, the way you'd number
 * things on paper: handwritten, the ring drawn in one slightly uneven stroke
 * that overshoots where it started. Struck notes keep it, crossed through.
 */
export function RankMark({ n, struck = false, className = "" }: { n: number; struck?: boolean; className?: string }) {
  // Placed by the caller (absolute at a corner) or, by default, in the flow.
  const place = /\b(absolute|fixed)\b/.test(className) ? "" : "relative";
  return (
    <span
      role="img"
      aria-label={`Number ${n}${struck ? ", done" : ""}`}
      className={`pointer-events-none ${place} inline-flex size-9 shrink-0 items-center justify-center font-hand text-[22px] leading-none font-bold ${struck ? "text-mute" : "text-red-text"} ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 36 36" className="absolute inset-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d={RINGS[n % RINGS.length]} />
      </svg>
      <span className={`relative -mt-0.5 ${struck ? "line-through decoration-2" : ""}`}>{n}</span>
    </span>
  );
}

/** A few hand-drawn rings, so neighbouring numbers aren't stamped copies. */
const RINGS = [
  "M19 4.2c7.6.4 12.9 6.2 12.4 13.6-.5 7.3-6.6 12.6-13.8 12.2C10.4 29.6 4.9 24 5.3 17 5.7 9.8 11.4 4.6 19.2 4.7c1.8.1 3.3.6 4.6 1.3",
  "M17.2 4.6c7.9-.3 13.6 5.3 13.5 12.4-.1 7.5-6.1 13.2-13.6 13-7.2-.2-12.6-6-12.3-13 .3-6.6 5.6-12 12.6-12.2 1.5 0 2.9.3 4.1.8",
  "M20.4 5.1c6.9 1.2 11.1 7 10.2 13.8-.9 7-7.1 11.9-14 11.2C9.6 29.4 4.6 23.6 5.4 16.6 6.1 9.9 11.6 5 18.3 5.2c2.6.1 4.6.9 6 2",
];
