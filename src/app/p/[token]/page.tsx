import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { paperByToken } from "@/modules/drop/share-server";
import { SharedView } from "@/modules/drop/shared-view";
import { currentUser } from "@/server/session";

// A public link is the owner's choice to share, never something to index.
export const metadata: Metadata = { title: "A shared paper · Pen & Paper", robots: { index: false, follow: false } };

async function Shared({ params }: { params: Promise<{ token: string }> }) {
  // Checked on every request: turning the link off works at once.
  await connection();
  const { token } = await params;
  const [paper, user] = await Promise.all([paperByToken(token), currentUser().catch(() => null)]);
  if (!paper) notFound();
  return <SharedView paper={paper} signedIn={!!user} />;
}

export default function PublicPaperPage(props: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Shared params={props.params} />
    </Suspense>
  );
}
