import type { Metadata } from "next";
import Link from "next/link";
import { StoriesShell } from "@/modules/stories/chrome";
import { storyFonts } from "@/modules/stories/fonts";

export const metadata: Metadata = {
  title: "About · Pen and Paper",
  description: "Every person is a story. Pen and Paper writes them down, and gives you a quiet place for your own thoughts.",
  alternates: { canonical: "/about" },
};

/** What Pen and Paper is, in a few lines. */
export default function AboutPage() {
  return (
    <div className={storyFonts}>
      <StoriesShell>
        <article className="story-serif mx-auto flex w-full max-w-[680px] flex-col gap-7 px-6 pt-12 pb-24 text-[20px] leading-[1.65] text-ink/90 sm:pt-16">
          <h1 className="text-[40px] leading-[1.08] font-medium tracking-[-0.02em] text-ink sm:text-[52px]">Every person is a story. We write them down.</h1>
          <p>Writing is the oldest way we have of keeping someone. Valmiki wrote the Ramayana down, and that is why we can still read it. Most lives are never written down at all.</p>
          <p>Pen and Paper is a small publication of real stories: ordinary people, history, art. Each one is a few minutes long, made to be read on a phone on the way somewhere, or listened to with your eyes closed.</p>
          <p>We don&apos;t do likes for the sake of it, or popups, or feeds that never end. A story, read slowly. If it stays with you, send it to one person.</p>
          <p>
            And there is a tool, too: a quiet paper for your own thoughts, where you can drop a thought in a second and see it again when it matters.{" "}
            <Link href="/tool" className="underline decoration-1 underline-offset-4">
              See the tool
            </Link>
            .
          </p>
          <p className="text-mute italic">Writers are witnesses.</p>
        </article>
      </StoriesShell>
    </div>
  );
}
