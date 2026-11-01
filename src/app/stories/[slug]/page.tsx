import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RowCard } from "@/modules/stories/cards";
import { StoriesShell } from "@/modules/stories/chrome";
import { CATEGORY_LABEL } from "@/modules/stories/logic";
import { mediaIds } from "@/modules/stories/markdown";
import { StoryReader } from "@/modules/stories/reader";
import { mediaSizes, publishedSlugs, publishedStories, publishedStory } from "@/modules/stories/server";
import { siteUrl } from "@/modules/stories/site";

/** Every published story is prerendered; a new one is rendered on its first visit, then cached. */
export async function generateStaticParams() {
  const slugs = await publishedSlugs();
  // Cache Components needs at least one; an unknown slug simply 404s.
  return slugs.length ? slugs.map((s) => ({ slug: s.slug })) : [{ slug: "first-story" }];
}

export async function generateMetadata(props: PageProps<"/stories/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const s = await publishedStory(slug);
  if (!s) return { title: "Story not found · Pen & Paper" };
  const description = s.hook || s.subtitle;
  return {
    title: `${s.title} · Pen & Paper Stories`,
    description,
    authors: [{ name: s.author }],
    alternates: { canonical: `/stories/${s.slug}` },
    openGraph: {
      type: "article",
      title: s.title,
      description,
      url: `/stories/${s.slug}`,
      siteName: "Pen & Paper Stories",
      publishedTime: s.publishAt,
      modifiedTime: s.updatedAt,
      authors: [s.author],
      section: CATEGORY_LABEL[s.category],
      locale: s.language === "te" ? "te_IN" : "en_IN",
    },
    twitter: { card: "summary_large_image", title: s.title, description },
  };
}

export default async function StoryPage(props: PageProps<"/stories/[slug]">) {
  const { slug } = await props.params;
  const story = await publishedStory(slug);
  if (!story) notFound();
  const ids = [story.coverId, ...mediaIds(story.body)].filter((x): x is string => !!x);
  const [sizes, all] = await Promise.all([mediaSizes(ids).catch(() => ({})), publishedStories(4)]);
  const next = all.filter((s) => s.id !== story.id).slice(0, 2);
  const url = `${siteUrl()}/stories/${story.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.hook || story.subtitle,
    datePublished: story.publishAt,
    dateModified: story.updatedAt,
    author: { "@type": "Person", name: story.author },
    publisher: { "@type": "Organization", name: "Pen & Paper" },
    mainEntityOfPage: url,
    inLanguage: story.language,
  };
  return (
    <StoriesShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <StoryReader
        story={story}
        base="/api/stories/media/"
        sizes={sizes}
        url={url}
        count
        more={
          next.length > 0 && (
            <section aria-label="More stories" className="flex flex-col pt-6">
              <h2 className="text-[13px] font-semibold tracking-[0.08em] text-mute uppercase">Read next</h2>
              <div className="flex flex-col divide-y divide-line">
                {next.map((s) => (
                  <RowCard key={s.id} s={s} />
                ))}
              </div>
            </section>
          )
        }
      />
    </StoriesShell>
  );
}
