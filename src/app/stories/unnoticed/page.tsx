import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StoriesShell } from "@/modules/stories/chrome";
import { Clipping } from "@/modules/stories/clipping";
import { catalogue, COUNTED, coverOf, SHELVES, UNNOTICED } from "@/modules/stories/unnoticed";
import { liveLikes } from "./likes";

export const metadata: Metadata = {
  title: "Unnoticed · Pen & Paper Stories",
  description: "A library of small moments nobody noticed: people, nature and the things we all do, told with a smile, in Telugu. By Pen & Paper.",
  alternates: { canonical: "/stories/unnoticed" },
  openGraph: { title: "Unnoticed, by Pen & Paper", description: "A library of small moments nobody noticed. Short, relatable, in Telugu.", type: "website", url: "/stories/unnoticed", images: [coverOf(catalogue()[0]?.code ?? "")] },
};

/**
 * /stories/unnoticed: the short pieces as a library, not a feed. A reel of
 * clippings, the catalogue ranked like IMDb's chart, and shelves by what
 * they're about. Every entry has its own page.
 */
export default function UnnoticedPage() {
  return (
    <Suspense fallback={<StoriesShell>{null}</StoriesShell>}>
      <Library />
    </Suspense>
  );
}

async function Library() {
  const live = await liveLikes();
  const all = catalogue(live);
  const ranked = [...all].sort((a, b) => b.rating - a.rating || b.likes - a.likes);
  const best = ranked[0];
  return (
    <StoriesShell>
      <div className="flex flex-col gap-16 pb-24">
        <header className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-5 pt-10 sm:px-8 sm:pt-14">
          <span className="font-sans text-[12px] font-semibold tracking-[0.16em] text-red-text uppercase">Pen &amp; Paper · a library of small moments</span>
          <h1 className="story-serif text-[56px] leading-[0.95] font-medium tracking-[-0.02em] text-ink italic sm:text-[84px]">Unnoticed</h1>
          <p className="story-serif max-w-[640px] text-[19px] leading-[1.55] text-mute sm:text-[21px]">
            People, nature, and the things we all do, noticed and kept. Each one is a single moment, in Telugu, told with a straight face. Some will be about you. The rest, about someone you know.
          </p>
          <p className="font-sans text-[13px] text-mute">
            {all.length} {all.length === 1 ? "entry" : "entries"} · new ones every week on{" "}
            <a href={UNNOTICED.url} target="_blank" rel="noopener" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              @{UNNOTICED.handle}
            </a>
          </p>
        </header>

        {/* The reel: clippings pasted along the page, scrolled sideways. */}
        <section aria-labelledby="reel" className="flex flex-col gap-2">
          <h2 id="reel" className="mx-auto w-full max-w-[1120px] px-5 font-hand text-[30px] leading-none font-bold text-ink sm:px-8">
            Freshly pasted
          </h2>
          <ul className="flex snap-x snap-mandatory gap-10 overflow-x-auto scroll-px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] pt-8 pb-8 [scrollbar-width:thin]">
            {all.map((e) => (
              <li key={e.code} className="snap-start">
                <Clipping entry={e} no={e.no} rating={e.rating} width={240} />
              </li>
            ))}
          </ul>
        </section>

        {/* The chart: every entry, ranked by how loved it is. */}
        <section aria-labelledby="chart" className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
            <h2 id="chart" className="font-hand text-[30px] leading-none font-bold text-ink">
              The chart
            </h2>
            <span className="font-sans text-[12px] text-mute">Rated out of 10 against our most-loved entry{best ? ` (No. ${best.no})` : ""} · hearts counted {new Date(COUNTED).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </div>
          <ol className="flex flex-col">
            {ranked.map((e, i) => (
              <li key={e.code} className="border-b border-dashed border-line last:border-0">
                <Link href={`/stories/unnoticed/${e.code}`} className="group grid grid-cols-[2.5rem_64px_1fr] items-center gap-4 py-4 sm:grid-cols-[3rem_72px_1fr_auto] sm:gap-6">
                  <span className="font-hand text-[34px] leading-none font-bold text-red-text tabular-nums">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a small local WebP */}
                  <img src={coverOf(e.code)} alt="" width={72} height={90} loading="lazy" className="h-[80px] w-[64px] object-cover shadow-[0_6px_14px_-8px_rgba(0,0,0,0.6)] sm:h-[90px] sm:w-[72px]" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="story-serif text-[20px] leading-tight text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4 sm:text-[22px]">
                      {e.title[0]} <span className="italic">{e.title[1]}</span>
                    </span>
                    <span className="line-clamp-1 font-sans text-[13px] text-mute">
                      No. {e.no}
                      {e.chapter ? ` · ${e.chapter}` : ""} · {e.shelves.map((k) => SHELVES.find((s) => s.key === k)?.title).join(", ")}
                    </span>
                  </span>
                  <span className="col-start-3 flex items-center gap-3 sm:col-start-auto">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-soft" aria-hidden="true">
                      <span className="block h-full rounded-full bg-red-text" style={{ width: `${e.rating * 10}%` }} />
                    </span>
                    <span className="font-sans text-[13px] text-mute tabular-nums">
                      <span className="font-hand text-[24px] font-bold text-ink">{e.rating.toFixed(1)}</span>
                      /10 · ♥ {e.likes}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Shelves: by what it's about. */}
        {SHELVES.map((sh) => {
          const on = all.filter((e) => e.shelves.includes(sh.key));
          if (!on.length) return null;
          return (
            <section key={sh.key} aria-labelledby={`shelf-${sh.key}`} className="flex flex-col gap-2">
              <h2 id={`shelf-${sh.key}`} className="mx-auto flex w-full max-w-[1120px] flex-wrap items-baseline gap-x-3 px-5 sm:px-8">
                <span className="font-hand text-[30px] leading-none font-bold text-ink">{sh.title}</span>
                <span className="font-sans text-[13px] text-mute">{sh.sub}</span>
              </h2>
              <ul className="flex snap-x gap-8 overflow-x-auto scroll-px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] px-[max(1.25rem,calc((100vw-1120px)/2+2rem))] pt-6 pb-6 [scrollbar-width:thin]">
                {on.map((e) => (
                  <li key={e.code} className="snap-start">
                    <Clipping entry={e} no={e.no} rating={e.rating} width={180} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </StoriesShell>
  );
}
