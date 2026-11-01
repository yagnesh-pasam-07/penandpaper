import Link from "next/link";
import { btn } from "@/components/btn";
import { Logo, ThemeToggle } from "@/components/ui";
import { HeroGallery } from "./everywhere";
import { TryIt } from "./try-it";

const START = "/signup?next=/drop";

/** A quiet link with a visible keyboard focus ring. */
const link = "rounded-sm underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text";

/** A plain outline of the LinkedIn "in" mark, in the text colour. */
function LinkedInGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10v6M8 7.5v.01M12 16v-6M12 12.5c0-1.4 1.1-2.5 2.5-2.5S17 11.1 17 12.5V16" />
    </svg>
  );
}

/** Pen and Paper Desk: what it is, three steps, try it, one button. Nothing else. */
export function Home({ supportEmail }: { supportEmail?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-8">
        {/* One name, one hand: "pen & paper desk", the product in red (like "pen & paper stories"). */}
        <span className="flex items-center gap-2">
          <Link href="/" aria-label="Pen and Paper home" className={link}>
            <Logo size="sm" />
          </Link>
          <Link href="/desk" className="font-hand text-2xl font-bold text-red-text hover:underline hover:decoration-2 hover:underline-offset-4">
            desk
          </Link>
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Link href="/stories" className="flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-mute hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text">
            Stories
          </Link>
          <Link href="/login" className="flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-mute hover:bg-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text">
            Sign in
          </Link>
          <ThemeToggle />
        </span>
      </nav>

      <main className="flex flex-col">
        {/* What it is, in one line, and one button. */}
        <section className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-7 px-5 pt-14 pb-12 text-center sm:px-8 sm:pt-20">
          <h1 className="font-hand text-[56px] leading-[0.98] font-bold sm:text-[104px]">
            Your head is full.
            <br />
            <span className="highlight">Put it down.</span>
          </h1>
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
                <span className="font-hand text-[32px] leading-none font-bold">{title}</span>
                <span className="text-[16px] leading-relaxed text-mute">{line}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Try it: understanding comes from doing. */}
        <section id="try" aria-labelledby="try-title" className="mx-auto flex w-full max-w-[880px] scroll-mt-20 flex-col gap-6 px-5 pb-16 sm:px-8">
          <h2 id="try-title" className="text-center font-hand text-[36px] leading-none font-bold sm:text-[44px]">
            Try it. No account.
          </h2>
          <TryIt />
        </section>

        <section className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-6 px-5 pt-6 pb-24 text-center sm:px-8 sm:pb-32">
          <p className="font-hand text-[48px] leading-none font-bold sm:text-[80px]">Empty your head.</p>
          <Link href={START} className={`${btn.primary} h-[56px] px-8 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-text`}>
            Start a paper
          </Link>
          <Link href="/download" className={`text-[15px] text-mute ${link}`}>
            Also on Mac and in Chrome
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-8 text-[13px] text-mute sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:px-8">
          <span className="flex items-center gap-5">
            <Logo size="sm" />
            <Link href="/privacy" className={link}>
              Privacy
            </Link>
            {supportEmail && (
              <a href={`mailto:${supportEmail}`} className={link}>
                Contact
              </a>
            )}
          </span>
          <p className="flex flex-col gap-1 sm:ml-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
            <span className="flex items-center gap-3">
              {/* Black and white by CSS, so the colour photo stays untouched. A second link to the same place would be a pointless tab stop, so it is hidden from keyboards and screen readers. */}
              <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- a 320 px local file shown at 44 px */}
                <img src="/creator.jpg" alt="" width={44} height={44} loading="lazy" className="size-11 rounded-full object-cover ring-1 ring-line grayscale contrast-[1.05] [[data-theme=dark]_&]:opacity-90" />
              </a>
              <span className="flex items-center gap-1.5">
                Made by
                <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 font-medium text-ink hover:underline ${link}`}>
                  <LinkedInGlyph />
                  Yagnesh Pasam
                </a>
              </span>
            </span>
            <span>
              Suggestions or feedback?{" "}
              <a href="mailto:yagneshpasam0@gmail.com" className={`font-medium text-ink hover:underline ${link}`}>
                yagneshpasam0@gmail.com
              </a>
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
