"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CrimeCctvStat } from "@/lib/types";
import { gapFill } from "@/lib/color";

/** 자전거도로 1km당 사고 — 인프라 대비 밀도가 높은 구 */
export function BikePerKmChart({
  stats,
  highlightSgg,
}: {
  stats: CrimeCctvStat[];
  highlightSgg?: string;
}) {
  const ranked = [...stats]
    .filter((d) => d.bikeRoadKm > 0)
    .sort((a, b) => b.bikeAccidentPerRoadKm - a.bikeAccidentPerRoadKm);
  const top10 = ranked.slice(0, 10);
  const highlighted = ranked.find((d) => d.sgg === highlightSgg);
  const rows = highlighted && !top10.includes(highlighted) ? [...top10.slice(0, 9), highlighted] : top10;

  const data = rows.map((d) => ({
    sgg: d.sgg.replace(/구$/, ""),
    full: d.sgg,
    perKm: d.bikeAccidentPerRoadKm,
    score: d.bikeScore,
    accidents: d.bikeAccidentCount,
    km: d.bikeRoadKm,
  }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <XAxis type="number" fontSize={11} tickLine={false} />
          <YAxis type="category" dataKey="sgg" fontSize={11} tickLine={false} width={36} />
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold">{row.sgg}구</p>
                  <p className="text-muted-foreground mt-1">
                    도로 1km당 {row.perKm}건 · 사고 {row.accidents} · 도로 {row.km}km
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="perKm" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.sgg}
                fill={gapFill(d.score)}
                stroke={d.full === highlightSgg ? "#111827" : "none"}
                strokeWidth={d.full === highlightSgg ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
