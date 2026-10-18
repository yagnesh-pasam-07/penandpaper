"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Hydrated } from "@/components/hydration";
import { PenIcon, SquiggleArrow } from "@/components/icons";
import { Avatar, LeadHeader, Logo, ProgressBar, btn } from "@/components/ui";
import { useStore } from "@/lib/store";

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

        <div className="flex flex-wrap items-center justify-center gap-7" aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <span className="-rotate-4 rounded-[58%_42%_55%_45%/50%_58%_42%_50%] bg-t1 px-[18px] py-3.5 font-hand text-[22px] font-semibold">
              login bug
            </span>
            <span className="rotate-3 rounded-full bg-t2 px-[18px] py-3.5 font-hand text-[22px] font-semibold">leave API</span>
          </div>
          <SquiggleArrow />
          <div className="flex w-[220px] flex-col gap-2.5 rounded-2xl border border-line bg-sheet p-4 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Avatar name="Asha" tint="t4" size={24} />
              Asha
            </span>
            <ProgressBar pct={70} />
            <span className="strike text-sm text-mute">Login bug</span>
            <span className="text-sm">Leave API</span>
          </div>
        </div>
      </main>
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignUp() {
  const router = useRouter();
  const signUp = useStore((s) => s.signUp);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const valid = EMAIL.test(email.trim());

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="text-red-text">
            <PenIcon size={36} />
          </span>
          <h1 className="text-[32px] font-semibold tracking-[-0.02em]">Grab a fresh sheet</h1>
          <p className="text-base text-mute">Create your account to plan your team&apos;s day.</p>
        </div>

        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            signUp(email.trim());
            router.push("/projects");
          }}
        >
          <button
            type="button"
            onClick={() => setNote("Google sign-in isn't connected yet. Use your work email for now.")}
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-line bg-sheet text-base font-medium hover:bg-soft"
          >
            <GoogleMark />
            Continue with Google
          </button>
          {note && (
            <p role="status" className="text-center text-sm text-amber">
              {note}
            </p>
          )}
          <div className="flex items-center gap-3 text-[13px] text-mute">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Work email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-[52px] rounded-[14px] border-[1.5px] border-ink bg-sheet px-4 text-base font-normal outline-none placeholder:text-mute"
            />
          </label>
          <button type="submit" disabled={!valid} className={`${btn.primary} disabled:opacity-50`}>
            Continue
          </button>
        </form>

        <p className="text-center text-sm text-mute">Got an invite? Open the link in your email, you&apos;ll land right on your paper.</p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" />
      <path d="M9 5.5v7M5.5 9h7" />
    </svg>
  );
}
