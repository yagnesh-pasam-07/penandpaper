import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { AppearanceSync } from "@/components/appearance";
import { getAppearance, getPaper, listPapers } from "@/modules/drop/server";
import { DropCanvas } from "@/modules/drop/ui";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Pen & Paper" };

async function Paper({ params, searchParams }: { params: Promise<{ paperId: string }>; searchParams: Promise<{ note?: string | string[] }> }) {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const { paperId } = await params;
  const { note } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/drop/${paperId}`);
  if (!z.uuid().safeParse(paperId).success) notFound();
  const [paper, papers, appearance] = await Promise.all([getPaper(user.id, paperId), listPapers(user.id), getAppearance(user.id)]);
  if (!paper) notFound();
  // The switcher lists papers that are out; the one open is always in it, archived or not.
  const listed = papers.some((p) => p.id === paper.id) ? papers : [{ id: paper.id, name: paper.name, createdAt: paper.createdAt, updatedAt: paper.createdAt, archivedAt: paper.archivedAt, count: paper.thoughts.length }, ...papers];
  return (
    <>
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} />
      <DropCanvas key={paper.id} initial={paper} papers={listed} me={{ name: user.name, email: user.email }} focus={typeof note === "string" ? note : null} />
    </>
  );
}

export default function PaperPage(props: PageProps<"/drop/[paperId]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Paper params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
