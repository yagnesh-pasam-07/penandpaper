import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { listHistory } from "@/modules/drop/server";
import { HistoryList } from "@/modules/drop/ui";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Past papers · Pen & Paper" };

async function History() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop/history");
  return <HistoryList me={{ name: user.name, email: user.email }} papers={await listHistory(user.id)} />;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <History />
    </Suspense>
  );
}
