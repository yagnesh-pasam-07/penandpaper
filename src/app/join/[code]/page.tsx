import { Suspense } from "react";
import { JoinScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <JoinScreen />
    </Suspense>
  );
}
