"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BikeAccidentInsights, BikeInsightBucket } from "@/lib/types";
import { CHART, ChartLegend, ChartTooltipShell } from "./chartTheme";

export function HourVolumeFatalityChart({
  hours,
}: {
  hours: BikeAccidentInsights["hours"];
}) {
  const rows = [...hours].sort((a, b) => a.hour - b.hour);
  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { color: CHART.count, label: "사고 건수" },
          { color: CHART.fatality, label: "치사율 (/1000건)" },
        ]}
      />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="hour" fontSize={10} tickLine={false} interval={2} />
            <YAxis yAxisId="count" fontSize={11} tickLine={false} width={28} />
            <YAxis yAxisId="fatality" orientation="right" fontSize={11} tickLine={false} width={28} />
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof rows)[number];
                return (
                  <ChartTooltipShell
                    title={row.label}
                    lines={[
                      `${row.n.toLocaleString()}건 · 사망 ${row.deaths}`,
                      `치사율 ${row.fatalityPer1000} /1000건`,
                    ]}
                  />
                );
              }}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="n"
              stroke={CHART.count}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART.count }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="fatality"
              type="monotone"
              dataKey="fatalityPer1000"
              stroke={CHART.fatality}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART.fatality }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MonthVolumeChart({
  months,
}: {
  months: BikeAccidentInsights["months"];
}) {
  const rows = months.map((m) => ({ month: `${m.month}월`, n: m.n }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" fontSize={10} tickLine={false} />
          <YAxis fontSize={11} tickLine={false} width={28} />
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof rows)[number];
              return <ChartTooltipShell title={row.month} lines={[`${row.n.toLocaleString()}건`]} />;
            }}
          />
          <Bar dataKey="n" fill={CHART.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BikeRoadCompareChart({ data }: { data: BikeInsightBucket[] }) {
  const rows = data.map((d) => ({
    key: d.key,
    fatality: d.fatalityPer1000,
    serious: d.seriousRate,
    n: d.n,
  }));
  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { color: CHART.fatality, label: "치사율 (/1000건)" },
          { color: CHART.serious, label: "심각사고율 (%)" },
        ]}
      />
      <div className="h-56 w-full">
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
                      `${row.n.toLocaleString()}건`,
                      `치사율 ${row.fatality} /1000건 · 심각사고율 ${row.serious}%`,
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
