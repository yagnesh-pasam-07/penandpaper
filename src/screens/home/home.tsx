import Link from "next/link";
import type { ReactNode } from "react";
import { ThoughtBubble } from "@/components/canvas/thought-bubble";
import { PenIcon } from "@/components/icons";
import { btn } from "@/components/btn";
import { Logo, ThemeToggle } from "@/components/ui";
import { CarryDemo, ClearDeskDemo, CrumpleDemo, DropDemo, EmailDemo, FoldDemo, PencilDemo, StrikeDemo } from "./demos";
import { TryIt } from "./try-it";

/**
 * Every feature the page talks about, in order. `shipped: false` hides one
 * until it's real, so the page never promises what the app can't do.
 */
const FEATURES: { key: string; tag: string; title: string; line: string; demo: ReactNode; shipped: boolean }[] = [
  { key: "drop", tag: "drop", title: "Drop", line: "Type, Enter, gone from your head.", demo: <DropDemo />, shipped: true },
  { key: "pencil", tag: "pencil or pen", title: "Pencil or pen", line: "Ideas in pencil, tasks in ink.", demo: <PencilDemo />, shipped: true },
  { key: "strike", tag: "strike", title: "Strike", line: "Cross it out like you mean it.", demo: <StrikeDemo />, shipped: true },
  { key: "fold", tag: "fold", title: "Fold till later", line: "Not today? Fold it for Friday.", demo: <FoldDemo />, shipped: true },
  { key: "crumple", tag: "crumple", title: "Crumple", line: "Let go, literally.", demo: <CrumpleDemo />, shipped: true },
  { key: "carry", tag: "carry over", title: "Carry over", line: "Tomorrow starts with what's left.", demo: <CarryDemo />, shipped: true },
  { key: "clear", tag: "clear desk", title: "Clear desk", line: "30 seconds at night. Lighter head.", demo: <ClearDeskDemo />, shipped: true },
  { key: "email", tag: "9 pm", title: "Your day, in your inbox", line: "A short email at 9 PM: what's open, what's done, what's coming.", demo: <EmailDemo />, shipped: true },
];

const DAY = [
  { time: "9:00", title: "Morning", line: "Yesterday's leftovers are already waiting on a fresh sheet." },
  { time: "all day", title: "Day", line: "Drop as things come up. Fold a few for Friday." },
  { time: "21:00", title: "9 PM", line: "A short email: the day on one page." },
  { time: "21:05", title: "Night", line: "Clear the desk: tomorrow, keep, or crumple. Stamped." },
];

/** Small hand-drawn doodles for the margins, in the note tints, very quiet. */
function Doodles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="drift absolute top-10 left-[6%] text-t3" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M28 6c12 0 22 9 21 22-1 12-12 21-24 19C13 45 6 36 7 25 8 14 16 6 28 6" />
      </svg>
      <svg className="drift absolute top-24 right-[7%] text-t4 [animation-delay:-3s]" width="90" height="30" viewBox="0 0 90 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M3 18c8-12 14-12 20 0s12 12 20 0 14-12 20 0 12 12 24-6" />
      </svg>
      <svg className="drift absolute bottom-6 left-[12%] text-t2 [animation-delay:-5s]" width="64" height="48" viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4 22L60 4 40 44 30 28z" />
        <path d="M30 28L60 4" />
      </svg>
      <svg className="drift absolute right-[16%] bottom-10 text-t1 [animation-delay:-7s]" width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M17 4v26M4 17h26" />
      </svg>
    </div>
  );
}

function SectionTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {eyebrow && <span className="font-hand text-[24px] text-mute">{eyebrow}</span>}
      <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] sm:text-[40px]">{children}</h2>
    </div>
  );
}

