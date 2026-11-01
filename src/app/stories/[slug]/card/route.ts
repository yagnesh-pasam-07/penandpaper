import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import sharp from "sharp";
import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { mediaBytes, publishedStory } from "@/modules/stories/server";

const W = 1080;
const H = 1920;

/**
 * `GET /stories/<slug>/card`: the story as a 1080×1920 Instagram Story card.
 * The cover fills the top, the title and hook sit on warm paper below, and
 * the brand closes it, so a screenshot of it still says where to read it.
 */
export async function GET(_request: Request, ctx: RouteContext<"/stories/[slug]/card">) {
  const { slug } = await ctx.params;
  const s = await publishedStory(slug);
  if (!s) return new Response("Not found", { status: 404 });
  let cover: string | null = null;
  if (s.coverId) {
    try {
      const jpg = await sharp(await mediaBytes(s.coverId)).resize({ width: W, height: 1000, fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
      cover = `data:image/jpeg;base64,${jpg.toString("base64")}`;
    } catch {}
  }
  const hook = s.hook || s.subtitle;
  const png = new ImageResponse(
    h(
      "div",
      { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FAF8F3", fontFamily: "serif" } },
      cover ? h("img", { src: cover, width: W, height: 1000, style: { objectFit: "cover" } }) : h("div", { style: { display: "flex", height: 600, background: "#F3F0EA" } }),
      h(
        "div",
        { style: { flex: 1, display: "flex", flexDirection: "column", padding: "64px 80px 90px" } },
        h("div", { style: { display: "flex", fontSize: 30, letterSpacing: 4, color: "#C8382F", fontFamily: "sans-serif", fontWeight: 700 } }, CATEGORY_LABEL[s.category].toUpperCase()),
        h("div", { style: { display: "flex", marginTop: 22, fontSize: s.title.length > 40 ? 76 : 92, lineHeight: 1.04, color: "#1f2433", fontWeight: 600, letterSpacing: -2 } }, s.title),
        hook ? h("div", { style: { display: "flex", marginTop: 30, fontSize: 40, lineHeight: 1.35, color: "#5f5b54" } }, hook.length > 140 ? `${hook.slice(0, 138)}…` : hook) : null,
        h(
          "div",
          { style: { marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "sans-serif" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700, color: "#C8382F" } }, h("div", { style: { display: "flex", width: 18, height: 18, borderRadius: 9, background: "#C8382F" } }), "pen & paper stories"),
          h("div", { style: { display: "flex", fontSize: 30, color: "#5f5b54" } }, `${readLabel(s.readingMinutes)}${s.audioId ? " · Listen" : ""}`),
        ),
      ),
    ),
    { width: W, height: H },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400", "Content-Disposition": `inline; filename="${slug}.jpg"` } });
}
