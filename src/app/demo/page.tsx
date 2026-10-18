import { Suspense } from "react";
import { DemoScreen } from "@/screens/demo";

export default function Page() {
  return (
    <Suspense>
      <DemoScreen />
    </Suspense>
  );
}
