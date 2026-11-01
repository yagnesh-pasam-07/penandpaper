/**
 * How writing travelled, drawn in the brand's own ink: a hand on a cave wall,
 * a clay tablet, a palm leaf, paper and a pen. Line drawings in the ink
 * colour with one red mark each, so they sit quietly beside the text and
 * follow light and dark mode.
 */
export function WritingJourney() {
  const ink = "var(--ink)";
  const red = "var(--red)";
  const step = "flex flex-col items-center gap-2";
  const label = "font-sans text-[12px] leading-tight text-mute text-center";
  const stroke = { fill: "none", stroke: ink, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <figure className="my-2 flex flex-col gap-3">
      <div role="img" aria-label="How writing travelled: marks on cave walls, clay tablets about 3200 BCE, palm leaves, then paper in 105 CE" className="mx-auto grid w-full max-w-[420px] grid-cols-4 items-end gap-3 rounded-xl border border-line bg-sheet px-4 pt-5 pb-4">
        {/* A cave wall: a hand print and three marks */}
        <div className={step}>
          <svg viewBox="0 0 60 60" width="56" height="56" aria-hidden="true">
            <path d="M6 54 C10 30 8 12 22 6 C38 2 52 10 54 30 C56 44 52 52 50 56" {...stroke} strokeDasharray="2 3" />
            <path d="M24 44 v-12 M28 42 v-16 M32 42 v-15 M36 43 v-11 M22 46 c-4 -4 -4 -8 -2 -10 M24 46 c2 4 12 4 14 -2" {...stroke} stroke={red} />
            <path d="M14 22 l6 2 M16 28 l5 1" {...stroke} />
          </svg>
          <span className={label}>Walls</span>
        </div>
        {/* A clay tablet with wedge marks */}
        <div className={step}>
          <svg viewBox="0 0 60 60" width="56" height="56" aria-hidden="true">
            <rect x="12" y="8" width="36" height="46" rx="5" {...stroke} />
            {[16, 24, 32, 40].map((y, i) => (
              <path key={y} d={`M18 ${y} l4 -2 v4 z M27 ${y} l4 -2 v4 z M36 ${y} l4 -2 v4 z`} fill={i === 1 ? red : ink} stroke="none" />
            ))}
          </svg>
          <span className={label}>3200 BCE</span>
        </div>
        {/* A palm leaf with lines of script, tied with a string */}
        <div className={step}>
          <svg viewBox="0 0 60 60" width="56" height="56" aria-hidden="true">
            <path d="M4 26 C18 20 42 20 56 26 L56 34 C42 40 18 40 4 34 Z" {...stroke} />
            <path d="M10 28 h40 M10 32 h40" {...stroke} strokeDasharray="3 2" strokeWidth={1} />
            <path d="M30 22 v18" {...stroke} stroke={red} />
          </svg>
          <span className={label}>Leaves</span>
        </div>
        {/* Paper and a pen */}
        <div className={step}>
          <svg viewBox="0 0 60 60" width="56" height="56" aria-hidden="true">
            <path d="M10 10 h28 l10 10 v32 h-38 z M38 10 v10 h10" {...stroke} />
            <path d="M16 28 c4 -3 8 3 12 0 s8 3 10 0 M16 36 c4 -3 8 3 12 0" {...stroke} strokeWidth={1.3} />
            <path d="M34 50 l16 -24 4 3 -16 24 -5 2 z" {...stroke} stroke={red} />
          </svg>
          <span className={label}>105 CE</span>
        </div>
      </div>
      <figcaption className="text-center font-sans text-[13px] text-mute">Walls, clay, leaves, paper. Each one was someone deciding a thought was worth keeping.</figcaption>
    </figure>
  );
}
