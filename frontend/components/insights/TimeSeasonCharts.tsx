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
             
            />
            <Line
              yAxisId="fatality"
              type="monotone"
              dataKey="fatalityPer1000"
              stroke={CHART.fatality}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART.fatality }}
              activeDot={{ r: 5 }}
             
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
           
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as (typeof rows)[number];
              return <ChartTooltipShell title={row.month} lines={[`${row.n.toLocaleString()}건`]} />;
            }}
          />
          <Bar dataKey="n" fill={CHART.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BikeRoadCompareChart({ data }: { data: BikeInsightBucket[] }) {
  const on = data.find((d) => d.key.includes("위")) ?? data[0];
  const off = data.find((d) => d.key.includes("밖")) ?? data[1];
  if (!on || !off) {
    return <p className="text-muted-foreground text-sm">비교 데이터가 없습니다.</p>;
  }

  const total = on.n + off.n || 1;
  const onShare = (on.n / total) * 100;
  const offShare = (off.n / total) * 100;

  const onColor = CHART.bikeOn;
  const offColor = CHART.bikeOff;

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 flex h-3 overflow-hidden rounded-full">
        <div
          className="h-full rounded-l-full"
          style={{ width: `${onShare}%`, background: onColor }}
          title={`전용도로 위 ${onShare.toFixed(1)}%`}
        />
        <div
          className="h-full rounded-r-full"
          style={{ width: `${offShare}%`, background: offColor }}
          title={`전용도로 밖 ${offShare.toFixed(1)}%`}
        />
      </div>
      <div className="text-muted-foreground flex justify-between text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: onColor }} />
          위 {onShare.toFixed(1)}%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: offColor }} />
          밖 {offShare.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BikeRoadSideCard
          title="전용도로 위"
          accent={onColor}
          n={on.n}
          deaths={on.deaths}
          fatality={on.fatalityPer1000}
          serious={on.seriousRate}
        />
        <BikeRoadSideCard
          title="전용도로 밖"
          accent={offColor}
          n={off.n}
          deaths={off.deaths}
          fatality={off.fatalityPer1000}
          serious={off.seriousRate}
        />
      </div>
    </div>
  );
}

function BikeRoadSideCard({
  title,
  accent,
  n,
  deaths,
  fatality,
  serious,
}: {
  title: string;
  accent: string;
  n: number;
  deaths: number;
  fatality: number;
  serious: number;
}) {
  return (
    <div className="rounded-xl border p-3.5">
      <p className="flex items-center gap-1.5 text-base font-medium">
        <span className="size-2.5 rounded-sm" style={{ background: accent }} />
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {n.toLocaleString()}
        <span className="text-muted-foreground ml-1 text-base font-medium">건</span>
      </p>
      <p className="text-muted-foreground mt-1 text-sm">사망 {deaths}명</p>
      <div className="mt-3 space-y-2 border-t pt-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">치사율</span>
          <span className="font-medium tabular-nums" style={{ color: CHART.fatality }}>
            {fatality.toFixed(1)} /1000
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">심각률</span>
          <span className="font-medium tabular-nums" style={{ color: CHART.serious }}>
            {serious.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
