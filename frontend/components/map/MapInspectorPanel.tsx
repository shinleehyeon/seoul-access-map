"use client";

import { gapFill } from "@/lib/color";
import type { CrimeCctvStat } from "@/lib/types";

export type ColorMode = "bike" | "child" | "elderly";

const MODE_LABEL: Record<ColorMode, string> = { bike: "자전거", child: "어린이", elderly: "노인" };

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={highlight ? "text-sm font-semibold" : "text-xs font-medium"}>{value}</span>
    </div>
  );
}

function OnInfraVerdict({
  rate,
  sample,
  onLabel,
  offLabel,
  lowConfidence = false,
}: {
  rate: number;
  sample?: number;
  onLabel: string;
  offLabel: string;
  lowConfidence?: boolean;
}) {
  const onInfra = rate >= 50;
  return (
    <div className="border-t pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">인프라 위/근처 발생 비율</span>
        <span className="text-sm font-semibold">{rate}%</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            onInfra ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"
          }`}
        >
          {onInfra ? onLabel : offLabel}
        </span>
        <span className="text-muted-foreground text-[10px]">
          표본 {sample ?? 0}곳{lowConfidence ? " · 참고용" : ""}
        </span>
      </div>
    </div>
  );
}

export function ColorModeTabs({
  mode,
  onChange,
}: {
  mode: ColorMode;
  onChange: (mode: ColorMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
      {(Object.keys(MODE_LABEL) as ColorMode[]).map((key) => (
        <button
          key={key}
          type="button"
          className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
            mode === key ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => onChange(key)}
        >
          {MODE_LABEL[key]}
        </button>
      ))}
    </div>
  );
}

/** 클릭한 구의 위험 점수와 세부 지표를 보여주는 카드 */
export function DistrictInspectorCard({
  district,
  colorMode,
  score,
  painted,
}: {
  district: CrimeCctvStat;
  colorMode: ColorMode;
  score: number;
  painted: boolean;
}) {
  return (
    <div className="mt-1 overflow-hidden rounded-lg border bg-background/80">
      <div
        className="flex items-baseline justify-between px-3 py-2.5"
        style={{ background: gapFill(score), color: "#fff" }}
      >
        <div>
          <p className="text-[11px] font-medium opacity-90">
            {district.sgg} · {MODE_LABEL[colorMode]} 위험 점수
          </p>
          <p className="text-2xl leading-tight font-bold">{score}</p>
        </div>
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium">
          {painted ? "색칠됨" : "해제됨"}
        </span>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        {colorMode === "bike" && (
          <>
            <StatRow label="연간 자전거사고" value={`${district.bikeAccidentCount}건`} />
            <StatRow label="자전거도로" value={`${district.bikeRoadKm}km`} />
            <StatRow label="도로 1km당 사고" value={district.bikeAccidentPerRoadKm} highlight />
            <StatRow
              label="지도 다발지점"
              value={`${district.bikeHotspotCount ?? 0}곳 / 전체 ${district.accidentCount}곳`}
            />
            {district.bikeOnRoadRate != null && (
              <OnInfraVerdict
                rate={district.bikeOnRoadRate}
                sample={district.bikeOnRoadSample}
                onLabel="도로 설계 문제"
                offLabel="인프라 부재 문제"
              />
            )}
          </>
        )}
        {colorMode === "child" && (
          <>
            <StatRow label="연간 보행 어린이사고" value={`${district.childAccidentCount}건`} />
            <StatRow label="어린이보호구역" value={`${district.childZoneCount}곳`} />
            <StatRow label="보호구역 100곳당 사고" value={district.childAccidentPerZone} highlight />
            {district.childInZoneRate != null && (
              <OnInfraVerdict
                rate={district.childInZoneRate}
                sample={district.childInZoneSample}
                onLabel="보호구역 안에서 발생"
                offLabel="보호구역 밖에서 발생"
                lowConfidence
              />
            )}
          </>
        )}
        {colorMode === "elderly" && (
          <>
            <StatRow label="연간 보행 노인사고" value={`${district.elderlyAccidentCount}건`} />
            <StatRow label="인구 1만명당 사고" value={district.elderlyAccidentPer10k} highlight />
            <StatRow label="노인장애인보호구역" value={`${district.elderlyZoneCount}곳`} />
            {district.elderlyInZoneRate != null && (
              <OnInfraVerdict
                rate={district.elderlyInZoneRate}
                sample={district.elderlyInZoneSample}
                onLabel="보호구역 안에서 발생"
                offLabel="보호구역 밖에서 발생"
                lowConfidence
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function MapLegend() {
  return (
    <>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#a16207] bg-[#eab308]/55" />
        자전거전용도로
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#b45309] bg-[#f59e0b]/55" />
        어린이보호구역 (도로 연결)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#5b21b6] bg-[#8b5cf6]/55" />
        노인장애인보호구역 (도로 연결)
      </div>
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/markers/pin-accident-bike.png" alt="" className="h-6 w-6 object-contain" />
        자전거 사고다발지점
      </div>
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/markers/pin-accident-elderly.png" alt="" className="h-7 w-7 object-contain" />
        보행노인 사고다발지점
      </div>
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/markers/pin-accident-child.png" alt="" className="h-6 w-6 object-contain" />
        보행/스쿨존 어린이 사고다발지점
      </div>
    </>
  );
}
