import { Suspense } from "react";
import { PaperStartScreen } from "@/screens/paper";

export default function Page() {
  return (
    <Suspense>
      <PaperStartScreen />
    </Suspense>
  );
}
