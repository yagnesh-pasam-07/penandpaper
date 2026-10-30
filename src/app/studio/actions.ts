"use server";

import { redirect } from "next/navigation";
import { closeStudio, openStudio, passcodeMatches, studioAdmin } from "@/modules/studio/gate";
import { allowWithin } from "@/modules/drop/rate";

/** The passcode form: admins only, five wrong tries in ten minutes and it waits. */
export async function enter(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  const admin = await studioAdmin();
  if (!admin) return { error: "Studio is for admins." };
  if (!(await allowWithin(`pp-studio-tries:${admin.id}`, 5, 10 * 60_000))) return { error: "Too many tries. Wait ten minutes." };
  if (!passcodeMatches(String(form.get("code") ?? ""))) return { error: "That's not it." };
  await openStudio(admin.id);
  redirect("/studio");
}

export async function leave(): Promise<void> {
  await closeStudio();
  redirect("/drop");
}
