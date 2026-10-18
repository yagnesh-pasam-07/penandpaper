import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getPaper } from "@/modules/drop/server";
import { HistoryPaper } from "@/modules/drop/ui";
import { currentUser } from "@/server/session";

async function Paper({ params }: { params: Promise<{ date: string }> }) {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const { date } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/drop/history/${date}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const paper = await getPaper(user.id, date);
  if (!paper) notFound();
  return <HistoryPaper me={{ name: user.name, email: user.email }} paper={paper} />;
}

export default function PastPaperPage(props: PageProps<"/drop/history/[date]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Paper params={props.params} />
    </Suspense>
  );
}
