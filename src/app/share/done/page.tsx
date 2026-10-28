import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { paperTitle } from "@/modules/drop/server";
import { SavedClose } from "@/modules/drop/saved-close";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Saved · Pen & Paper", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the browser extension's little window ends up after it saves a note.
 * Only a paper that belongs to the signed-in person is named, from the database;
 * nothing from the address bar is ever shown.
 */
async function Done({ searchParams }: { searchParams: Promise<{ paper?: string | string[] }> }) {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop");
  const { paper } = await searchParams;
  const id = typeof paper === "string" && UUID.test(paper) ? paper : null;
  const found = id ? await paperTitle(user.id, id) : null;
  const name = found ? (found.name?.trim() || "your paper") : null;
  return <SavedClose name={name} href={found && id ? `/drop/${id}` : "/drop"} />;
}

export default function ShareDonePage(props: PageProps<"/share/done">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Done searchParams={props.searchParams} />
    </Suspense>
  );
}