/** The public homepage: what Pen & Paper is, shown with the real thing. */
export function Home({ supportEmail }: { supportEmail?: string }) {
  const features = FEATURES.filter((f) => f.shipped);
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <nav className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center gap-4 px-4 sm:px-8">
          <Link href="/" aria-label="Pen & Paper home">
            <Logo size="sm" />
          </Link>
          <span className="mx-auto hidden items-center gap-6 text-[15px] text-mute md:flex">
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#pricing" className="hover:text-ink">
              Pricing
            </a>
          </span>
          <span className="ml-auto flex items-center gap-1.5 md:ml-0">
            <ThemeToggle />
            <Link href="/login" className="flex h-11 items-center rounded-xl px-3 text-[15px] font-medium hover:bg-soft">
              Sign in
            </Link>
            <Link href="/signup" className={`${btn.primarySm} h-11 px-4 text-[15px]`}>
              Start writing
            </Link>
          </span>
        </div>
      </nav>

      <main className="flex flex-col">
        {/* Hero */}
        <section className="relative">
          <Doodles />
          <div className="relative mx-auto flex w-full max-w-[1120px] flex-col items-center gap-7 px-4 pt-20 pb-16 text-center sm:px-8 sm:pt-28">
            <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-[72px]">
              Empty your head
              <br />
              <span className="highlight font-hand text-[58px] font-bold tracking-normal sm:text-[92px]">onto paper.</span>
            </h1>
            <p className="max-w-[520px] text-[19px] leading-normal text-mute">Drop every thought in two seconds. Group it, fold it for later, and clear your desk every night.</p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
              <Link href="/signup" className={`${btn.primary} h-[56px] px-7 text-[17px]`}>
                Start writing, it&apos;s free
              </Link>
              <span className="flex items-center gap-1 font-hand text-[22px] text-mute">
                <svg aria-hidden="true" width="44" height="26" viewBox="0 0 44 26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="max-sm:rotate-[100deg]">
                  <path d="M42 14C30 22 16 22 5 12" />
                  <path d="M11 9L4 12l5 7" />
                </svg>
                free, takes 20 seconds
              </span>
            </div>
          </div>
        </section>

        {/* Try it */}
        <section id="try" aria-labelledby="try-title" className="mx-auto flex w-full max-w-[880px] scroll-mt-20 flex-col gap-6 px-4 pb-24 sm:px-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 id="try-title" className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">
              Try it <span className="font-hand text-[38px] font-bold tracking-normal sm:text-[44px]">right here</span>
            </h2>
            <p className="text-mute">No account. Write something, press Enter.</p>
          </div>
          <TryIt />
        </section>

        {/* Features: a notebook margin down the left, one entry per feature */}
        <section id="features" className="mx-auto flex w-full max-w-[1120px] scroll-mt-20 flex-col gap-14 px-4 pb-24 sm:px-8">
          <SectionTitle eyebrow="everything a pen does">Paper, but it keeps up with you</SectionTitle>
          <ol className="relative flex flex-col gap-14 border-l-2 border-dashed border-line pl-6 sm:pl-10">
            {features.map((f, i) => (
              <li key={f.key} className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                <span aria-hidden="true" className="absolute top-1 -left-[35px] flex size-6 items-center justify-center rounded-full border-2 border-line bg-bg font-mono text-[11px] text-mute sm:-left-[51px]">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-2">
                  <span className="font-hand text-[22px] text-red-text">{f.tag}</span>
                  <h3 className="text-[26px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                  <p className="max-w-[420px] text-[17px] text-mute">{f.line}</p>
                </div>
                <div aria-hidden="true">{f.demo}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* A day */}
        <section id="how" className="mx-auto flex w-full max-w-[1120px] scroll-mt-20 flex-col gap-10 px-4 pb-24 sm:px-8">
          <SectionTitle eyebrow="how it works">A day with pen &amp; paper</SectionTitle>
          <div className="relative">
            <svg aria-hidden="true" className="absolute top-1/2 right-6 left-6 hidden h-6 -translate-y-1/2 text-line md:block" preserveAspectRatio="none" viewBox="0 0 1000 24" fill="none">
              <path d="M2 12C120 4 240 20 360 11s240-9 360 2 200 6 276-2" stroke="currentColor" strokeWidth="2" strokeDasharray="8 10" strokeLinecap="round" />
            </svg>
            <ol className="relative grid gap-4 md:grid-cols-4">
              {DAY.map((d, i) => (
                <li key={d.title} style={{ rotate: `${[-1, 1, -0.5, 0.8][i]}deg` }} className="flex flex-col gap-2 rounded-2xl border border-line bg-sheet p-5 shadow-[0_12px_30px_-24px_var(--shadow)]">
                  <span className="font-hand text-[26px] leading-none font-bold text-red-text">{d.time}</span>
                  <span className="text-[17px] font-semibold">{d.title}</span>
                  <span className="text-[15px] text-mute">{d.line}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Everywhere */}
        <section className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 px-4 pb-24 sm:px-8">
          <SectionTitle>Works everywhere you think</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-sheet p-5">
              <div aria-hidden="true" className="dot-grid flex h-36 flex-wrap content-center items-center justify-center gap-2 rounded-2xl bg-bg p-3">
                <ThoughtBubble text="call amma" done={false} shape={0} seed="tile-a" readOnly />
                <ThoughtBubble text="book tickets" done shape={2} seed="tile-b" readOnly />
              </div>
              <span className="font-semibold">In the browser</span>
              <span className="text-[15px] text-mute">Press Space and write. Every action has a key.</span>
            </div>
            <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-sheet p-5">
              <div aria-hidden="true" className="flex h-36 items-center justify-center rounded-2xl bg-bg">
                <div className="flex h-32 w-20 flex-col gap-1.5 rounded-[14px] border-2 border-ink/70 bg-sheet p-1.5">
                  <span className="h-4 rounded-md bg-t1" />
                  <span className="h-4 rounded-md bg-t3" />
                  <span className="h-4 rounded-md bg-t2" />
                  <span className="mx-auto mt-auto h-3 w-8 rounded-full border border-line" />
                </div>
              </div>
              <span className="font-semibold">On your phone</span>
              <span className="text-[15px] text-mute">A calm vertical stream. Add it to your home screen like an app.</span>
            </div>
            <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-sheet p-5">
              <div aria-hidden="true" className="flex h-36 overflow-hidden rounded-2xl">
                <div data-theme="light" className="flex flex-1 items-center justify-center bg-bg text-ink">
                  <ThoughtBubble text="light" done={false} shape={1} seed="tile-l" readOnly />
                </div>
                <div data-theme="dark" className="flex flex-1 items-center justify-center bg-bg text-ink">
                  <ThoughtBubble text="dark" done={false} shape={3} seed="tile-d" readOnly />
                </div>
              </div>
              <span className="font-semibold">Light and dark paper</span>
              <span className="text-[15px] text-mute">Follows your device, or pick one.</span>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto flex w-full max-w-[1120px] scroll-mt-20 flex-col items-center gap-8 px-4 pb-24 sm:px-8">
          <SectionTitle>Pricing</SectionTitle>
          <div className="flex w-full max-w-[440px] -rotate-1 flex-col items-center gap-3 rounded-[24px] border border-line bg-sheet p-8 text-center">
            <span className="font-hand text-[40px] leading-none font-bold">Free</span>
            <span className="text-[17px] font-medium">while in early access</span>
            <span className="text-[15px] text-mute">Everything on this page, no card, no limits we&apos;d have to explain. If that ever changes, you&apos;ll hear it first, in plain words.</span>
          </div>
        </section>

        {/* Final call */}
        <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-6 px-4 pb-24 text-center sm:px-8">
          <span className="text-red-text">
            <PenIcon size={36} />
          </span>
          <p className="font-hand text-[44px] leading-tight font-bold sm:text-[56px]">Your head will thank you.</p>
          <Link href="/signup" className={`${btn.primary} h-[56px] px-8 text-[17px]`}>
            Start writing
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-[14px] text-mute sm:px-8">
          <Logo size="sm" />
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className="hover:text-ink">
              Contact
            </a>
          )}
          <span className="ml-auto">
            Creator:{" "}
            <a href="https://www.linkedin.com/in/yagneshpasam/" target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline-offset-2 hover:underline">
              Yagnesh Pasam
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
