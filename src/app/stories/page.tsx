import type { Metadata } from "next";
import { LeadCard, RowCard } from "@/modules/stories/cards";
import { StoriesShell } from "@/modules/stories/chrome";
import Link from "next/link";
import { Suspense } from "react";
import { allSeries, publishedStories } from "@/modules/stories/server";

export const metadata: Metadata = {
  title: "Stories · Pen & Paper",
  description: "Real human stories, history and art. Three to five minutes each, to read on the way or listen to with your eyes closed.",
  alternates: { canonical: "/stories", types: { "application/rss+xml": "/stories/rss.xml" } },
  openGraph: { title: "Pen & Paper Stories", description: "Real human stories, history and art. Read it on the way, or listen.", type: "website", url: "/stories" },
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
          <h1 className="story-serif text-[44px] leading-none font-medium tracking-[-0.02em] text-ink italic sm:text-[64px]">Stories</h1>
          <p className="story-serif max-w-[560px] text-[19px] leading-[1.5] text-mute sm:text-[21px]">Real people, history and art. A few minutes each: read it on the way, or listen with your eyes closed.</p>
          <Link href="/stories/unnoticed" className="group flex max-w-[560px] items-baseline gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 hover:bg-soft">
            <span className="font-hand text-[26px] leading-none font-bold text-red-text">Unnoticed</span>
            <span className="font-sans text-[14px] text-mute">Short ones, in Telugu: people, nature and the things we all do, told with a smile →</span>
          </Link>
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
              <section aria-label="More stories" className="flex flex-col divide-y divide-line border-t border-line">
                {rest.map((s) => (
                  <RowCard key={s.id} s={s} />
                ))}
              </section>
            )}
          </>
        ) : (
          <p className="story-serif py-20 text-center text-[21px] text-mute italic">The first story is on its way.</p>
        )}
      </div>
    </StoriesShell>
  );
}
