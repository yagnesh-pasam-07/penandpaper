import { Suspense } from "react";
import { SignUpScreen } from "@/screens/start";

export default function Page() {
  return (
    <Suspense>
      <SignUpScreen />
    </Suspense>
  );
}
