import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CrimeCctvStat } from "@/lib/types";

const RANK_STYLES = [
  "bg-black text-white",
  "bg-gray-800 text-white",
  "bg-gray-600 text-white",
  "bg-gray-200 text-gray-700",
  "bg-gray-200 text-gray-700",
];

export function SafetyRankingList({ stats, limit = 5 }: { stats: CrimeCctvStat[]; limit?: number }) {
  const ranked = [...stats].sort((a, b) => b.gapScore - a.gapScore).slice(0, limit);
  const max = Math.max(...ranked.map((r) => r.gapScore), 1);

  return (
    <Card className="rounded-2xl border shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="size-5 text-gray-900" />
          종합 위험 Top {limit}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-gray-100">
        {ranked.map((r, i) => {
          const widthPct = Math.max(8, (r.gapScore / max) * 100);
          return (
            <a
              key={r.sgg}
              href="/map"
              className="flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  RANK_STYLES[i] ?? "bg-gray-200 text-gray-700"
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-gray-900">{r.sgg}</span>
                <span className="mt-1 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-gray-100">
                  <span className="block h-full rounded-full bg-gray-900" style={{ width: `${widthPct}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-lg font-bold text-gray-900">{r.gapScore}</span>
                <span className="text-muted-foreground text-xs">자전거 {r.bikeScore}</span>
              </span>
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}
