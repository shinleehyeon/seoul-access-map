import { Card } from "@/components/ui/card";
import type { Summary } from "@/lib/types";

export function InsightCards({ summary }: { summary: Summary | null }) {
  const top3 = summary?.eveningTop3 ?? [];
  const top3Label = top3.map((d) => d.sgg.replace(/구$/, "")).join("·") || "—";

  const cards = [
    {
      title: "주말·공휴일 심야",
      value: summary?.weekendLateCount != null ? summary.weekendLateCount.toLocaleString() : "—",
      unit: "곳",
      body:
        summary?.lowestWeekendLate != null
          ? `인구 대비 가장 적은 구: ${summary.lowestWeekendLate.sgg} (${summary.lowestWeekendLate.weekendLatePer10k}/만명)`
          : "토·일·공휴일 마감 22시+ 약국",
    },
    {
      title: "저녁 약국 쏠림",
      value:
        summary?.eveningTop3Share != null
          ? `${(summary.eveningTop3Share * 100).toFixed(1)}`
          : "—",
      unit: "%",
      body: `상위 3개 구(${top3Label})가 시 전체 저녁 약국의 이만큼을 차지`,
    },
    {
      title: "생활인구 괴리",
      value: summary?.highestLivingRatio != null ? String(summary.highestLivingRatio.ratio) : "—",
      unit: "배",
      body:
        summary?.highestLivingRatio != null
          ? `${summary.highestLivingRatio.sgg}: 주민 대비 저녁 생활인구 ${summary.highestLivingRatio.ratio}배 · 저녁약국 ${summary.highestLivingRatio.eveningCount}곳`
          : "저녁 생활인구 ÷ 주민등록",
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
