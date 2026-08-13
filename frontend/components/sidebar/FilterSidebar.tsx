"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 자치구 전체 색칠에 쓸 자전거 사고 지표 */
export type ChoroplethMetric =
  | "none"
  | "accidents"
  | "fatality"
  | "seriousRate"
  | "truckShare"
  | "elderlyShare"
  | "crossShare";

export type AccidentTypeKey = "bike" | "elderly" | "child";

export interface AccidentTypeFilter {
  bike: boolean;
  elderly: boolean;
  child: boolean;
}

/** TAAS 사고내용(피해정도) 4개 분류 */
export type SeverityKey = "사망사고" | "중상사고" | "경상사고" | "부상신고사고";

export type SeverityFilter = Record<SeverityKey, boolean>;

export interface FilterState {
  types: AccidentTypeFilter;
  showChildZones: boolean;
  showElderlyZones: boolean;
  showBikeRoads: boolean;
  sgg: string;
  /** 선택 시 전 자치구를 해당 지표로 색칠 */
  choroplethMetric: ChoroplethMetric;
  /** 자전거 사고 핀에 적용되는 연도 범위 (TAAS acdntYear 기준, [min, max] 포함) */
  yearRange: [number, number];
  /** 자전거 사고 핀에 적용되는 피해정도 필터. false인 분류는 지도에서 숨김 */
  severities: SeverityFilter;
}

export const CHOROPLETH_OPTIONS: { value: ChoroplethMetric; label: string; hint: string }[] = [
  { value: "none", label: "색칠 안 함", hint: "" },
  { value: "accidents", label: "사고 건수", hint: "TAAS 누적" },
  { value: "fatality", label: "치사율", hint: "1,000건당 사망자 수" },
  { value: "seriousRate", label: "심각사고율", hint: "사망+중상 사고 비율" },
  { value: "truckShare", label: "대형차 비중", hint: "화물·승합·건설기계 상대 비중" },
  { value: "elderlyShare", label: "고령 가해 비중", hint: "65세 이상 가해 당사자 비중" },
  { value: "crossShare", label: "교차로 사고 비중", hint: "도로형태가 교차로인 비율" },
];

/** 어린이·노인 타입은 상태/맵 로직에 유지하되 UI에서는 숨기고 기본 off */
export const DEFAULT_TYPES: AccidentTypeFilter = {
  bike: true,
  elderly: false,
  child: false,
};

export const BIKE_ACCIDENT_YEAR_MIN = 2020;
export const BIKE_ACCIDENT_YEAR_MAX = 2025;

export const DEFAULT_YEAR_RANGE: [number, number] = [
  BIKE_ACCIDENT_YEAR_MIN,
  BIKE_ACCIDENT_YEAR_MAX,
];

const YEAR_OPTIONS = Array.from(
  { length: BIKE_ACCIDENT_YEAR_MAX - BIKE_ACCIDENT_YEAR_MIN + 1 },
  (_, i) => BIKE_ACCIDENT_YEAR_MIN + i
);

export const DEFAULT_SEVERITY_FILTER: SeverityFilter = {
  사망사고: true,
  중상사고: false,
  경상사고: false,
  부상신고사고: false,
};

const SEVERITY_OPTIONS: { key: SeverityKey; label: string }[] = [
  { key: "사망사고", label: "사망사고" },
  { key: "중상사고", label: "중상사고" },
  { key: "경상사고", label: "경상사고" },
  { key: "부상신고사고", label: "부상신고사고" },
];

export function FilterSidebar({
  districts,
  filters,
  onChange,
}: {
  districts: string[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const choroplethMeta =
    CHOROPLETH_OPTIONS.find((s) => s.value === filters.choroplethMetric) ?? CHOROPLETH_OPTIONS[0];

  return (
    <div className="flex min-w-0 flex-col gap-5 py-3 pr-1 pl-0">
      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          표시
        </Label>
        <div className="flex flex-col gap-2.5 rounded-lg border px-3 py-3">
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="type-bike">
            <Checkbox
              id="type-bike"
              checked={filters.types.bike}
              onCheckedChange={(v) =>
                onChange({
                  ...filters,
                  types: { ...filters.types, bike: v === true },
                })
              }
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">자전거 사고 핀</span>
              <span className="text-muted-foreground text-xs">TAAS 개별 사고 지점</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="show-bike-roads">
            <Checkbox
              id="show-bike-roads"
              checked={filters.showBikeRoads}
              onCheckedChange={(v) => onChange({ ...filters, showBikeRoads: v === true })}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">자전거전용도로</span>
              <span className="text-muted-foreground text-xs">OSM 전용도로·전용트랙</span>
            </span>
          </label>
        </div>
      </div>

      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          자치구
        </Label>
        <Select value={filters.sgg} onValueChange={(v) => onChange({ ...filters, sgg: v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 구</SelectItem>
            {districts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          사고 연도
        </Label>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Select
            value={String(filters.yearRange[0])}
            onValueChange={(v) => {
              const from = Number(v);
              onChange({
                ...filters,
                yearRange: [from, Math.max(from, filters.yearRange[1])],
              });
            }}
          >
            <SelectTrigger className="w-full min-w-0 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-center text-xs">~</span>
          <Select
            value={String(filters.yearRange[1])}
            onValueChange={(v) => {
              const to = Number(v);
              onChange({
                ...filters,
                yearRange: [Math.min(filters.yearRange[0], to), to],
              });
            }}
          >
            <SelectTrigger className="w-full min-w-0 px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          TAAS 자전거 사고 2020~2025년 범위 (피해정도 필터는 자전거에만 적용)
        </p>

        <Label className="text-muted-foreground mt-3 mb-2.5 block text-xs font-semibold tracking-wide uppercase">
          피해정도
        </Label>
        <div className="flex flex-col gap-2.5 rounded-lg border px-3 py-3">
          {SEVERITY_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-center gap-2.5"
              htmlFor={`severity-${opt.key}`}
            >
              <Checkbox
                id={`severity-${opt.key}`}
                checked={filters.severities[opt.key]}
                onCheckedChange={(v) =>
                  onChange({
                    ...filters,
                    severities: { ...filters.severities, [opt.key]: v === true },
                  })
                }
              />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          사망사고 핀은 빨간색으로 강조 표시
        </p>
      </div>

      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          자치구 색칠
          {filters.yearRange[0] === filters.yearRange[1]
            ? ` (${filters.yearRange[0]})`
            : ` (${filters.yearRange[0]}–${filters.yearRange[1]})`}
        </Label>
        <Select
          value={filters.choroplethMetric}
          onValueChange={(v) => onChange({ ...filters, choroplethMetric: v as ChoroplethMetric })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHOROPLETH_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground mt-1.5 text-xs">
          {choroplethMeta.hint || "지표를 고르면 25개 구 전체가 그 값으로 색칠됩니다."} · 위 연도
          범위 기준
        </p>
      </div>
    </div>
  );
}
