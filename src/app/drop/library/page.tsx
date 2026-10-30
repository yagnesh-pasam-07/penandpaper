import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppearanceSync } from "@/components/appearance";
import { getAppearance, listPaperCards } from "@/modules/drop/server";
import { LibraryView } from "@/modules/drop/library";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Library · Pen & Paper" };

async function Library({ searchParams }: { searchParams: Promise<{ archived?: string | string[] }> }) {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const { archived } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/drop/library");
  const showArchived = archived === "1";
  const [papers, appearance] = await Promise.all([listPaperCards(user.id, { archived: showArchived }), getAppearance(user.id)]);
  return (
    <>
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} noteFont={appearance.noteFont} />
      <LibraryView key={showArchived ? "archived" : "all"} me={{ name: user.name, email: user.email, admin: user.role === "admin" }} papers={papers} archived={showArchived} />
    </>
  );
}

export default function LibraryPage(props: PageProps<"/drop/library">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Library searchParams={props.searchParams} />
    </Suspense>
  );
}
