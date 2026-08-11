"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BikeInsightBucket } from "@/lib/types";
import { CHART, ChartLegend, ChartTooltipShell } from "./chartTheme";

/** 레퍼런스 톤 그레이스케일 */
const PIE_COLORS = ["#27272B", "#52525C", "#D4D4D9"] as const;

export function RoadTypeShareChart({ data }: { data: BikeInsightBucket[] }) {
  const rows = data.map((d) => ({ name: d.key, value: d.n, share: d.share }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="w-full">
      <div className="relative mx-auto h-56 w-full max-w-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
            >
              {rows.map((row, i) => (
                <Cell key={row.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
             
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof rows)[number];
                return (
                  <ChartTooltipShell
                    title={row.name}
                    lines={[`${row.value.toLocaleString()}건 · ${row.share}%`]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold tracking-tight tabular-nums text-[#27272B]">
            {total.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">건</p>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {rows.map((row, i) => (
          <span key={row.name} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            {row.name} {row.share}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoadTypeRiskChart({ data }: { data: BikeInsightBucket[] }) {
  const rows = data.map((d) => ({
    key: d.key,
    fatality: d.fatalityPer1000,
    serious: d.seriousRate,
  }));
  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { color: CHART.accent, label: "치사율 (/1000건)" },
          { color: CHART.count, label: "심각사고율 (%)" },
        ]}
      />
      <div className="h-64 w-full">
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
                    title={row.key}
                    lines={[
                      `치사율 ${row.fatality} /1000건`,
                      `심각사고율 ${row.serious}%`,
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="fatality" name="치사율 (/1000건)" fill={CHART.accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="serious" name="심각사고율 (%)" fill={CHART.count} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
