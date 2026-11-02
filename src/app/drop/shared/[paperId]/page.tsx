import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { getPaper } from "@/modules/drop/server";
import { paperSharedWith } from "@/modules/drop/share-server";
import { SharedView } from "@/modules/drop/shared-view";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "A shared paper · Pen & Paper", robots: { index: false, follow: false } };

async function Shared({ params }: { params: Promise<{ paperId: string }> }) {
  await connection();
  const { paperId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/drop/shared/${paperId}`)}`);
  if (!z.uuid().safeParse(paperId).success) notFound();
  // The owner opening their own invite link goes to the editor.
  if (await getPaper(user.id, paperId)) redirect(`/drop/${paperId}`);
  // Only the email it was shared with, signed in: checked on every request.
  const paper = await paperSharedWith(user.email, paperId);
  if (!paper) notFound();
  return <SharedView paper={paper} signedIn />;
}

export default function SharedPaperPage(props: PageProps<"/drop/shared/[paperId]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Shared params={props.params} />
    </Suspense>
  );
}
