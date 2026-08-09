"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DistrictStat } from "@/lib/types";

export function EveningPerPopChart({ stats }: { stats: DistrictStat[] }) {
  const data = [...stats]
    .sort((a, b) => a.eveningPer10k - b.eveningPer10k)
    .slice(0, 10)
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      value: d.eveningPer10k,
      evening: d.eveningCount,
    }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="sgg" fontSize={11} tickLine={false} />
          <YAxis fontSize={11} tickLine={false} width={36} />
          <Tooltip
            isAnimationActive={false}
            formatter={(v) => [`${v}`, "인구 1만명당 저녁약국"]}
            labelFormatter={(l) => `${l}구`}
          />
          <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
