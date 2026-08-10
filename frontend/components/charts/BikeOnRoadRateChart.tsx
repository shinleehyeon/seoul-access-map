"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CrimeCctvStat } from "@/lib/types";

/** 자전거사고 다발지점 중 전용도로 50m 이내에서 발생한 비율 — 높을수록 도로 설계 문제,
 * 낮을수록 인프라 부재 문제로 원인을 구분한다. */
export function BikeOnRoadRateChart({ stats }: { stats: CrimeCctvStat[] }) {
  const data = [...stats]
    .filter((d) => d.bikeOnRoadRate != null && (d.bikeOnRoadSample ?? 0) > 0)
    .sort((a, b) => (b.bikeOnRoadRate ?? 0) - (a.bikeOnRoadRate ?? 0))
    .map((d) => ({
      sgg: d.sgg.replace(/구$/, ""),
      rate: d.bikeOnRoadRate ?? 0,
      sample: d.bikeOnRoadSample ?? 0,
    }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} fontSize={11} tickLine={false} unit="%" />
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
                    전용도로 위/근처 {row.rate}% (표본 {row.sample}곳)
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="rate" radius={[0, 6, 6, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.sgg}
                fill={d.rate >= 50 ? "#f97316" : "#38bdf8"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
