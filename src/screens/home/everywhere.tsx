import fs from "node:fs";
import Link from "next/link";
import path from "node:path";
import { btn } from "@/components/btn";
import { Keys } from "@/components/keys";
import { Glyph } from "./glyph";
import { ShotCarousel, type Shot } from "./shot-carousel";

/** Where the homepage screenshot lives (see public/shots/README.md). */
const SHOTS_DIR = path.join(process.cwd(), "public", "shots");
const EXTENSIONS = ["png", "webp", "jpg", "jpeg"];

/** The public path of a screenshot, if the file exists. Checked when the page is built or rendered, so adding a file needs no code change. */
function shotFor(name: string): string | null {
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(SHOTS_DIR, `${name}.${ext}`))) return `/shots/${name}.${ext}`;
  }
  return null;
}

/** One 16:10 screenshot under the headline: the real file once it exists, a quiet placeholder until then. A `web-dark` twin, when present, shows in the dark theme. */
export function HeroShot() {
  const light = shotFor("web");
  const dark = shotFor("web-dark");
  const src = light ?? dark;
  const alt = "Pen & Paper open in a browser, notes spread across a paper";
  const frame = "aspect-[16/10] w-full rounded-2xl border border-line object-cover shadow-[0_30px_60px_-36px_var(--shadow)]";
  if (light && dark) {
    return (
      // Two files of known shape: the frame fixes the size, so nothing shifts while either loads; CSS shows the one that matches the theme.
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light} alt={alt} width={1600} height={1000} className={`shot-light ${frame}`} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dark} alt="" aria-hidden="true" width={1600} height={1000} loading="lazy" className={`shot-dark ${frame}`} />
      </>
    );
  }
  if (src) {
    return (
      // A local file of unknown size: the frame fixes the shape, so nothing shifts while it loads.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} width={1600} height={1000} className={frame} />
    );
  }
  return (
    <div role="img" aria-label="Screenshot placeholder: Pen & Paper open in a browser" className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-soft/40 text-center">
      <span className="font-hand text-[28px] leading-none text-mute">your screenshot goes here</span>
      <span className="font-mono text-[11px] text-mute/80">public/shots/web.png</span>
    </div>
  );
}

/** The screens the hero can show, in order. A slide appears only when its light file exists in public/shots/; a `-dark` twin is optional. */
const SCREENS: { id: string; label: string; alt: string; blurb: string }[] = [
  { id: "web", label: "Canvas", alt: "Pen & Paper open in a browser, notes and videos spread across a paper", blurb: "One calm canvas for everything you drop." },
  { id: "writer", label: "Writer", alt: "The writer open over the canvas, with a microphone button and a language menu", blurb: "Type it, paste it, or say it." },
  { id: "library", label: "Library", alt: "The Library: every paper as a small preview card", blurb: "Every paper, as a small preview." },
  { id: "search", label: "Search", alt: "Searching every paper for a word", blurb: "Find that video from two weeks ago." },
  { id: "tonight", label: "Tonight", alt: "Tonight's paper: one thought at a time to strike, keep or crumple", blurb: "Close the day in a minute." },
  { id: "grid", label: "Grid", alt: "The same paper on the Grid canvas", blurb: "Dots, grid or ruled. Pick the paper you like." },
  { id: "ruled", label: "Ruled", alt: "The same paper on the Ruled canvas", blurb: "Notebook lines, if you prefer." },
];

/** The hero: the canvas screenshot, as a carousel of the other screens when their files exist. */
export function HeroGallery() {
  const shots: Shot[] = [];
  for (const s of SCREENS) {
    const light = shotFor(s.id);
    if (light) shots.push({ id: s.id, label: s.label, alt: s.alt, blurb: s.blurb, light, dark: shotFor(`${s.id}-dark`) });
  }
  // Light and dark halves of one screen, cut on a slant, as the last slide.
  const themeLight = shotFor("grid");
  const themeDark = shotFor("grid-dark");
  if (themeLight && themeDark) {
    shots.push({
      id: "themes",
      label: "Light & dark",
      alt: "The same paper in the light and the dark theme, split down the middle",
      blurb: "Light or dark, your call.",
      light: themeLight,
      dark: themeDark,
      split: true,
    });
  }
  if (shots.length < 2) {
    return (
      <div className="mx-auto w-full max-w-[980px] px-4 sm:px-8">
        <HeroShot />
      </div>
    );
  }
  return <ShotCarousel shots={shots} />;
}

const PLACES: { kind: "web" | "mac" | "chrome"; label: string; note?: string; href?: string }[] = [
  { kind: "web", label: "Web" },
  { kind: "mac", label: "Mac", note: "Download", href: "/download#mac-title" },
  { kind: "chrome", label: "Chrome", note: "Download", href: "/download#chrome-title" },
];

/** Wherever you are, in three small symbols and one line about your voice. */
export function Everywhere() {
  return (
    <section aria-labelledby="everywhere-title" className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-10 px-4 py-24 text-center sm:px-8 sm:py-32">
      <h2 id="everywhere-title" className="sr-only">
        Where you can use it
      </h2>
      <ul className="flex w-full items-start justify-center gap-10 sm:gap-20">
        {PLACES.map((p) => (
          <li key={p.kind}>
            {p.href ? (
              <Link href={p.href} className="group flex flex-col items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-text">
                <Glyph kind={p.kind} />
                <span className="text-[16px] font-medium">{p.label}</span>
                <span className="h-4 text-[12px] text-red-text underline-offset-2 group-hover:underline">{p.note}</span>
              </Link>
            ) : (
              <span className="flex flex-col items-center gap-2">
                <Glyph kind={p.kind} />
                <span className="text-[16px] font-medium">{p.label}</span>
                <span className="h-4 text-[12px] text-mute">{p.note}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center gap-3">
        <p className="text-[16px] text-mute">Highlight a post in Chrome, click once, and it&apos;s on your paper with its picture and link.</p>
        <Link href="/download" className={`${btn.outline} h-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text`}>
          Download the Mac app &amp; Chrome extension
        </Link>
      </div>
      <div className="flex flex-col items-center gap-4">
        <p className="text-[20px] sm:text-[22px]">Say it instead of typing it.</p>
        <ul className="flex flex-col items-center gap-2 text-[13px] text-mute">
          <li className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>On the web (Chrome, Edge, Safari): tap the mic, or press</span>
            <Keys keys={["⌘", "⇧", "M"]} />
          </li>
          <li className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>In the Mac app: hold</span>
            <Keys keys={["⌥", "Space"]} />
          </li>
        </ul>
      </div>
    </section>
  );
}
