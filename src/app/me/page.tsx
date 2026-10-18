import { Suspense } from "react";
import { MyProjectsScreen } from "@/screens/member";

export default function Page() {
  return (
    <Suspense>
      <MyProjectsScreen />
    </Suspense>
  );
}
