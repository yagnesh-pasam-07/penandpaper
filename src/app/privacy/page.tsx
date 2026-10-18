import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy · Pen & Paper" };

async function Contact() {
  await connection();
  const email = process.env.SUPPORT_EMAIL;
  if (!email) return null;
  return (
    <p>
      Questions, or want your data deleted? Email <a href={`mailto:${email}`} className="underline underline-offset-2">{email}</a>.
    </p>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-[720px] px-4 pt-6 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 pt-10 pb-20 text-[16px] leading-relaxed text-mute sm:px-8 [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-ink">Privacy</h1>
        <p>Pen &amp; Paper keeps only what it needs to plan your team&apos;s day.</p>
        <h2>What we store</h2>
        <ul className="list-disc pl-5">
          <li>Your name and email, from Google or the email you sign in with.</li>
          <li>Projects, papers and tasks you create, and who they&apos;re handed to.</li>
          <li>Teammates&apos; names, emails, time zones, working hours and leave days, as entered by their lead or by them.</li>
          <li>When tasks were struck, time requests and the reasons people give at day end.</li>
        </ul>
        <h2>Who sees it</h2>
        <p>
          A project&apos;s lead sees everything in that project. Members see their own paper, their teammates&apos; names and progress, but not
          their email addresses. Nobody outside a project can see it.
        </p>
        <h2>Email</h2>
        <p>We email you only for sign-in links, invites from your lead, and your daily paper. No marketing.</p>
        <h2>Where it lives</h2>
        <p>Data is stored in Postgres on Neon and the app runs on Vercel. Emails are sent through Resend. Sign-in uses a secure cookie.</p>
        <Suspense>
          <Contact />
        </Suspense>
      </main>
    </div>
  );
}
