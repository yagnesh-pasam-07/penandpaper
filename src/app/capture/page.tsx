import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { QuickCapture } from "@/modules/drop/quick-capture";
import { captureTarget } from "@/modules/drop/server";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Quick thought · Pen & Paper", robots: { index: false } };

/** One box to type a thought into, for the browser extension's shortcut and the installed app's "Quick thought". */
async function Capture() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/capture");
  const target = await captureTarget(user.id);
  return <QuickCapture paperName={target.paperName?.trim() || null} />;
}

export default function CapturePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Capture />
    </Suspense>
  );
}
