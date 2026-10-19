import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClearDesk } from "@/modules/drop/clear";
import { getToday } from "@/modules/drop/server";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Clear desk · Pen & Paper" };

async function Desk() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop/clear");
  const paper = await getToday(user.id);
  return <ClearDesk initial={paper} me={{ name: user.name, email: user.email }} />;
}

export default function ClearDeskPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Desk />
    </Suspense>
  );
}
