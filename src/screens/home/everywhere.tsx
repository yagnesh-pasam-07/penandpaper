import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";

/** Where the screenshots live. Drop web, mac and chrome images in here (see public/shots/README.md). */
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
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd key={k} className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-line border-b-2 bg-bg px-1.5 text-[15px] leading-none text-ink">
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

type Panel = {
  key: "web" | "mac" | "chrome";
  title: string;
  line: string;
  status: "Live" | "Early access";
  hints: { keys: string[]; label: string }[];
  alt: string;
};

const PANELS: Panel[] = [
  {
    key: "web",
    title: "On the web",
    line: "Open it in any browser. Drag notes anywhere and zoom out to see it all.",
    status: "Live",
    hints: [{ keys: ["Space"], label: "write" }],
    alt: "Pen & Paper open in a browser, notes spread across a paper",
  },
  {
    key: "mac",
    title: "On your Mac",
    line: "It sits in your menu bar. Type a thought, or hold a key and speak.",
    status: "Early access",
    hints: [
      { keys: ["⌥", "⇧", "N"], label: "type" },
      { keys: ["⌥", "Space"], label: "hold to speak" },
    ],
    alt: "The Pen & Paper box floating over another app on a Mac",
  },
  {
    key: "chrome",
    title: "In Chrome",
    line: "Save a page, a selection or a quick thought from any site.",
    status: "Early access",
    hints: [
      { keys: ["⌥", "⇧", "P"], label: "save page" },
      { keys: ["⌥", "⇧", "N"], label: "quick thought" },
    ],
    alt: "The Pen & Paper pop-up over a web page in Chrome",
  },
];

/** A 16:10 frame: the real screenshot once the file exists, a quiet placeholder until then. */
function Shot({ name, alt }: { name: string; alt: string }) {
  const src = shotFor(name);
  if (src) {
    return (
      // A local file of unknown size: the frame fixes the shape, so nothing shifts while it loads.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} width={1600} height={1000} loading="lazy" className="aspect-[16/10] w-full rounded-xl border border-line object-cover shadow-[0_18px_40px_-26px_var(--shadow)]" />
    );
  }
  return (
    <div role="img" aria-label={`Screenshot placeholder: ${alt}`} className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-soft/50 text-center">
      <span className="font-hand text-[24px] leading-none text-mute">your screenshot goes here</span>
      <span className="font-mono text-[11px] text-mute/80">public/shots/{name}.png</span>
    </div>
  );
}

function Panel({ p }: { p: Panel }): ReactNode {
  return (
    <li className="flex flex-col gap-4 rounded-[22px] border border-line bg-sheet p-5">
      <Shot name={p.key} alt={p.alt} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Glyph kind={p.key} />
          <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{p.title}</h3>
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            p.status === "Live" ? "bg-red-soft text-red-text" : "border border-dashed border-line text-mute"
          }`}
        >
          {p.status}
        </span>
      </div>
      <p className="text-[15px] text-mute">{p.line}</p>
      <div className="mt-auto flex flex-col gap-2">
        {p.hints.map((h) => (
          <span key={h.label} className="flex items-center gap-2 text-[13px] text-mute">
            <Keys keys={h.keys} />
            {h.label}
          </span>
        ))}
      </div>
    </li>
  );
}

/** Wherever you are: the web, the Mac menu bar, Chrome, and your voice. */
export function Everywhere() {
  return (
    <section aria-labelledby="everywhere-title" className="mx-auto flex w-full max-w-[1120px] scroll-mt-20 flex-col gap-10 px-4 pb-24 sm:px-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 id="everywhere-title" className="font-hand text-[44px] leading-tight font-bold sm:text-[56px]">
          Wherever the thought finds you.
        </h2>
        <p className="text-[17px] text-mute">One paper, three ways in.</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {PANELS.map((p) => (
          <Panel key={p.key} p={p} />
        ))}
      </ul>

      <div className="flex flex-col items-center gap-5 rounded-[22px] border border-line bg-sheet px-6 py-6 text-center sm:flex-row sm:gap-8 sm:px-10 sm:text-left">
        <span aria-hidden="true" className="voice-bars flex h-12 shrink-0 items-center gap-[5px] text-red-text">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${-i * 0.17}s` }} className="voice-bar w-[3px] rounded-full bg-current" />
          ))}
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <p className="voice-write font-hand text-[30px] leading-tight font-bold sm:text-[38px]">Hold a key. Say it. It lands on your paper.</p>
          <p className="text-[13px] text-mute">Speak in English, हिन्दी or తెలుగు.</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[13px] text-mute">
          <Keys keys={["⌥", "Space"]} />
        </span>
      </div>
    </section>
  );
}
