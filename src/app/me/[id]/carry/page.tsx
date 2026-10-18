import { Suspense } from "react";
import { CarryScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <CarryScreen />
    </Suspense>
  );
}
