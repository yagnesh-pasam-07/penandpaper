import { Suspense } from "react";
import { LiveScreen } from "@/screens/live";

export default function Page() {
  return (
    <Suspense>
      <LiveScreen />
    </Suspense>
  );
}
