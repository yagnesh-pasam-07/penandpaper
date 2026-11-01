import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

/**
 * The share card (Open Graph image) that WhatsApp, Instagram, LinkedIn and X
 * show for a link: warm paper, the title in a serif with a red marker stroke
 * under it, one line, and the brand. English in Newsreader; Telugu in Noto
 * Serif Telugu, shaped by sharp so conjuncts stack; the brand in Caveat, our
 * handwriting. The fonts ship in the repo, so the card never waits on the
 * network.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PAPER = "#f6f3ec";
const INK = "#22201c";
const MUTE = "#57534b";
const RED = "#b23a2c";

type Font = { name: string; data: Buffer; weight: 500 | 700; style: "normal" };
let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= (async () => {
    const dir = path.join(process.cwd(), "src/assets/og-fonts");
    const [serif, hand] = await Promise.all(["newsreader.ttf", "caveat.ttf"].map((f) => readFile(path.join(dir, f))));
    return [
      { name: "Story", data: serif, weight: 500, style: "normal" },
      { name: "Hand", data: hand, weight: 700, style: "normal" },
    ];
  })();
  return fonts;
}

/** Shortens to `max` characters at a word, with an ellipsis. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/** Title size that keeps it within three lines, by length (Telugu letters are wider). */
export function titleSize(title: string): number {
  const te = /[ఀ-౿]/.test(title);
  const n = title.length * (te ? 1.35 : 1);
  return n <= 28 ? 76 : n <= 48 ? 64 : n <= 72 ? 54 : 46;
}

export type CardInput = {
  /** Small line above the title (e.g. "HISTORY" or "PEN AND PAPER"). */
  kicker: string;
  title: string;
  line: string;
  /** Bottom right, e.g. "4 min read · Listen". */
  meta: string;
  /** The product after "pen & paper": "stories", "desk", or nothing for the parent brand. */
  product?: string;
  /** A picture for the right side (data URL), if any. */
  picture?: string | null;
};

const TELUGU = /[\u0C00-\u0C7F]/;
const escapeMarkup = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Telugu set by sharp (Pango + HarfBuzz), which shapes conjuncts properly
 * (అమ్మ, ప్రతి), as a transparent PNG to place in the card. The card's own
 * renderer (Satori) can't stack Telugu consonants, so Telugu never goes
 * through it.
 */
async function teluguText(text: string, px: number, color: string, width: number, lineHeight: number): Promise<{ src: string; w: number; h: number }> {
  const fontfile = path.join(process.cwd(), "src/assets/og-fonts/noto-serif-telugu.ttf");
  const { data, info } = await sharp({
    text: { text: `<span foreground="${color}">${escapeMarkup(text)}</span>`, font: `Noto Serif Telugu ${px}`, fontfile, rgba: true, dpi: 72, width, spacing: Math.round(px * (lineHeight - 1)) },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { src: `data:image/png;base64,${data.toString("base64")}`, w: info.width, h: info.height };
}

/** Text in the card: as Satori text for Latin, as a shaped picture for Telugu. */
async function cardText(text: string, px: number, color: string, width: number, lineHeight: number, style: Record<string, string | number>, fit?: { lines: number; min: number }) {
  if (!TELUGU.test(text)) return <div style={{ display: "flex", fontSize: px, lineHeight, color, ...style }}>{text}</div>;
  let t = await teluguText(text, px, color, width, lineHeight);
  // A short Telugu title should sit on as few lines as it can: shrink a little until it does.
  if (fit) {
    let size = px;
    while (t.h > px * lineHeight * 1.3 * fit.lines && size > fit.min) {
      size -= 4;
      t = await teluguText(text, size, color, width, lineHeight);
    }
  }
  // eslint-disable-next-line @next/next/no-img-element -- drawn into the image, never a page
  return <img src={t.src} width={t.w} height={t.h} alt="" style={{ display: "flex" }} />;
}

/** Renders the card and returns a JPEG (about 60–120 KB: WhatsApp skips previews much over 300 KB). */
export async function renderCard(c: CardInput): Promise<Response> {
  const title = clip(c.title, 90);
  const size = titleSize(title);
  const textWidth = c.picture ? 600 : 1000;
  const [titleNode, lineNode] = await Promise.all([
    cardText(title, size, INK, textWidth, TELUGU.test(title) ? 1.02 : 1.12, { letterSpacing: -1, maxHeight: size * 1.12 * 3, overflow: "hidden" }, { lines: title.length <= 24 ? 1 : 2, min: 44 }),
    c.line ? cardText(clip(c.line, 110), 30, MUTE, textWidth, 1.35, {}) : Promise.resolve(null),
  ]);
  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          // Paper: a warm ground, a faint lamp-light at the top left, fine ruled lines.
          backgroundColor: PAPER,
          backgroundImage: `radial-gradient(circle at 18% 10%, rgba(255,253,246,0.9), rgba(246,243,236,0) 55%), repeating-linear-gradient(0deg, rgba(87,83,75,0.05) 0px, rgba(87,83,75,0.05) 1px, transparent 1px, transparent 44px)`,
          fontFamily: "Story",
        }}
      >
        {/* A red margin rule, like a notebook. */}
        <div style={{ position: "absolute", left: 88, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(178,58,44,0.35)", display: "flex" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "70px 64px 60px 128px" }}>
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 40, color: INK }}>
            pen &amp; paper{c.product ? <span style={{ color: RED, marginLeft: 12 }}>{c.product}</span> : null}
          </div>
          <div style={{ display: "flex", marginTop: 46, fontSize: 22, letterSpacing: 4, color: RED, fontFamily: "Story" }}>{c.kicker.toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
            {titleNode}
            {/* The red marker stroke under the title. */}
            <div style={{ display: "flex", marginTop: 18, width: 180, height: 9, borderRadius: 9, backgroundColor: RED, transform: "rotate(-1.2deg)" }} />
          </div>
          {lineNode ? <div style={{ display: "flex", marginTop: 26 }}>{lineNode}</div> : null}
          <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: MUTE }}>
            <span>Pen and Paper{c.product ? ` · ${c.product[0].toUpperCase()}${c.product.slice(1)}` : ""}</span>
            <span>{c.meta}</span>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn into the image, never a page */}
        {c.picture ? <img src={c.picture} width={420} height={630} alt="" style={{ objectFit: "cover" }} /> : null}
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}

/** A picture for the card's right side, cropped to fit, as a small JPEG data URL. */
export async function cardPicture(bytes: Buffer | null): Promise<string | null> {
  if (!bytes) return null;
  try {
    const jpg = await sharp(bytes).resize({ width: 420, height: 630, fit: "cover" }).jpeg({ quality: 72 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}
