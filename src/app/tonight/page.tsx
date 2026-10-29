import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppearanceSync } from "@/components/appearance";
import { dropZone, getAppearance } from "@/modules/drop/server";
import { resolveTz, TZ_COOKIE } from "@/modules/drop/tonight";
import { TonightReview } from "@/modules/drop/tonight-review";
import { tonightState } from "@/modules/drop/tonight-server";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Tonight's paper · Pen & Paper", robots: { index: false } };

/** The evening review: today's thoughts from every paper, one card at a time. */
async function Tonight() {
  // Needs the live request (session cookie, time zone cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/tonight");
  // The browser sets this cookie to its own time zone; until it has, the Drop zone stands in.
  const tz = resolveTz((await cookies()).get(TZ_COOKIE)?.value, dropZone());
  const [state, appearance] = await Promise.all([tonightState(user.id, tz), getAppearance(user.id)]);
  return (
    <>
      <AppearanceSync canvas={appearance.canvas} theme={appearance.theme} />
      <TonightReview initial={state} serverTz={tz} />
    </>
  );
}

export default function TonightPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Tonight />
    </Suspense>
  );
}
