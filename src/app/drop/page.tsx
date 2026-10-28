import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { latestPaperId } from "@/modules/drop/server";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Pen & Paper" };

/** Opens the paper touched last (a first blank one if there are none yet). */
async function Latest(): Promise<null> {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop");
  redirect(`/drop/${await latestPaperId(user.id)}`);
}

export default function DropPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Latest />
    </Suspense>
  );
}
