import type { MetadataRoute } from "next";
import { publishedSlugs } from "@/modules/stories/server";
import { siteUrl } from "@/modules/stories/site";

/** The public pages search engines should know: home, the app's download page, and every published story. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const stories = await publishedSlugs();
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/stories`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/stories/unnoticed`, changeFrequency: "daily", priority: 0.8 },
    { url: `${site}/desk`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/download`, changeFrequency: "monthly", priority: 0.5 },
    ...stories.map((s) => ({ url: `${site}/stories/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
