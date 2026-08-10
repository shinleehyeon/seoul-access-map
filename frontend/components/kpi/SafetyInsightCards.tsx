import { Card } from "@/components/ui/card";
import type { CrimeCctvStat } from "@/lib/types";

export function SafetyInsightCards({ stats }: { stats: CrimeCctvStat[] }) {
  const byPerKm = [...stats]
    .filter((d) => d.bikeRoadKm > 0)
    .sort((a, b) => b.bikeAccidentPerRoadKm - a.bikeAccidentPerRoadKm)[0];
  const byChild = [...stats]
    .filter((d) => d.childZoneCount > 0)
    .sort((a, b) => b.childAccidentPerZone - a.childAccidentPerZone)[0];
  const byElderly = [...stats].sort(
    (a, b) => b.elderlyAccidentPer10k - a.elderlyAccidentPer10k
  )[0];

  const cards = [
    {
      title: "도로 대비 자전거 사고",
      value: byPerKm ? String(byPerKm.bikeAccidentPerRoadKm) : "—",
      unit: "/km",
      body: byPerKm
        ? `${byPerKm.sgg}: 도로 ${byPerKm.bikeRoadKm}km에 사고 ${byPerKm.bikeAccidentCount}건`
        : "자전거도로 1km당 사고",
    },
    {
      title: "어린이보호구역 대비",
      value: byChild ? String(byChild.childAccidentPerZone) : "—",
      unit: "/100구역",
      body: byChild
        ? `${byChild.sgg}: 구역 ${byChild.childZoneCount} · 다발 ${byChild.childAccidentCount}`
        : "구역 100곳당 어린이 다발지점",
    },
    {
      title: "인구 대비 노인 보행사고",
      value: byElderly ? String(byElderly.elderlyAccidentPer10k) : "—",
      unit: "/만명",
      body: byElderly
        ? `${byElderly.sgg}: 연간 보행노인 사고 ${byElderly.elderlyAccidentCount}건`
        : "인구 1만명당 보행노인 사고 (보호구역 수가 너무 적어 인구 기준으로 계산)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title} className="rounded-2xl border bg-[#fafafa] p-4 shadow-none">
          <p className="text-muted-foreground text-xs font-medium tracking-wide">{c.title}</p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight md:text-3xl">{c.value}</span>
            <span className="text-muted-foreground text-sm">{c.unit}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">{c.body}</p>
        </Card>
      ))}
    </div>
  );
}
