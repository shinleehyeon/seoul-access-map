import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function MapPage() {
  return (
    <div className="h-full min-h-0">
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
