import { Suspense } from "react";
import { DoneScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <DoneScreen />
    </Suspense>
  );
}
