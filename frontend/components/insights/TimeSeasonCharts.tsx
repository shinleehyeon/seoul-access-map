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
  const volumeColor = CHART.series[0]; // soft green
  const fatalityColor = CHART.series[4]; // soft red
  const rows = [...hours].sort((a, b) => a.hour - b.hour);
  return (
    <div className="w-full">
      <ChartLegend
        items={[
          { color: volumeColor, label: "사고 건수" },
          { color: fatalityColor, label: "치사율 (/1000건)" },
        ]}
      />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
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
              stroke={volumeColor}
              strokeWidth={2}
              dot={{ r: 3, fill: volumeColor }}
              activeDot={{ r: 5 }}
             
            />
            <Line
              yAxisId="fatality"
              type="monotone"
              dataKey="fatalityPer1000"
              stroke={fatalityColor}
              strokeWidth={2}
              dot={{ r: 3, fill: fatalityColor }}
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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
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
  const onColor = CHART.series[0];
  const offColor = CHART.series[3];
  const fatalityRatio =
    on.fatalityPer1000 > 0 ? off.fatalityPer1000 / on.fatalityPer1000 : null;
  const fatalityBadge =
    fatalityRatio != null && Number.isFinite(fatalityRatio)
      ? fatalityRatio >= 1
        ? {
            tone: "atRisk" as const,
            text: `위험: 밖 치사율 ${fatalityRatio.toFixed(1)}배`,
          }
        : {
            tone: "onTrack" as const,
            text: `양호: 위 치사율이 ${(1 / fatalityRatio).toFixed(1)}배`,
          }
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pt-1">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="min-w-0">
            <span className="text-3xl font-bold tracking-tight text-[#171717] tabular-nums">
              {on.n.toLocaleString()}
            </span>
            <span className="text-muted-foreground ml-2 text-sm font-medium">전용도로 위</span>
          </p>
          <p className="min-w-0 text-right">
            <span className="text-muted-foreground mr-2 text-sm font-medium">전용도로 밖</span>
            <span className="text-3xl font-bold tracking-tight text-[#171717] tabular-nums">
              {off.n.toLocaleString()}
            </span>
          </p>
        </div>

        <div className="relative h-9 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
          <div
            className="absolute inset-y-0 left-0 flex items-center rounded-full bg-[#171717] px-3"
            style={{ width: `${onShare}%` }}
            title={`전용도로 위 ${onShare.toFixed(1)}%`}
          >
            {onShare >= 18 ? (
              <span className="truncate text-xs font-medium text-white">
                전용도로 위 {onShare.toFixed(0)}%
              </span>
            ) : onShare >= 10 ? (
              <span className="truncate text-xs font-medium text-white">전용도로 위</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
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
          badge={fatalityBadge}
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
  badge,
}: {
  title: string;
  accent: string;
  n: number;
  deaths: number;
  fatality: number;
  serious: number;
  badge?: { tone: "atRisk" | "onTrack"; text: string } | null;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-base font-medium">
          <span className="size-2.5 rounded-sm" style={{ background: accent }} />
          {title}
        </p>
        {badge ? (
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              badge.tone === "atRisk"
                ? "bg-[#fdecee] text-[#c23b45]"
                : "bg-[#e8f8ef] text-[#1f7a4d]"
            }`}
          >
            {badge.text}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {n.toLocaleString()}
        <span className="text-muted-foreground ml-1 text-base font-medium">건</span>
      </p>
      <p className="text-muted-foreground mt-1 text-sm">사망 {deaths}명</p>
      <div className="mt-auto space-y-2 border-t pt-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">치사율</span>
          <span className="font-medium tabular-nums" style={{ color: CHART.series[4] }}>
            {fatality.toFixed(1)} /1000
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">심각률</span>
          <span className="font-medium tabular-nums" style={{ color: CHART.series[2] }}>
            {serious.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
