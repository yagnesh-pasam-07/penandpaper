import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { latestPaperId } from "@/modules/drop/server";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Pen & Paper" };

/** Opens the paper touched last (a first blank one if there are none yet). */
async function Latest({ searchParams }: { searchParams: Promise<{ write?: string | string[] }> }): Promise<null> {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const { write } = await searchParams;
  // ?write=1 (the "New thought" shortcut) opens the writer on arrival.
  const suffix = write === "1" ? "?write=1" : "";
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/drop${suffix}`)}`);
  redirect(`/drop/${await latestPaperId(user.id)}${suffix}`);
}

export default function DropPage(props: PageProps<"/drop">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Latest searchParams={props.searchParams} />
    </Suspense>
  );
}
