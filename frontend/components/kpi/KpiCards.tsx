import { Card } from "@/components/ui/card";
import type { Summary } from "@/lib/types";

export function KpiCards({ summary }: { summary: Summary | null }) {
  const cards = [
    {
      label: "전체 약국",
      value: summary ? summary.pharmacyCount.toLocaleString() : "—",
      unit: "곳",
      caption: summary
        ? `저녁 ${summary.eveningCount.toLocaleString()} · 심야 ${summary.lateNightCount.toLocaleString()}`
        : "데이터 없음",
    },
    {
      label: "저녁 약국 (21시+)",
      value: summary ? summary.eveningCount.toLocaleString() : "—",
      unit: "곳",
      caption: "평일 마감 21시 이후",
    },
    {
      label: "평균 공백 비중",
      value: summary ? (summary.avgUncoveredShare * 100).toFixed(1) : "—",
      unit: "%",
      caption: `도보 약 10분(${summary?.walkMeters ?? 800}m) 밖 생활인구`,
    },
    {
      label: "공백 최다 구",
      value: summary?.worst.sgg ?? "—",
      unit: "",
      caption: summary
        ? `점수 ${summary.worst.gapScore} · 약 ${Math.round(summary.worst.estUncoveredPop / 1000)}천명`
        : "데이터 없음",
    },
    {
      label: "공백 최소 구",
      value: summary?.best.sgg ?? "—",
      unit: "",
      caption: summary
        ? `점수 ${summary.best.gapScore} · 공백 ${(summary.best.uncoveredShare * 100).toFixed(0)}%`
        : "데이터 없음",
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
