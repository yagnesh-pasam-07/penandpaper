import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getToday, stackHintPending } from "@/modules/drop/server";
import { DropCanvas } from "@/modules/drop/ui";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Today · Pen & Paper" };

async function Today() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop");
  const [paper, stackHint] = await Promise.all([getToday(user.id), stackHintPending(user.id)]);
  return <DropCanvas initial={paper} me={{ name: user.name, email: user.email }} stackHint={stackHint} />;
}

export default function DropPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Today />
    </Suspense>
  );
}
