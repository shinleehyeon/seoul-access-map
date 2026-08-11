"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CrimeCctvStat } from "@/lib/types";

const COLORS = {
  bike: "#eab308",
  child: "#f97316",
  elderly: "#a855f7",
};

/** 다발지점 유형 비중 — 자치구 선택 시 해당 구, 아니면 시 전체 */
export function HotspotShareChart({
  stats,
  highlightSgg,
}: {
  stats: CrimeCctvStat[];
  highlightSgg?: string;
}) {
  const scoped = highlightSgg ? stats.filter((d) => d.sgg === highlightSgg) : stats;
  const bike = scoped.reduce((s, d) => s + d.bikeHotspotCount, 0);
  const child = scoped.reduce((s, d) => s + d.childHotspotCount, 0);
  const elderly = scoped.reduce((s, d) => s + d.elderlyHotspotCount, 0);
  const total = bike + child + elderly;

  const data = [
    { key: "bike", name: "자전거", value: bike, fill: COLORS.bike },
    { key: "child", name: "어린이", value: child, fill: COLORS.child },
    { key: "elderly", name: "노인", value: elderly, fill: COLORS.elderly },
  ].filter((d) => d.value > 0);

  if (data.length === 0 || total === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="48%"
            outerRadius="78%"
            paddingAngle={3}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            formatter={(v, name) => {
              const n = Number(v);
              const pct = total ? ((n / total) * 100).toFixed(1) : "0";
              return [`${n.toLocaleString()}곳 (${pct}%)`, String(name)];
            }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
