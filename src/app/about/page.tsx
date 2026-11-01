import type { Metadata } from "next";
import Link from "next/link";
import { StoriesShell } from "@/modules/stories/chrome";
import { storyFonts } from "@/modules/stories/fonts";

export const metadata: Metadata = {
  title: "About · Pen and Paper",
  description: "Hi, I'm Yagnesh. I love creating things. Pen and Paper is my love for putting thoughts on paper: a quality space for writers, and for your own thoughts.",
  alternates: { canonical: "/about" },
};

/** Why Pen and Paper exists, in the founder's own words. */
export default function AboutPage() {
  return (
    <div className={storyFonts}>
      <StoriesShell>
        <article className="story-serif mx-auto flex w-full max-w-[680px] flex-col gap-7 px-6 pt-12 pb-24 text-[20px] leading-[1.65] text-ink/90 sm:pt-16">
          <div className="flex items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 320 px local photo shown small */}
            <img src="/creator.jpg" alt="Yagnesh Pasam" width={80} height={80} className="size-20 shrink-0 rounded-full object-cover ring-1 ring-line grayscale" />
            <h1 className="text-[40px] leading-[1.05] font-medium tracking-[-0.02em] text-ink sm:text-[48px]">Hi, I&apos;m Yagnesh.</h1>
          </div>

          <p>I love making things. The field doesn&apos;t matter much to me: software, a drawing, an idea, a story. If I can create it, I&apos;m happy.</p>

          <p>Pen and Paper comes from one love: putting thoughts down on paper.</p>

          <p>Since I was a child, nothing has shaped me more than a pen and a sheet of paper. Exams. Drawings. Ideas at midnight. Even code, which I still sketch on paper before I type it. Almost everything that mattered to me started there.</p>

          <h2 className="pt-4 font-sans text-[22px] font-semibold tracking-[-0.01em] text-ink">Writers are the original thinkers</h2>

          <p>I believe writing is the one truly original thing we make. Everything else is a summary.</p>

          <p>Think of the Ramayana. Valmiki witnessed it, and he wrote it down. That&apos;s the only reason we can still feel it today. If no one had written it, this generation would never have known the story at all.</p>

          <p>Writers are witnesses. They keep people alive. And our stories matter. They are what make us want to live.</p>

          <blockquote className="my-2 border-l-[3px] border-red pl-5 text-[23px] leading-[1.5] text-ink italic sm:pl-6">The public life you see is an outcome of a private one.</blockquote>

          <p>Filmmakers, founders, entrepreneurs, gurus. Look closely at the people who build things and you&apos;ll find one thing in common: they read a lot, and they write a lot. Their core was built in private, on paper, long before anyone saw the result.</p>

          <h2 className="pt-4 font-sans text-[22px] font-semibold tracking-[-0.01em] text-ink">What I&apos;m building</h2>

          <p>A quality space for writers, and for thoughts. Two things, for now:</p>

          <p>
            <Link href="/stories" className="font-semibold underline decoration-1 underline-offset-4">
              Pen and Paper Stories
            </Link>
            : original stories of real people. Not content. Truths that people carry, written down so they aren&apos;t lost.
          </p>

          <p>
            <Link href="/desk" className="font-semibold underline decoration-1 underline-offset-4">
              Pen and Paper Desk
            </Link>
            : a quiet place for your own thoughts. Drop one in a second, and it comes back when it matters.
          </p>

          <p>Maybe one day there will be books. I honestly don&apos;t know where this goes. This is just the beginning.</p>

          <p>Let&apos;s see where it takes us.</p>

          <p className="flex flex-col gap-1 pt-2">
            <span>Yagnesh</span>
            <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" className="font-sans text-[15px] text-mute underline underline-offset-4 hover:text-ink">
              LinkedIn
            </a>
          </p>
        </article>
      </StoriesShell>
    </div>
  );
}
