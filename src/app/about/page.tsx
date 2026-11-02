import type { Metadata } from "next";
import Link from "next/link";
import { StoriesShell } from "@/modules/stories/chrome";
import { Social } from "@/modules/about/social";
import { WritingJourney } from "@/modules/about/writing-journey";
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
            <img src="/creator.jpg" alt="Yagnesh Pasam" width={80} height={80} className="size-20 shrink-0 rounded-full object-cover ring-1 ring-line" />
            <h1 className="text-[40px] leading-[1.05] font-medium tracking-[-0.02em] text-ink sm:text-[48px]">Hi, I&apos;m Yagnesh.</h1>
          </div>

          <p>I love creating things. Software, sport, art, design, photography, videos: the field doesn&apos;t matter to me. I love producing something that wasn&apos;t there before.</p>

          <p>Pen and Paper comes from one love: putting thoughts down on paper.</p>

          <p>Since I was a child, nothing has shaped me more than a pen and a sheet of paper. Exams. Drawings. Ideas at midnight. Even code, which I still sketch on paper before I type it. Almost everything that mattered to me started there.</p>

          <p>It&apos;s an old love, older than any of us. First people drew on cave walls. Then they wrote on clay, then on palm leaves, and then came paper. Every time, it was the same wish: don&apos;t let this thought be lost.</p>

          <WritingJourney />

          <h2 className="pt-4 font-sans text-[22px] font-semibold tracking-[-0.01em] text-ink">Writers are the original thinkers</h2>

          <p>I believe writing is the one truly original thing we make. Everything else is a summary.</p>

          <p>Think of the Ramayana. Valmiki witnessed it, and he wrote it down. That&apos;s the only reason we can still feel it today. If no one had written it, this generation would never have known the story at all.</p>

          <figure className="mx-auto my-2 flex w-full max-w-[360px] flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a public-domain painting from Wikimedia Commons */}
            <img
              src="https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Sage_Narada_at_the_hermitage_of_Sage_Valmiki_requesting_him_to_write_the_Story_of_Rama.jpg/960px-Sage_Narada_at_the_hermitage_of_Sage_Valmiki_requesting_him_to_write_the_Story_of_Rama.jpg"
              alt="A painting of Sage Narada at Valmiki's hermitage, asking him to write the story of Rama"
              width={960}
              height={667}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-md bg-soft"
            />
            <figcaption className="px-1 text-center font-sans text-[13px] leading-relaxed text-mute">
              Narada at Valmiki&apos;s hermitage, asking him to write the story of Rama. Because he wrote it, we still have it.
              <span className="mt-1 block text-[12px]">
                Kangra painting, early 19th century,{" "}
                <a href="https://commons.wikimedia.org/wiki/File:Sage_Narada_at_the_hermitage_of_Sage_Valmiki_requesting_him_to_write_the_Story_of_Rama.jpg" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  public domain, Wikimedia Commons
                </a>
              </span>
            </figcaption>
          </figure>

          <p>Writers are witnesses. They keep people alive. And our stories matter. They are what make us want to live.</p>

          <blockquote className="my-2 border-l-[3px] border-red pl-5 text-[23px] leading-[1.5] text-ink italic sm:pl-6">The public life you see is an outcome of a private one.</blockquote>

          <p>Filmmakers, founders, entrepreneurs, gurus. Look closely at the people who build things and you&apos;ll find one thing in common: they read a lot, and they write a lot. Their core was built in private, on paper, long before anyone saw the result.</p>

          <h2 className="pt-4 font-sans text-[22px] font-semibold tracking-[-0.01em] text-ink">What I&apos;m building</h2>

          <p>A quality space for writers, and for thoughts. Two things, for now:</p>

          <p>
            <Link href="/stories" className="font-semibold underline decoration-1 underline-offset-4">
              Pen and Paper Stories
            </Link>
            : original stories of real people. Not content. The truths people carry, written down so they aren&apos;t lost. My observations, my photos, what I see and what I think.
          </p>

          <p>
            <Link href="/desk" className="font-semibold underline decoration-1 underline-offset-4">
              Pen and Paper Desk
            </Link>
            : a small place for your own thoughts. Drop one in, in a second. It comes back when it matters.
          </p>

          <h2 className="pt-4 font-sans text-[22px] font-semibold tracking-[-0.01em] text-ink">Why</h2>

          <p>Technology keeps changing. We went from Homo sapiens to the AI era. The tools change, the jobs change, what we work on changes.</p>

          <p>But a few things never change. We eat. We work: back then it was hunting, now it&apos;s a job. We sleep. We feel. Human emotions are the same as they always were.</p>

          <p>I want to write about those constant things, in this AI era. Born in the 17th century, I might have written about war, and how to fight it better. Born in 5000 BC, maybe about how to reach Krishna. I was born now, so I&apos;m writing about now.</p>

          <p>Stories and a desk for thoughts look like two different things. I feel the dots will connect.</p>

          <p>Maybe one day there will be books. I honestly don&apos;t know where this goes. I&apos;m still figuring it out. Don&apos;t judge it yet.</p>

          <p>This is just the beginning. Let&apos;s see where it takes us.</p>

          <div className="flex flex-col gap-4 pt-2">
            <span>Yagnesh</span>
            <Social />
          </div>
        </article>
      </StoriesShell>
    </div>
  );
}
