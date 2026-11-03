import type { Metadata } from "next";
import Link from "next/link";
import { StoriesShell } from "@/modules/stories/chrome";
import { tiltOf } from "@/modules/stories/clipping";
import { catalogue, coverOf, UNNOTICED } from "@/modules/stories/unnoticed";

export const metadata: Metadata = {
  title: "Unnoticed · Pen & Paper Stories",
  description: "Small moments nobody noticed: people, nature and the things we all do, in Telugu. By Pen & Paper.",
  alternates: { canonical: "/stories/unnoticed" },
  openGraph: { title: "Unnoticed, by Pen & Paper", description: "Small moments nobody noticed. In Telugu.", type: "website", url: "/stories/unnoticed", images: [coverOf(catalogue()[0]?.code ?? "")] },
};

/**
 * /stories/unnoticed: every post, one after another, newest first, like
 * turning the pages of a scrapbook. Each is pasted in large, with its own
 * words beneath and a quiet way to see it on Instagram. Nothing else.
 */
export default function UnnoticedPage() {
  const all = catalogue();
  return (
    <StoriesShell>
      <div className="mx-auto flex w-full max-w-[560px] flex-col px-5 pt-10 pb-24 sm:pt-14">
        <header className="flex flex-col gap-3 pb-14 text-center">
          <h1 className="story-serif text-[52px] leading-none font-medium tracking-[-0.02em] text-ink italic sm:text-[64px]">Unnoticed</h1>
          <p className="story-serif text-[18px] leading-[1.5] text-mute">Small moments nobody noticed. In Telugu.</p>
          <a href={UNNOTICED.url} target="_blank" rel="noopener" className="mx-auto font-sans text-[14px] text-mute underline decoration-line-strong underline-offset-4 hover:text-ink">
            @{UNNOTICED.handle}
          </a>
        </header>

        <ol className="flex flex-col gap-20 sm:gap-24">
          {all.map((e) => (
            <li key={e.code} id={e.code} className="flex scroll-mt-24 flex-col gap-5">
              <Link href={`/stories/unnoticed/${e.code}`} className="group relative block" style={{ transform: `rotate(${tiltOf(e.code) * 0.6}deg)` }}>
                <span aria-hidden="true" className="absolute -top-3.5 left-1/2 z-10 h-7 w-24 -translate-x-1/2 rotate-[-3deg] bg-[color-mix(in_srgb,#efe2b4_70%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] dark:bg-[color-mix(in_srgb,#c9bb8a_45%,transparent)]" />
                <span className="block bg-[#f4efe4] p-2 pb-3 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.6),0_2px_6px_rgba(0,0,0,0.1)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local WebP, already sized */}
                  <img src={coverOf(e.code)} alt={e.title.join(" ")} width={720} height={Math.round(720 / e.ratio)} loading="lazy" className="block h-auto w-full" />
                </span>
              </Link>
              <div className="flex flex-col gap-2 px-1">
                <p className="font-sans text-[15px] leading-relaxed whitespace-pre-line text-ink">{e.caption}</p>
                <a href={`https://www.instagram.com/p/${e.code}/`} target="_blank" rel="noopener" className="w-fit font-sans text-[13px] text-mute hover:text-ink">
                  View on Instagram ↗
                </a>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </StoriesShell>
  );
}
