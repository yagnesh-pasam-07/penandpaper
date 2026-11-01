import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RowCard } from "@/modules/stories/cards";
import { StoriesShell } from "@/modules/stories/chrome";
import { allSeries, seriesStories } from "@/modules/stories/server";

export async function generateStaticParams() {
  const all = await allSeries();
  // Cache Components needs at least one; an unknown series 404s.
  return all.length ? all.map((s) => ({ slug: s.slug })) : [{ slug: "first-series" }];
}

export async function generateMetadata(props: PageProps<"/stories/series/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const { name, stories } = await seriesStories(slug);
  if (!name) return { title: "Series not found · Pen & Paper" };
  return { title: `${name} · Pen & Paper Stories`, description: `${stories.length} ${stories.length === 1 ? "story" : "stories"} in the series ${name}.`, alternates: { canonical: `/stories/series/${slug}` } };
}

/** A series: its stories in the order they came out, so it reads like chapters. */
export default async function SeriesPage(props: PageProps<"/stories/series/[slug]">) {
  const { slug } = await props.params;
  const { name, stories } = await seriesStories(slug);
  if (!name) notFound();
  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[728px] flex-col gap-8 px-6 pt-10 pb-20 sm:pt-16">
        <header className="flex flex-col gap-3 border-b border-line pb-8">
          <p className="font-sans text-[13px] font-semibold tracking-[0.08em] text-red-text uppercase">A series</p>
          <h1 className="story-serif text-[40px] leading-[1.05] font-medium tracking-[-0.02em] text-balance text-ink sm:text-[56px]">{name}</h1>
          <p className="story-serif text-[19px] text-mute">
            {stories.length} {stories.length === 1 ? "story" : "stories"}, in the order they were written.
          </p>
        </header>
        <ol className="flex flex-col divide-y divide-line">
          {stories.map((s, i) => (
            <li key={s.id} className="flex items-start gap-4">
              <span aria-hidden="true" className="story-serif pt-7 text-[28px] text-line">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <RowCard s={s} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </StoriesShell>
  );
}
