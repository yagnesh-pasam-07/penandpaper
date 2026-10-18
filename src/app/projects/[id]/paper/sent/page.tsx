import { Suspense } from "react";
import { PaperSentScreen } from "@/screens/paper";

export default function Page() {
  return (
    <Suspense>
      <PaperSentScreen />
    </Suspense>
  );
}
