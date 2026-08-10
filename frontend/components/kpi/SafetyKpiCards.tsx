import { Card } from "@/components/ui/card";
import type { CrimeCctvStat } from "@/lib/types";

export function SafetyKpiCards({ stats }: { stats: CrimeCctvStat[] }) {
  const bikeAcc = stats.reduce((s, d) => s + d.bikeAccidentCount, 0);
  const bikeKm = Math.round(stats.reduce((s, d) => s + d.bikeRoadKm, 0));
  const hotspots = stats.reduce((s, d) => s + d.accidentCount, 0);
  const childZones = stats.reduce((s, d) => s + d.childZoneCount, 0);
  const worst = [...stats].sort((a, b) => b.gapScore - a.gapScore)[0];

  const cards = [
    {
      label: "자전거 사고",
      value: bikeAcc.toLocaleString(),
      unit: "건",
      caption: "자치구 합계 · 발생 건수",
    },
    {
      label: "자전거전용도로",
      value: bikeKm.toLocaleString(),
      unit: "km",
      caption: "OSM 기준 시 전체",
    },
    {
      label: "교통사고 다발지점",
      value: hotspots.toLocaleString(),
      unit: "곳",
      caption: "자전거·어린이·노인 합",
    },
    {
      label: "어린이보호구역",
      value: childZones.toLocaleString(),
      unit: "곳",
      caption: "시 전체 지정 구역",
    },
    {
      label: "종합 위험 1위",
      value: worst?.sgg ?? "—",
      unit: "",
      caption: worst ? `위험점수 ${worst.gapScore}` : "데이터 없음",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((m) => (
        <Card key={m.label} className="rounded-2xl border p-4 shadow-none">
          <p className="text-muted-foreground text-xs font-medium tracking-wide">{m.label}</p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight md:text-3xl">{m.value}</span>
            {m.unit ? <span className="text-muted-foreground text-sm">{m.unit}</span> : null}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{m.caption}</p>
        </Card>
      ))}
    </div>
  );
}
