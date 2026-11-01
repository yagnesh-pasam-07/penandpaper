import type { Metadata } from "next";
import { LeadCard, RowCard } from "@/modules/stories/cards";
import { StoriesShell } from "@/modules/stories/chrome";
import { publishedStories } from "@/modules/stories/server";

export const metadata: Metadata = {
  title: "Stories · Pen & Paper",
  description: "Real human stories, history and art. Three to five minutes each, to read on the way or listen to with your eyes closed.",
  alternates: { canonical: "/stories", types: { "application/rss+xml": "/stories/rss.xml" } },
  openGraph: { title: "Pen & Paper Stories", description: "Real human stories, history and art. Read it on the way, or listen.", type: "website", url: "/stories" },
};

/** /stories: every published story, newest first. Cached; a new one appears within 15 minutes of its time. */
export default async function StoriesPage() {
  const list = await publishedStories();
  const [lead, ...rest] = list;
  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-10 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <header className="flex flex-col gap-3 border-b border-line pb-8">
          <h1 className="story-serif text-[44px] leading-none font-medium tracking-[-0.02em] text-ink italic sm:text-[64px]">Stories</h1>
          <p className="story-serif max-w-[560px] text-[19px] leading-[1.5] text-mute sm:text-[21px]">Real people, history and art. A few minutes each: read it on the way, or listen with your eyes closed.</p>
        </header>
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
