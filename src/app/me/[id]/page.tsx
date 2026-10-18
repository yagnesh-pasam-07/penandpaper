import { Suspense } from "react";
import { PapersScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <PapersScreen />
    </Suspense>
  );
}
