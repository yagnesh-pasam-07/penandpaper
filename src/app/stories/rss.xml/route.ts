import { cacheLife, cacheTag } from "next/cache";
import { CATEGORY_LABEL } from "@/modules/stories/logic";
import { publishedStories, STORIES_TAG } from "@/modules/stories/server";
import { siteUrl } from "@/modules/stories/site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function feed(): Promise<string> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  const site = siteUrl();
  const items = (await publishedStories(50))
    .map(
      (s) => `    <item>
      <title>${esc(s.title)}</title>
      <link>${site}/stories/${s.slug}</link>
      <guid isPermaLink="true">${site}/stories/${s.slug}</guid>
      <pubDate>${new Date(s.publishAt).toUTCString()}</pubDate>
      <category>${esc(CATEGORY_LABEL[s.category])}</category>
      <description>${esc(s.hook || s.subtitle)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Pen &amp; Paper Stories</title>
    <link>${site}/stories</link>
    <atom:link href="${site}/stories/rss.xml" rel="self" type="application/rss+xml" />
    <description>Real human stories, history and art. Read slowly.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;
}

/** `GET /stories/rss.xml`: the newest 50 stories, for feed readers. */
export async function GET() {
  return new Response(await feed(), { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
