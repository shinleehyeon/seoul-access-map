"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DistrictStat } from "@/lib/types";

const COLORS = ["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4", "#cbd5e1"];

/** 저녁 약국 점유율 — 많은 순 (쏠림) */
export function EveningShareChart({ stats }: { stats: DistrictStat[] }) {
  const top = [...stats]
    .filter((d) => d.eveningShare != null)
    .sort((a, b) => (b.eveningShare ?? 0) - (a.eveningShare ?? 0))
    .slice(0, 5)
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      share: Math.round((d.eveningShare ?? 0) * 1000) / 10,
      evening: d.eveningCount,
    }));

  const restShare = Math.max(
    0,
    Math.round((100 - top.reduce((sum, d) => sum + d.share, 0)) * 10) / 10,
  );
  const data = restShare > 0 ? [...top, { sgg: "그 외", share: restShare, evening: 0 }] : top;

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <Pie
            data={data}
            dataKey="share"
            nameKey="sgg"
            innerRadius="45%"
            outerRadius="75%"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.sgg} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            formatter={(v, _n, item) => {
              const row = item?.payload as { evening?: number } | undefined;
              return [`${v}%${row?.evening ? ` (${row.evening}곳)` : ""}`, "시 전체 저녁 약국 점유"];
            }}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => (value === "그 외" ? value : `${value}구`)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
