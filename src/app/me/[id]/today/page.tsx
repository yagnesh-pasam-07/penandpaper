import { Suspense } from "react";
import { TodayScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <TodayScreen />
    </Suspense>
  );
}
