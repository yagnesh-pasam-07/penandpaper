import fs from "node:fs";
import path from "node:path";

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

/** Real keycaps, so a shortcut reads as keys. */
function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {keys.map((k) => (
        <kbd key={k} className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line border-b-2 bg-sheet px-1.5 text-[13px] leading-none text-ink">
          {k}
        </kbd>
      ))}
    </span>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Three small line drawings in the ink colour, each with one red mark. */
function Glyph({ kind }: { kind: "web" | "mac" | "chrome" }) {
  return (
    <svg aria-hidden="true" width="64" height="44" viewBox="0 0 64 44" className="text-ink/75">
      {kind === "web" && (
        <>
          <rect x="6" y="6" width="52" height="32" rx="5" {...stroke} />
          <path d="M6 14h52" {...stroke} />
          <path d="M18 27c4-6 8-6 12 0s8 6 14-2" className="text-red-text" {...stroke} />
        </>
      )}
      {kind === "mac" && (
        <>
          <rect x="4" y="5" width="56" height="9" rx="2" {...stroke} />
          <path d="M10 9.5h6M22 9.5h6" {...stroke} />
          <path d="M47 7.8l3 3.4m0-3.4l-3 3.4" className="text-red-text" {...stroke} />
          <rect x="14" y="22" width="36" height="16" rx="4" {...stroke} />
        </>
      )}
      {kind === "chrome" && (
        <>
          <path d="M8 36V12a4 4 0 0 1 4-4h16v6a4 4 0 1 0 8 0V8h16a4 4 0 0 1 4 4v24z" {...stroke} />
          <path d="M26 28l4 4 8-9" className="text-red-text" {...stroke} />
        </>
      )}
    </svg>
  );
}

/** One 16:10 screenshot under the headline: the real file once it exists, a quiet placeholder until then. */
export function HeroShot() {
  const src = shotFor("web");
  if (src) {
    return (
      // A local file of unknown size: the frame fixes the shape, so nothing shifts while it loads.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="Pen & Paper open in a browser, notes spread across a paper" width={1600} height={1000} className="aspect-[16/10] w-full rounded-2xl border border-line object-cover shadow-[0_30px_60px_-36px_var(--shadow)]" />
    );
  }
  return (
    <div role="img" aria-label="Screenshot placeholder: Pen & Paper open in a browser" className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-soft/40 text-center">
      <span className="font-hand text-[28px] leading-none text-mute">your screenshot goes here</span>
      <span className="font-mono text-[11px] text-mute/80">public/shots/web.png</span>
    </div>
  );
}

const PLACES: { kind: "web" | "mac" | "chrome"; label: string; note?: string }[] = [
  { kind: "web", label: "Web" },
  { kind: "mac", label: "Mac", note: "Early access" },
  { kind: "chrome", label: "Chrome", note: "Early access" },
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
          <li key={p.kind} className="flex flex-col items-center gap-2">
            <Glyph kind={p.kind} />
            <span className="text-[16px] font-medium">{p.label}</span>
            <span className="h-4 text-[12px] text-mute">{p.note}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center gap-4">
        <p className="text-[20px] sm:text-[22px]">Say it instead of typing it.</p>
        <ul className="flex flex-col items-center gap-2 text-[13px] text-mute">
          <li className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>On the web (Chrome, Edge, Safari): tap the mic, or press</span>
            <Keys keys={["⌘/Ctrl", "⇧", "M"]} />
          </li>
          <li className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
            <span>In the Mac app: hold</span>
            <Keys keys={["⌥", "Space"]} />
          </li>
        </ul>
        <p className="text-[12px] text-mute/80">English, हिन्दी and తెలుగు. Telugu is the least accurate.</p>
      </div>
    </section>
  );
}
