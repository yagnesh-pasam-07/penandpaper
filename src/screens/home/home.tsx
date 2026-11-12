import Link from "next/link";
import { btn } from "@/components/btn";
import { SiteFooter, SiteHeader, siteLink } from "@/components/site";
import { HeroGallery } from "./everywhere";
import { TryIt } from "./try-it";

const START = "/signup?next=/drop";

/** A quiet link with a visible keyboard focus ring. */
const link = "rounded-sm underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

/** Pen and Paper Desk: what it is, three steps, try it, one button. Nothing else. */
export function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader
        end={
          <Link href="/login" className={`rounded-full px-3 py-2 ${siteLink}`}>
            Sign in
          </Link>
        }
      />

      <main className="flex flex-col">
        {/* What it is, in one line, and one button. */}
        <section className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-7 px-5 pt-14 pb-12 text-center sm:px-8 sm:pt-20">
          <h1 className="story-serif text-[40px] leading-[1.08] tracking-[-0.02em] text-balance text-ink sm:text-[60px]">Your head is full. Put it down.</h1>
          <p className="max-w-[460px] text-[18px] leading-normal text-mute sm:text-[20px]">One quiet paper for every thought you don&apos;t want to lose.</p>
          <Link href={START} className={`${btn.primary} h-[56px] px-8 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text`}>
            Start a paper
          </Link>
        </section>

        <div className="mx-auto w-full max-w-[1320px] pb-16">
          <HeroGallery />
        </div>

        {/* How it works: three steps, nothing more. */}
        <section aria-labelledby="how-title" className="mx-auto w-full max-w-[960px] px-5 pb-20 sm:px-8">
          <h2 id="how-title" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              ["Drop it.", "A thought, a link, a picture. Type it, paste it, or just say it. It takes a second."],
              ["See it.", "Everything lands on one paper. Move it, draw a line between two ideas, strike off what's done."],
              ["It comes back.", "Each night, a minute to close the day. Each morning, one old thought returns when it matters."],
            ].map(([title, line], i) => (
              <li key={title} className="flex flex-col gap-2 text-center sm:text-left">
                <span className="font-hand text-[22px] leading-none text-red-text">{i + 1}</span>
                <span className="story-serif text-[26px] leading-none text-ink">{title}</span>
                <span className="text-[16px] leading-relaxed text-mute">{line}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Try it: understanding comes from doing. */}
        <section id="try" aria-labelledby="try-title" className="mx-auto flex w-full max-w-[880px] scroll-mt-20 flex-col gap-6 px-5 pb-16 sm:px-8">
          <h2 id="try-title" className="story-serif text-center text-[32px] leading-none tracking-[-0.01em] text-ink sm:text-[40px]">
            Try it. No account.
          </h2>
          <TryIt />
        </section>

        <section className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-6 px-5 pt-6 pb-24 text-center sm:px-8 sm:pb-32">
          <p className="story-serif text-[36px] leading-none tracking-[-0.02em] text-ink sm:text-[52px]">Empty your head.</p>
          <Link href={START} className={`${btn.primary} h-[56px] px-8 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text`}>
            Start a paper
          </Link>
          <Link href="/download" className={`text-[15px] text-mute ${link}`}>
            Also on Mac and in Chrome
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
