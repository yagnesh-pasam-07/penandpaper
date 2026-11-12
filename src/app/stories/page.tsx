import type { Metadata } from "next";
import { LeadCard, RowCard } from "@/modules/stories/cards";
import { StoriesShell } from "@/modules/stories/chrome";
import Link from "next/link";
import { Suspense } from "react";
import { allSeries, publishedStories } from "@/modules/stories/server";

export const metadata: Metadata = {
  title: "Writing · Pen and Paper",
  description: "Essays and true stories by Yagnesh Pasam: on life, death, people and the things we notice too late. A few minutes each, to read or listen to.",
  alternates: { canonical: "/stories", types: { "application/rss+xml": "/stories/rss.xml" } },
  openGraph: { title: "Writing · Pen and Paper", description: "Essays and true stories by Yagnesh Pasam. A few minutes each, to read or listen to.", type: "website", url: "/stories" },
};

/** /stories: every published story, newest first. Cached; a new one appears within 15 minutes of its time. */
export default async function StoriesPage(props: PageProps<"/stories">) {
  return (
    <Suspense fallback={<StoriesShell>{null}</StoriesShell>}>
      <Ordered searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Ordered({ searchParams }: { searchParams: PageProps<"/stories">["searchParams"] }) {
  const { sort } = await searchParams;
  return <StoriesList order={sort === "loved" ? "loved" : "new"} />;
}

async function StoriesList({ order }: { order: "new" | "loved" }) {
  const [list, series] = await Promise.all([publishedStories(60, order), allSeries()]);
  const [lead, ...rest] = list;
  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-10 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <header className="flex flex-col gap-3 border-b border-line pb-8">
          <h1 className="story-serif text-[44px] leading-none font-medium tracking-[-0.02em] text-ink sm:text-[60px]">Writing</h1>
          <p className="story-serif max-w-[560px] text-[19px] leading-[1.5] text-mute sm:text-[21px]">Essays and true stories, by Yagnesh Pasam. A few minutes each: read it on the way, or listen.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-[14px] text-mute">
            <a href="/stories/rss.xml" className="underline-offset-4 hover:text-ink hover:underline">RSS</a>
            <a href="https://www.instagram.com/unnoticed.pnp/" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-ink hover:underline">Instagram</a>
            <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-ink hover:underline">LinkedIn</a>
          </p>
        </header>
        {series.length > 0 && (
          <nav aria-label="Series" className="-mt-4 flex flex-wrap items-center gap-2 font-sans">
            <span className="text-[12px] font-semibold tracking-[0.08em] text-mute uppercase">Series</span>
            {series.map((x) => (
              <Link key={x.slug} href={`/stories/series/${x.slug}`} className="rounded-full border border-line px-3.5 py-1.5 text-[14px] text-ink hover:bg-soft">
                {x.name} <span className="text-mute">· {x.count}</span>
              </Link>
            ))}
          </nav>
        )}
        <nav aria-label="Order" className="-mt-4 flex gap-1 font-sans text-[14px]">
          {(
            [
              ["new", "Newest", "/stories"],
              ["loved", "Most loved", "/stories?sort=loved"],
            ] as const
          ).map(([k, label, href]) => (
            <Link key={k} href={href} aria-current={order === k ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 ${order === k ? "bg-ink text-bg" : "text-mute hover:bg-soft hover:text-ink"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {lead ? (
          <>
            <LeadCard s={lead} />
            {rest.length > 0 && (
              <section aria-label="More writing" className="flex flex-col divide-y divide-line border-t border-line">
                {rest.map((s) => (
                  <RowCard key={s.id} s={s} />
                ))}
              </section>
            )}
          </>
        ) : (
          <p className="story-serif py-20 text-center text-[21px] text-mute italic">The first piece is on its way.</p>
        )}
      </div>
    </StoriesShell>
  );
}
