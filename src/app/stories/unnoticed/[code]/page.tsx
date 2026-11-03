import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StoriesShell } from "@/modules/stories/chrome";
import { Clipping, tiltOf } from "@/modules/stories/clipping";
import { CATALOGUE, catalogue, coverOf, entry, SHELVES } from "@/modules/stories/unnoticed";
import { liveLikes } from "../likes";

export function generateStaticParams() {
  return CATALOGUE.map((e) => ({ code: e.code }));
}

export async function generateMetadata(props: PageProps<"/stories/unnoticed/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const e = entry(code);
  if (!e) return { title: "Unnoticed · Pen & Paper" };
  const title = `${e.title[0]} ${e.title[1]}`;
  return {
    title: `${title} · Unnoticed`,
    description: e.logline,
    alternates: { canonical: `/stories/unnoticed/${code}` },
    openGraph: { title: `${title} · Unnoticed, by Pen & Paper`, description: e.logline, type: "article", url: `/stories/unnoticed/${code}`, images: [coverOf(code)] },
  };
}

/** One entry, like a film's page on IMDb: the cover pasted in, its card, what it's about, and more like it. */
export default function EntryPage(props: PageProps<"/stories/unnoticed/[code]">) {
  return (
    <Suspense fallback={<StoriesShell>{null}</StoriesShell>}>
      <Entry params={props.params} />
    </Suspense>
  );
}

async function Entry({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const live = await liveLikes();
  const e = entry(code, live);
  if (!e) notFound();
  const all = catalogue(live);
  const rank = [...all].sort((a, b) => b.rating - a.rating || b.likes - a.likes).findIndex((x) => x.code === code) + 1;
  // More like this: entries sharing a shelf, most loved first.
  const alike = all.filter((x) => x.code !== code && x.shelves.some((s) => e.shelves.includes(s))).sort((a, b) => b.rating - a.rating).slice(0, 6);
  const shelves = e.shelves.map((k) => SHELVES.find((s) => s.key === k)!);
  const t = tiltOf(code);
  return (
    <StoriesShell>
      <article className="mx-auto flex w-full max-w-[1040px] flex-col gap-14 px-5 pt-8 pb-24 sm:px-8 sm:pt-12">
        <Link href="/stories/unnoticed" className="font-sans text-[14px] text-mute hover:text-ink">
          ← Unnoticed
        </Link>

        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,380px)_1fr] md:gap-14">
          {/* The cover, pasted onto the page. */}
          <figure className="relative mx-auto w-full max-w-[380px]" style={{ transform: `rotate(${t}deg)` }}>
            <span aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 h-7 w-24 -translate-x-1/2 rotate-[-4deg] bg-[color-mix(in_srgb,#efe2b4_70%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:bg-[color-mix(in_srgb,#c9bb8a_45%,transparent)]" />
            <span className="block bg-[#f4efe4] p-2 pb-4 shadow-[0_30px_50px_-28px_rgba(0,0,0,0.7),0_2px_6px_rgba(0,0,0,0.12)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local WebP, already sized */}
              <img src={coverOf(code)} alt={`${e.title[0]} ${e.title[1]}`} width={720} height={Math.round(720 / e.ratio)} className="block h-auto w-full" />
            </span>
          </figure>

          {/* The card: what a library card would say. */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <span className="font-hand text-[26px] leading-none font-bold text-red-text">No. {e.no}{e.chapter ? ` · ${e.chapter}` : ""}</span>
              <h1 className="story-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[54px]">
                {e.title[0]}
                <br />
                <span className="italic">{e.title[1]}</span>
              </h1>
            </div>

            <dl className="grid grid-cols-3 gap-4 border-y border-line py-4 font-sans">
              <div className="flex flex-col gap-1">
                <dt className="text-[12px] text-mute">Rating</dt>
                <dd className="text-[13px] text-mute tabular-nums">
                  <span className="font-hand text-[32px] leading-none font-bold text-ink">{e.rating.toFixed(1)}</span>/10
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[12px] text-mute">Rank</dt>
                <dd className="font-hand text-[32px] leading-none font-bold text-ink">
                  #{rank} <span className="font-sans text-[13px] font-normal text-mute">of {all.length}</span>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[12px] text-mute">Hearts</dt>
                <dd className="font-hand text-[32px] leading-none font-bold text-ink tabular-nums">{e.likes}</dd>
              </div>
            </dl>

            <p className="story-serif text-[20px] leading-[1.55] text-ink">{e.logline}</p>

            {e.aside && (
              <p className="font-sans text-[14px] text-mute">
                Written on it, small: <span className="story-serif text-[17px] text-ink italic">&ldquo;{e.aside}&rdquo;</span>
              </p>
            )}

            <blockquote className="border-l-2 border-red-text/60 pl-4 font-sans text-[15px] leading-relaxed whitespace-pre-line text-mute">{e.caption}</blockquote>

            <div className="flex flex-wrap items-center gap-2 font-sans text-[13px]">
              {shelves.map((s) => (
                <span key={s.key} className="rounded-full border border-line px-3 py-1 text-ink">
                  {s.title} <span className="text-mute">· {s.sub}</span>
                </span>
              ))}
            </div>

            <a
              href={`https://www.instagram.com/p/${code}/`}
              target="_blank"
              rel="noopener"
              className="flex h-11 w-fit items-center rounded-full bg-ink px-5 font-sans text-[14px] font-semibold text-bg"
            >
              See every slide on Instagram ↗
            </a>
          </div>
        </div>

        {alike.length > 0 && (
          <section aria-labelledby="alike" className="flex flex-col gap-2">
            <h2 id="alike" className="font-hand text-[30px] leading-none font-bold text-ink">
              More like this
            </h2>
            <ul className="-mx-5 flex snap-x gap-8 overflow-x-auto px-5 pt-6 pb-6 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
              {alike.map((x) => (
                <li key={x.code} className="snap-start">
                  <Clipping entry={x} no={x.no} rating={x.rating} width={180} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </StoriesShell>
  );
}
