import credits from "./timeline-credits.json";

/**
 * Behind the homepage headline: everything that changes. Fire to the galaxy,
 * in black and white, blurred and faint, drifting slowly left. The headline
 * in front stays still: what we eat, work, sleep and feel does not change.
 *
 * The row is drawn twice so the drift loops without a seam.
 * Decorative only (aria-hidden); credits live at /credits.
 */
export function TimelineStrip() {
  return (
    <div aria-hidden="true" className="timeline-strip pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="timeline-track flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4">
            {credits.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element -- tiny decorative webp tiles, blurred
              <img key={c.slug} src={`/timeline/${c.slug}.webp`} alt="" width={280} height={210} decoding="async" className="h-[150px] w-[200px] shrink-0 rounded-sm object-cover sm:h-[210px] sm:w-[280px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
