import { Suspense } from "react";
import { NotifyScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <NotifyScreen />
    </Suspense>
  );
}
