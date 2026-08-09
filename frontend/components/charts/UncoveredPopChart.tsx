"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DistrictStat } from "@/lib/types";

const COLORS = ["#be123c", "#e11d48", "#fb7185", "#fda4af", "#fecdd3", "#cbd5e1"];

/** 공백 인구가 많은 구 — 도보 10분 밖 생활인구 추정, 상위 */
export function UncoveredPopChart({ stats }: { stats: DistrictStat[] }) {
  const top = [...stats]
    .filter((d) => d.estUncoveredPop != null)
    .sort((a, b) => b.estUncoveredPop - a.estUncoveredPop)
    .slice(0, 5)
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      pop: Math.round(d.estUncoveredPop / 1000),
      raw: d.estUncoveredPop,
      share: Math.round(d.uncoveredShare * 100),
    }));

  const totalRaw = stats.reduce((sum, d) => sum + (d.estUncoveredPop ?? 0), 0);
  const restRaw = Math.max(0, totalRaw - top.reduce((sum, d) => sum + d.raw, 0));
  const restPop = Math.round(restRaw / 1000);
  const data = restPop > 0 ? [...top, { sgg: "그 외", pop: restPop, raw: restRaw, share: 0 }] : top;

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <Pie
            data={data}
            dataKey="pop"
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
            formatter={(_v, _n, item) => {
              const row = item?.payload as { raw?: number; share?: number } | undefined;
              if (!row) return ["—", "공백 인구"];
              const shareText = row.share ? ` (${row.share}%)` : "";
              return [`${row.raw?.toLocaleString()}명${shareText}`, "공백 인구"];
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
