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

const PIE_COLORS = [CHART.count, CHART.fatality, CHART.muted];

export function RoadTypeShareChart({ data }: { data: BikeInsightBucket[] }) {
  const rows = data.map((d) => ({ name: d.key, value: d.n, share: d.share }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {rows.map((row, i) => (
              <Cell key={row.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
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
      <div className="text-muted-foreground flex justify-center gap-4 text-xs">
        {rows.map((row, i) => (
          <span key={row.name} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full"
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
          { color: CHART.fatality, label: "치사율 (/1000건)" },
          { color: CHART.serious, label: "심각사고율 (%)" },
        ]}
      />
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="key" fontSize={11} tickLine={false} />
            <YAxis fontSize={11} tickLine={false} width={32} />
            <Tooltip
              isAnimationActive={false}
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
            <Bar dataKey="fatality" name="치사율 (/1000건)" fill={CHART.fatality} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="serious" name="심각사고율 (%)" fill={CHART.serious} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
