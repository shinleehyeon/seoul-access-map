"use client";

import { metricFill } from "@/lib/color";
import type { ChoroplethMetric } from "@/components/sidebar/FilterSidebar";
import type { DistrictMetric } from "./useMapData";

const METRIC_LABEL: Record<Exclude<ChoroplethMetric, "none">, string> = {
  accidents: "사고 건수",
  fatality: "치사율 (/1000건)",
  seriousRate: "심각사고율 (%)",
  truckShare: "대형차 비중 (%)",
  elderlyShare: "고령 가해 비중 (%)",
  crossShare: "교차로 사고 비중 (%)",
};

export function metricValue(
  d: DistrictMetric,
  metric: Exclude<ChoroplethMetric, "none">
): number {
  switch (metric) {
    case "accidents":
      return d.n;
    case "fatality":
      return d.fatalityPer1000;
    case "seriousRate":
      return d.seriousRate;
    case "truckShare":
      return d.truckShare;
    case "elderlyShare":
      return d.elderlyShare;
    case "crossShare":
      return d.crossShare;
  }
}

export function formatMetricValue(
  d: DistrictMetric,
  metric: Exclude<ChoroplethMetric, "none">
): string {
  const v = metricValue(d, metric);
  switch (metric) {
    case "accidents":
      return `${v.toLocaleString()}건`;
    case "fatality":
      return v.toFixed(1);
    default:
      return `${v.toFixed(1)}%`;
  }
}

function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={highlight ? "text-sm font-semibold" : "text-xs font-medium"}>{value}</span>
    </div>
  );
}

/** 클릭한 구의 TAAS 자전거 사고 지표 */
export function DistrictInspectorCard({
  district,
  metric,
  tone,
}: {
  district: DistrictMetric;
  metric: ChoroplethMetric;
  tone: number;
}) {
  const active = metric !== "none" ? metric : null;
  return (
    <div className="mt-1 overflow-hidden rounded-lg border bg-background/80">
      <div
        className="flex items-baseline justify-between px-3 py-2.5"
        style={{
          background: active ? metricFill(tone) : "#334155",
          color: "#fff",
        }}
      >
        <div>
          <p className="text-[11px] font-medium opacity-90">
            {district.sgg}
            {active ? ` · ${METRIC_LABEL[active]}` : " · 자전거 사고"}
          </p>
          <p className="text-2xl leading-tight font-bold">
            {active ? formatMetricValue(district, active) : `${district.n.toLocaleString()}건`}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <StatRow label="사고 건수" value={`${district.n.toLocaleString()}건`} highlight={metric === "accidents"} />
        <StatRow label="사망" value={`${district.deaths}명`} />
        <StatRow
          label="치사율"
          value={`${district.fatalityPer1000.toFixed(1)} /1000`}
          highlight={metric === "fatality"}
        />
        <StatRow
          label="심각사고율"
          value={`${district.seriousRate.toFixed(1)}%`}
          highlight={metric === "seriousRate"}
        />
        <StatRow
          label="대형차 비중"
          value={`${district.truckShare.toFixed(0)}%`}
          highlight={metric === "truckShare"}
        />
        <StatRow
          label="고령 가해 비중"
          value={`${district.elderlyShare.toFixed(0)}%`}
          highlight={metric === "elderlyShare"}
        />
        <StatRow
          label="교차로 비중"
          value={`${district.crossShare.toFixed(0)}%`}
          highlight={metric === "crossShare"}
        />
      </div>
    </div>
  );
}

export function MapLegend() {
  return (
    <>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        자전거 사고 (피해정도)
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-bike-fatal.png" alt="" className="h-5 w-5 object-contain" />
          사망
        </span>
        <span className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-bike-severe.png" alt="" className="h-5 w-5 object-contain" />
          중상
        </span>
        <span className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-bike-minor.png" alt="" className="h-5 w-5 object-contain" />
          경상
        </span>
        <span className="flex items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-bike-report.png" alt="" className="h-5 w-5 object-contain" />
          부상신고
        </span>
      </div>
    </>
  );
}
