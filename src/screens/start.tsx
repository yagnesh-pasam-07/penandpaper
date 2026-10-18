"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hydrated } from "@/components/hydration";
import { SignInPanel, safeNext } from "@/components/sign-in";
import { PenIcon, SquiggleArrow } from "@/components/icons";
import { Avatar, LeadHeader, Logo, ProgressBar, btn } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Tint } from "@/lib/types";

/** The hero picture: a morning's loose thoughts, then the team's papers. */
const HERO_THOUGHTS: { text: string; tint: string; radius: string; rotate: number }[] = [
  { text: "login bug", tint: "bg-t1", radius: "58% 42% 55% 45% / 50% 58% 42% 50%", rotate: -4 },
  { text: "leave API", tint: "bg-t2", radius: "999px", rotate: 3 },
  { text: "holiday list", tint: "bg-t3", radius: "20px", rotate: -2 },
  { text: "QA export", tint: "bg-t5", radius: "999px 999px 20px 20px", rotate: 4 },
  { text: "notify manager", tint: "bg-t4", radius: "40% 60% 35% 65% / 60% 40% 60% 40%", rotate: -3 },
  { text: "calendar view", tint: "bg-t1", radius: "50%", rotate: 2 },
];

const HERO_TEAM: { name: string; tint: Tint; hours: string; pct: number; tasks: { title: string; done: boolean }[] }[] = [
  { name: "Asha", tint: "t4", hours: "6 / 8h", pct: 70, tasks: [{ title: "Login bug", done: true }, { title: "Leave API", done: false }] },
  { name: "Dev", tint: "t3", hours: "5 / 6h", pct: 30, tasks: [{ title: "Holiday list", done: false }, { title: "QA export", done: false }] },
  { name: "Meera", tint: "t2", hours: "7 / 8h", pct: 100, tasks: [{ title: "Notify manager", done: true }, { title: "Calendar view", done: true }] },
];

/** 1.1 Landing */
export function LandingScreen() {
  return (
    <Hydrated>
      <Landing />
    </Hydrated>
  );
}

function Landing() {
  const lead = useStore((s) => s.lead);
  const startHref = lead ? "/projects" : "/signup";
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <LeadHeader
        left={<Logo size="lg" />}
        right={
          <Link href={startHref} className="px-1 py-2.5 text-[15px] font-medium">
            {lead ? "Open my projects" : "Log in"}
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col items-center justify-center gap-14 px-4 pt-10 pb-20 text-center sm:px-8">
        <div className="flex flex-col items-center gap-[22px]">
          <h1 className="text-5xl leading-none font-semibold tracking-[-0.035em] sm:text-[72px]">
            Plan the day.
            <br />
            <span className="font-hand text-[64px] font-bold tracking-normal text-red-text sm:text-[88px]">on paper.</span>
          </h1>
          <p className="max-w-[480px] text-[19px] leading-normal text-mute">
            Drop your thoughts, give them a time, hand them to your team. Everyone knows what today looks like.
          </p>
          <Link href={startHref} className={`${btn.primary} h-[54px] px-7 text-[17px]`}>
            Start free
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:flex-nowrap" aria-hidden="true">
          <div className="grid max-w-[360px] shrink-0 grid-cols-[repeat(3,auto)] place-items-center gap-x-2.5 gap-y-3 max-sm:grid-cols-2">
            {HERO_THOUGHTS.map((t) => (
              <span key={t.text} style={{ borderRadius: t.radius, rotate: `${t.rotate}deg` }} className={`${t.tint} px-4 py-3 font-hand text-xl leading-none font-semibold whitespace-nowrap`}>
                {t.text}
              </span>
            ))}
          </div>
          <span className="shrink-0 max-lg:basis-full max-lg:flex max-lg:justify-center max-lg:[&>svg]:rotate-90">
            <SquiggleArrow />
          </span>
          <div className="flex flex-wrap items-start justify-center gap-3 lg:flex-nowrap">
            {HERO_TEAM.map((m, i) => (
              <div
                key={m.name}
                style={{ translate: `0 ${[0, 18, 6][i]}px` }}
                className="flex w-[176px] shrink-0 flex-col gap-2.5 rounded-2xl border border-line bg-sheet p-4 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Avatar name={m.name} tint={m.tint} size={24} />
                  <span className="flex-1">{m.name}</span>
                  <span className="font-mono text-[11px] font-medium text-mute">{m.hours}</span>
                </span>
                <ProgressBar pct={m.pct} tone={m.pct === 100 ? "green" : "ink"} />
                {m.tasks.map((t) => (
                  <span key={t.title} className={`text-sm ${t.done ? "strike text-mute" : ""}`}>
                    {t.title}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="mx-auto flex w-full max-w-[1120px] justify-between px-4 pb-8 text-[13px] text-mute sm:px-8">
        <span>Pen &amp; Paper</span>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </footer>
    </div>
  );
}

/** 1.2 Sign up */
export function SignUpScreen() {
  return (
    <Hydrated>
      <SignUp />
    </Hydrated>
  );
}

function SignUp() {
  const lead = useStore((s) => s.lead);
  const next = safeNext(useSearchParams().get("next"), "/projects");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Link href="/" aria-label="Pen & Paper home" className="text-red-text">
            <PenIcon size={36} />
          </Link>
          <h1 className="text-[32px] font-semibold tracking-[-0.02em]">{lead ? "You're signed in" : "Grab a fresh sheet"}</h1>
          <p className="text-base text-mute">{lead ? `As ${lead.email}.` : "Sign in or create your account to plan your team's day."}</p>
        </div>

        {lead ? (
          <Link href={next} className={btn.primary}>
            Continue
          </Link>
        ) : (
          <SignInPanel next={next} />
        )}

        <p className="text-center text-sm text-mute">
          Got an invite? Open the link in your email, you&apos;ll land right on your paper.
          <br />
          <Link href="/privacy" className="underline underline-offset-2">
            How we handle your data
          </Link>
        </p>
      </div>
    </div>
  );
}
