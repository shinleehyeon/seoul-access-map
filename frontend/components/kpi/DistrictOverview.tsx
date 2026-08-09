import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gapFill } from "@/lib/color";
import type { DistrictStat } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DistrictOverview({ stats }: { stats: DistrictStat[] }) {
  const ranked = [...stats].sort((a, b) => b.gapScore - a.gapScore);

  return (
    <Card className="rounded-2xl border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">자치구 한눈에 보기</CardTitle>
        <CardDescription>
          공백 점수 높은 순 · 주말심야(괄호=1만명당) · 생활/주민 · 저녁 점유율
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="py-2 pr-2 font-medium">순위</th>
              <th className="py-2 pr-2 font-medium">자치구</th>
              <th className="py-2 pr-2 font-medium">공백 점수</th>
              <th className="py-2 pr-2 font-medium">공백 비중</th>
              <th className="py-2 pr-2 font-medium">주말심야</th>
              <th className="py-2 pr-2 font-medium">생활/주민</th>
              <th className="py-2 pr-2 font-medium">저녁 약국</th>
              <th className="py-2 font-medium">점유</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => (
              <tr key={d.sgg} className="border-b border-gray-100 last:border-0">
                <td className="text-muted-foreground py-2.5 pr-2 tabular-nums">{i + 1}</td>
                <td className="py-2.5 pr-2 font-medium">
                  <a href="/map" className="hover:underline">
                    {d.sgg}
                  </a>
                </td>
                <td className="py-2.5 pr-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: gapFill(d.gapScore) }}
                    />
                    <span className="tabular-nums font-semibold">{d.gapScore}</span>
                  </span>
                </td>
                <td className="py-2.5 pr-2 tabular-nums">
                  {(d.uncoveredShare * 100).toFixed(1)}%
                </td>
                <td className="py-2.5 pr-2 tabular-nums">
                  {d.weekendLateCount ?? "—"}
                  <span className="text-muted-foreground text-xs">
                    {d.weekendLatePer10k != null ? ` (${d.weekendLatePer10k})` : ""}
                  </span>
                </td>
                <td
                  className={cn(
                    "py-2.5 pr-2 tabular-nums",
                    (d.livingPopRatio ?? 0) >= 1.3 && "font-medium text-amber-800"
                  )}
                >
                  {d.livingPopRatio != null ? `${d.livingPopRatio}` : "—"}
                </td>
                <td className="py-2.5 pr-2 tabular-nums">
                  {d.eveningCount}
                  <span className="text-muted-foreground"> / {d.pharmacyCount}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  {d.eveningShare != null ? `${(d.eveningShare * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
