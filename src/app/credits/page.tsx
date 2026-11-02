import type { Metadata } from "next";
import Link from "next/link";
import credits from "@/modules/home/timeline-credits.json";
import { StoriesShell } from "@/modules/stories/chrome";
import { storyFonts } from "@/modules/stories/fonts";

export const metadata: Metadata = {
  title: "Photo credits · Pen and Paper",
  description: "The photographs and paintings behind the Pen and Paper homepage, and who made them.",
  alternates: { canonical: "/credits" },
  robots: { index: false },
};

/** Who made the pictures in the homepage background, with their licences. */
export default function CreditsPage() {
  return (
    <div className={storyFonts}>
      <StoriesShell>
        <article className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-6 pt-12 pb-24 sm:pt-16">
          <h1 className="story-serif text-[36px] leading-[1.1] tracking-[-0.02em] text-ink">Photo credits</h1>
          <p className="story-serif text-[19px] leading-[1.6] text-ink/90">
            Behind the homepage is a slow strip of everything that changes, from fire to the galaxy. These are the people who made those pictures. All are from{" "}
            <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Wikimedia Commons
            </a>
            , shown in black and white and blurred.
          </p>
          <ul className="flex flex-col divide-y divide-line border-y border-line font-sans text-[15px]">
            {credits.map((c) => (
              <li key={c.slug} className="flex flex-col gap-0.5 py-3">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline-offset-4 hover:underline">
                  {c.alt}
                </a>
                <span className="text-mute">
                  {c.author.replace(/&amp;/g, "&")} · {c.license}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/" className="font-sans text-[14px] text-mute underline underline-offset-4 hover:text-ink">
            ← Home
          </Link>
        </article>
      </StoriesShell>
    </div>
  );
}
