import { Suspense } from "react";
import { LandingScreen } from "@/screens/start";

export default function Page() {
  return (
    <Suspense>
      <LandingScreen />
    </Suspense>
  );
}
