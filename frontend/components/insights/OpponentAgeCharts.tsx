"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BikeInsightBucket } from "@/lib/types";
import { CHART, ChartLegend, ChartTooltipShell } from "./chartTheme";

export function OpponentFatalityChart({
  data,
  minN = 50,
}: {
  data: BikeInsightBucket[];
  minN?: number;
}) {
  const rows = [...data]
    .filter((d) => d.n >= minN || d.key === "건설기계")
    .sort((a, b) => b.fatalityPer1000 - a.fatalityPer1000)
    .slice(0, 8)
    .map((d) => ({
      key: d.key,
      fatality: d.fatalityPer1000,
      n: d.n,
      deaths: d.deaths,
      share: d.share,
    }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" fontSize={11} tickLine={false} />
          <YAxis type="category" dataKey="key" fontSize={11} tickLine={false} width={64} />
          <Tooltip
           
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof rows)[number];
              return (
                <ChartTooltipShell
                  title={row.key}
                  lines={[
                    `치사율 ${row.fatality} /1000건`,
                    `${row.n.toLocaleString()}건 · 사망 ${row.deaths} · 비중 ${row.share}%`,
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="fatality" fill={CHART.accent} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgeRiskChart({ data }: { data: BikeInsightBucket[] }) {
  const order = ["20세 이하", "21-30세", "31-40세", "41-50세", "51-60세", "61-64세", "65세 이상"];
  const byKey = new Map(data.map((d) => [d.key, d]));
  const rows = order
    .filter((k) => byKey.has(k))
    .map((k) => {
      const d = byKey.get(k)!;
      return {
        key: k.replace("세 이상", "+").replace("세 이하", "↓").replace("세", ""),
        full: k,
        share: d.share,
        fatality: d.fatalityPer1000,
        n: d.n,
        deaths: d.deaths,
      };
    });

  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { color: CHART.accent, label: "사고 비중 (%)" },
          { color: CHART.count, label: "치사율 (/1000건)" },
        ]}
      />
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="key" fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} width={32} />
            <Tooltip
             
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof rows)[number];
                return (
                  <ChartTooltipShell
                    title={row.full}
                    lines={[
                      `사고 비중 ${row.share}% (${row.n.toLocaleString()}건)`,
                      `치사율 ${row.fatality} /1000건 · 사망 ${row.deaths}`,
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="share" name="사고 비중 (%)" fill={CHART.accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="fatality" name="치사율 (/1000건)" fill={CHART.count} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
