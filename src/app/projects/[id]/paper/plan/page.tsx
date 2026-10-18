import { Suspense } from "react";
import { PaperPlanScreen } from "@/screens/paper";

export default function Page() {
  return (
    <Suspense>
      <PaperPlanScreen />
    </Suspense>
  );
}
