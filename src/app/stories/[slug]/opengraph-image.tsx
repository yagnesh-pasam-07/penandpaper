import { CATEGORY_LABEL, readLabel } from "@/modules/stories/logic";
import { cardPicture, OG_SIZE, renderCard } from "@/modules/stories/og-card";
import { mediaBytes, publishedStory } from "@/modules/stories/server";

export const alt = "A story on Pen and Paper";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

/** The card a shared story shows on WhatsApp, Instagram, LinkedIn and X. */
export default async function Image(props: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await props.params;
  const s = await publishedStory(slug);
  if (!s) return renderCard({ kicker: "Stories", title: "Real people, written down.", line: "Short, true stories, read slowly.", meta: "", product: "stories" });
  const id = s.shareMediaId ?? s.coverId;
  const picture = await cardPicture(id ? await mediaBytes(id).catch(() => null) : null);
  return renderCard({
    kicker: CATEGORY_LABEL[s.category],
    title: s.title,
    line: s.hook || s.subtitle,
    meta: `${readLabel(s.readingMinutes)}${s.hasAudio ? " · Listen" : ""}`,
    product: "stories",
    picture,
  });
}
