import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { studioAdmin, studioConfigured, studioOpen } from "@/modules/studio/gate";
import { currentUser, type User } from "@/server/session";

/**
 * The stories pages in Studio: the admin role, then the passcode (typed on
 * /studio). Anyone else finds nothing here. Returns the writer, or a page to show.
 */
export async function writerOrPage(next: string): Promise<User | ReactNode> {
  const admin = await studioAdmin();
  if (!admin) {
    if (!(await currentUser())) redirect(`/login?next=${encodeURIComponent(next)}`);
    notFound();
  }
  if (!studioConfigured() || !(await studioOpen(admin.id))) redirect("/studio");
  return admin;
}
