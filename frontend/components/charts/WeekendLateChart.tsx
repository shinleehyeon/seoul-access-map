"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { DistrictStat } from "@/lib/types";

/** 인구 1만명당 주말·공휴일 22시+ 약국 — 적은 순 */
export function WeekendLateChart({ stats }: { stats: DistrictStat[] }) {
  const data = [...stats]
    .filter((d) => d.weekendLatePer10k != null)
    .sort((a, b) => (a.weekendLatePer10k ?? 0) - (b.weekendLatePer10k ?? 0))
    .slice(0, 6)
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      value: d.weekendLatePer10k ?? 0,
      count: d.weekendLateCount ?? 0,
    }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
          <XAxis dataKey="sgg" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            formatter={(v, _n, item) => {
              const count = (item?.payload as { count?: number } | undefined)?.count ?? 0;
              return [`${v} (총 ${count}곳)`, "1만명당 주말·공휴일 심야"];
            }}
            labelFormatter={(l) => `${l}구`}
          />
          <Bar dataKey="value" fill="#111827" radius={[10, 10, 10, 10]} maxBarSize={48} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
