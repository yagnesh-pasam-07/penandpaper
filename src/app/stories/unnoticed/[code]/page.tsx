import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoriesShell } from "@/modules/stories/chrome";
import { tiltOf } from "@/modules/stories/clipping";
import { CATALOGUE, catalogue, coverOf, entry } from "@/modules/stories/unnoticed";

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

/** One post on its own: pasted in, its words, and the way to the next. Made to be shared. */
export default async function EntryPage(props: PageProps<"/stories/unnoticed/[code]">) {
  const { code } = await props.params;
  const e = entry(code);
  if (!e) notFound();
  const all = catalogue();
  const i = all.findIndex((x) => x.code === code);
  const newer = all[i - 1];
  const older = all[i + 1];
  return (
    <StoriesShell>
      <article className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 pt-8 pb-24 sm:pt-12">
        <Link href={`/stories/unnoticed#${code}`} className="font-sans text-[14px] text-mute hover:text-ink">
          ← Unnoticed
        </Link>
        <figure className="relative mt-4" style={{ transform: `rotate(${tiltOf(code) * 0.6}deg)` }}>
          <span aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 h-7 w-24 -translate-x-1/2 rotate-[-3deg] bg-[color-mix(in_srgb,#efe2b4_70%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:bg-[color-mix(in_srgb,#c9bb8a_45%,transparent)]" />
          <span className="block bg-[#f4efe4] p-2 pb-3 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.6),0_2px_6px_rgba(0,0,0,0.1)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local WebP, already sized */}
            <img src={coverOf(code)} alt={`${e.title[0]} ${e.title[1]}`} width={720} height={Math.round(720 / e.ratio)} className="block h-auto w-full" />
          </span>
        </figure>
        <h1 className="sr-only">
          {e.title[0]} {e.title[1]}
        </h1>
        <p className="px-1 font-sans text-[16px] leading-relaxed whitespace-pre-line text-ink">{e.caption}</p>
        <a href={`https://www.instagram.com/p/${code}/`} target="_blank" rel="noopener" className="w-fit px-1 font-sans text-[14px] text-mute hover:text-ink">
          View on Instagram ↗
        </a>
        <nav aria-label="More" className="mt-8 flex justify-between gap-4 border-t border-line pt-5 font-sans text-[14px]">
          {newer ? (
            <Link href={`/stories/unnoticed/${newer.code}`} className="text-mute hover:text-ink">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {older && (
            <Link href={`/stories/unnoticed/${older.code}`} className="text-mute hover:text-ink">
              Older →
            </Link>
          )}
        </nav>
      </article>
    </StoriesShell>
  );
}
