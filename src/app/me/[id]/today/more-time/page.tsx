import { Suspense } from "react";
import { MoreTimeScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <MoreTimeScreen />
    </Suspense>
  );
}
