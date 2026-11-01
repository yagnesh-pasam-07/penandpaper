import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { mediaBytes, publishedStory } from "@/modules/stories/server";

export const alt = "A story on Pen & Paper";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";

/** The cover, small enough to embed (WhatsApp wants the whole card under about 300 KB). */
async function cover(id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    const jpg = await sharp(await mediaBytes(id)).resize({ width: 560, height: 630, fit: "cover" }).jpeg({ quality: 72 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * The picture a shared story shows on WhatsApp, Instagram and X: the cover on
 * the right, the title and the hook on warm paper, the red nib.
 */
export default async function Image(props: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await props.params;
  const s = await publishedStory(slug);
  const img = await cover(s?.coverId ?? null);
  const title = s?.title ?? "Pen & Paper Stories";
  const hook = s ? s.hook || s.subtitle : "Real stories, read slowly.";
  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FAF8F3", fontFamily: "serif" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 56px 56px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, color: "#C8382F", fontWeight: 700, fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: "#C8382F" }} />
            pen &amp; paper · stories
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 22, letterSpacing: 3, color: "#C8382F", fontFamily: "sans-serif", fontWeight: 700 }}>{s ? CATEGORY_LABEL[s.category].toUpperCase() : "STORIES"}</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: title.length > 44 ? 52 : 64, lineHeight: 1.08, color: "#1f2433", fontWeight: 600, letterSpacing: -1.5 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 28, lineHeight: 1.4, color: "#5f5b54" }}>{hook.length > 120 ? `${hook.slice(0, 118)}…` : hook}</div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#5f5b54", fontFamily: "sans-serif" }}>{s ? `${s.author} · ${readLabel(s.readingMinutes)}${s.hasAudio ? " · Listen" : ""}` : ""}</div>
        </div>
        {img && (
          <img src={img} width={460} height={630} alt="" style={{ objectFit: "cover" }} />
        )}
      </div>
    ),
    size,
  );
  // A JPEG, about 100 KB: WhatsApp skips previews much over 300 KB, and a PNG of a photo is 400.
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
