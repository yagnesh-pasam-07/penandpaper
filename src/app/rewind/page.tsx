import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppearanceSync } from "@/components/appearance";
import { rewindWeek } from "@/modules/drop/resurface-server";
import { RewindView } from "@/modules/drop/rewind-view";
import { dropZone, getAppearance } from "@/modules/drop/server";
import { localDate, resolveTz, TZ_COOKIE } from "@/modules/drop/tonight";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Rewind · Pen & Paper", robots: { index: false } };

/** The weekly rewind: Monday to today, grouped by paper. Linked from Sunday's evening email. */
async function Rewind() {
  // Needs the live request (session cookie, time zone cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/rewind");
  const tz = resolveTz((await cookies()).get(TZ_COOKIE)?.value, dropZone());
  const [week, appearance] = await Promise.all([rewindWeek(user.id, tz, localDate(tz)), getAppearance(user.id)]);
  return (
    <>
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} noteFont={appearance.noteFont} />
      <RewindView me={{ name: user.name, email: user.email, admin: user.role === "admin" }} from={week.from} to={week.to} groups={week.groups} />
    </>
  );
}

export default function RewindPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Rewind />
    </Suspense>
  );
}
