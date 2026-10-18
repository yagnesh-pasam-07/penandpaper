import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getToday } from "@/modules/drop/server";
import { DropCanvas } from "@/modules/drop/ui";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Today · Pen & Paper" };

async function Today() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/signup?next=/drop");
  const paper = await getToday(user.id);
  return <DropCanvas initial={paper} me={{ name: user.name, email: user.email }} />;
}

export default function DropPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Today />
    </Suspense>
  );
}
