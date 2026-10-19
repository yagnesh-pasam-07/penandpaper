"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Hydrated } from "@/components/hydration";
import { SignInPanel, safeNext } from "@/components/sign-in";
import { PenIcon } from "@/components/icons";
import { btn } from "@/components/ui";
import { useStore } from "@/lib/store";

/** 1.2 Sign up, and its twin, Log in. Both create the account on first use. */
export function SignUpScreen() {
  return (
    <Hydrated>
      <AuthPage mode="signup" />
    </Hydrated>
  );
}

export function LogInScreen() {
  return (
    <Hydrated>
      <AuthPage mode="login" />
    </Hydrated>
  );
}

const COPY = {
  signup: {
    title: "Grab a fresh sheet",
    lead: "Create your account and drop your first thought in seconds.",
    switchText: "Already have an account?",
    switchCta: "Log in",
    switchHref: "/login",
  },
  login: {
    title: "Welcome back",
    lead: "Log in to pick up today's paper.",
    switchText: "New to Pen & Paper?",
    switchCta: "Create an account",
    switchHref: "/signup",
  },
} as const;

function AuthPage({ mode }: { mode: "signup" | "login" }) {
  const lead = useStore((s) => s.lead);
  const nextParam = useSearchParams().get("next");
  const next = safeNext(nextParam, "/drop");
  const copy = COPY[mode];
  const switchHref = nextParam ? `${copy.switchHref}?next=${encodeURIComponent(next)}` : copy.switchHref;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[400px] flex-col gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <Link href="/" aria-label="Pen & Paper home" className="text-red-text">
            <PenIcon size={36} />
          </Link>
          <h1 className="text-[32px] font-semibold tracking-[-0.02em]">{lead ? "You're signed in" : copy.title}</h1>
          <p className="text-base text-mute">{lead ? `As ${lead.email}.` : copy.lead}</p>
        </div>

        {lead ? (
          <Link href={next} className={btn.primary}>
            Continue
          </Link>
        ) : (
          <>
            <SignInPanel key={mode} next={next} mode={mode} />
            <p className="text-center text-[15px] text-mute">
              {copy.switchText}{" "}
              <Link href={switchHref} className="font-semibold text-ink underline-offset-2 hover:underline">
                {copy.switchCta}
              </Link>
            </p>
          </>
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
