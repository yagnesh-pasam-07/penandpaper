import Link from "next/link";
import { coverOf, type Entry } from "./unnoticed";

/** A small tilt per entry, the same every time: pasted in by hand, not laid out by a grid. */
export const tiltOf = (code: string) => (([...code].reduce((n, c) => n + c.charCodeAt(0), 0) % 7) - 3) * 0.5;

/** A torn bottom edge, as a mask: the cut is never straight. Same tear for the same entry. */
function tear(code: string): string {
  let seed = [...code].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const pts: string[] = [];
  for (let x = 0; x <= 100; x += 4) pts.push(`${x}% ${97 + rand() * 3}%`);
  return `polygon(0 0, 100% 0, ${pts.reverse().join(", ")})`;
}

/**
 * One post as a clipping pasted into a scrapbook: the cover cut out with a
 * torn edge, held by a strip of tape. Opens the post.
 */
export function Clipping({ entry, width = 220 }: { entry: Entry; width?: number }) {
  const t = tiltOf(entry.code);
  return (
    <Link
      href={`/stories/unnoticed/${entry.code}`}
      aria-label={entry.title.join(" ")}
      className="group relative block shrink-0 focus-visible:outline-none"
      style={{ width }}
    >
      <span className="block transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:!rotate-0 group-focus-visible:-translate-y-1 motion-reduce:transition-none" style={{ transform: `rotate(${t}deg)` }}>
        {/* The tape. */}
        <span aria-hidden="true" className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 bg-[color-mix(in_srgb,#efe2b4_70%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] mix-blend-multiply dark:mix-blend-normal dark:bg-[color-mix(in_srgb,#c9bb8a_45%,transparent)]" style={{ transform: `rotate(${-t * 2 - 2}deg)` }} />
        {/* The clipping: the cover, cut out, a little paper margin round it. */}
        <span
          className="block bg-[#f4efe4] p-1.5 pb-3 shadow-[0_18px_30px_-18px_rgba(0,0,0,0.55),0_2px_4px_rgba(0,0,0,0.12)] ring-1 ring-black/5 group-focus-visible:ring-2 group-focus-visible:ring-red-text"
          style={{ clipPath: tear(entry.code) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a small local WebP, already sized */}
          <img src={coverOf(entry.code)} alt={entry.title.join(" ")} width={720} height={Math.round(720 / entry.ratio)} loading="lazy" className="block h-auto w-full" />
        </span>
      </span>
    </Link>
  );
}
