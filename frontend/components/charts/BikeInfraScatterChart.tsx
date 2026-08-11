"use client";

import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CrimeCctvStat } from "@/lib/types";
import { gapFill } from "@/lib/color";

/** 자전거도로 길이 vs 사고 건수 — 점 크기·색은 bikeScore */
export function BikeInfraScatterChart({
  stats,
  highlightSgg,
}: {
  stats: CrimeCctvStat[];
  highlightSgg?: string;
}) {
  const data = stats.map((d) => ({
    sgg: d.sgg.replace(/구$/, ""),
    full: d.sgg,
    x: d.bikeRoadKm,
    y: d.bikeAccidentCount,
    score: d.bikeScore,
    perKm: d.bikeAccidentPerRoadKm,
  }));

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 부족합니다.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            name="도로"
            unit="km"
            fontSize={11}
            tickLine={false}
            label={{ value: "자전거도로(km)", position: "insideBottom", offset: -4, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="사고"
            unit="건"
            fontSize={11}
            tickLine={false}
            width={40}
          />
          <ZAxis type="number" dataKey="score" range={[50, 280]} />
          <Tooltip
            isAnimationActive={false}
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold">{row.full}</p>
                  <p className="text-muted-foreground mt-1">
                    도로 {row.x}km · 사고 {row.y}건
                  </p>
                  <p className="text-muted-foreground">
                    도로 1km당 {row.perKm} · 위험점수 {row.score}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={data} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.full}
                fill={gapFill(d.score)}
                stroke={d.full === highlightSgg ? "#111827" : "none"}
                strokeWidth={d.full === highlightSgg ? 2 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
