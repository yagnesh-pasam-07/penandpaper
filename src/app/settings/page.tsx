import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAppearance } from "@/modules/drop/server";
import { SettingsView } from "@/modules/drop/settings";
import { currentUser } from "@/server/session";

export const metadata: Metadata = { title: "Settings · Pen & Paper" };

async function Settings() {
  // Needs the live request (session cookie); never part of a prerender.
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");
  const appearance = await getAppearance(user.id);
  return <SettingsView me={{ name: user.name, email: user.email, admin: user.role === "admin" }} appearance={appearance} />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" aria-busy="true" />}>
      <Settings />
    </Suspense>
  );
}
