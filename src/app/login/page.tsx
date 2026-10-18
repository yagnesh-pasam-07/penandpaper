import type { Metadata } from "next";
import { Suspense } from "react";
import { LogInScreen } from "@/screens/start";

export const metadata: Metadata = { title: "Log in · Pen & Paper" };

export default function Page() {
  return (
    <Suspense>
      <LogInScreen />
    </Suspense>
  );
}
