"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import type { DistrictStat } from "@/lib/types";
import { gapFill } from "@/lib/color";

export function GapBarChart({ stats }: { stats: DistrictStat[] }) {
  const data = [...stats]
    .sort((a, b) => b.gapScore - a.gapScore)
    .slice(0, 10)
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      gapScore: d.gapScore,
      uncovered: Math.round(d.uncoveredShare * 100),
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
          <YAxis fontSize={11} tickLine={false} width={32} />
          <Tooltip
            isAnimationActive={false}
            formatter={(v, name) => {
              if (name === "gapScore") return [`${v}`, "공백 점수"];
              return [v, name];
            }}
            labelFormatter={(l) => `${l}구`}
          />
          <Bar dataKey="gapScore" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.sgg} fill={gapFill(d.gapScore)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
