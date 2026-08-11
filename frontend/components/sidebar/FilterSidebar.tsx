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

/** 위험 상위 N개 구부터 자동 색칠 (0=없음, 25=전체) */
export type GapFillStep = 0 | 1 | 3 | 5 | 10 | 25;

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
  gapFillStep: GapFillStep;
  /** 자전거 사고 핀에 적용되는 연도 범위 (TAAS acdntYear 기준, [min, max] 포함) */
  yearRange: [number, number];
  /** 자전거 사고 핀에 적용되는 피해정도 필터. false인 분류는 지도에서 숨김 */
  severities: SeverityFilter;
}

export const DEFAULT_TYPES: AccidentTypeFilter = {
  bike: true,
  elderly: true,
  child: true,
};

export const BIKE_ACCIDENT_YEAR_MIN = 2020;
export const BIKE_ACCIDENT_YEAR_MAX = 2024;

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
  중상사고: true,
  경상사고: true,
  부상신고사고: true,
};

const SEVERITY_OPTIONS: { key: SeverityKey; label: string }[] = [
  { key: "사망사고", label: "사망사고" },
  { key: "중상사고", label: "중상사고" },
  { key: "경상사고", label: "경상사고" },
  { key: "부상신고사고", label: "부상신고사고" },
];

const TYPE_OPTIONS: { key: AccidentTypeKey; label: string; hint: string }[] = [
  { key: "bike", label: "자전거 사고", hint: "TAAS 개별 사고 지점" },
  { key: "elderly", label: "보행노인 사고다발지점", hint: "고령 보행자 사고" },
  { key: "child", label: "어린이 보행자 사고", hint: "TAAS 개별 사고 지점 (보호구역 내/외 색 구분)" },
];

const GAP_STEPS: { value: GapFillStep; label: string; hint: string }[] = [
  { value: 0, label: "자동 색칠 안 함", hint: "" },
  { value: 1, label: "1단계 · 위험 1위만", hint: "" },
  { value: 3, label: "2단계 · 상위 3개", hint: "" },
  { value: 5, label: "3단계 · 상위 5개", hint: "" },
  { value: 10, label: "4단계 · 상위 10개", hint: "" },
  { value: 25, label: "5단계 · 전체 구", hint: "" },
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
  const stepMeta = GAP_STEPS.find((s) => s.value === filters.gapFillStep) ?? GAP_STEPS[0];
  const selectedCount = TYPE_OPTIONS.filter((o) => filters.types[o.key]).length;

  function toggleType(key: AccidentTypeKey, checked: boolean) {
    onChange({
      ...filters,
      types: { ...filters.types, [key]: checked },
    });
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            사고 유형
          </Label>
          <span className="text-muted-foreground text-[11px]">{selectedCount}/3 선택</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-lg border px-3 py-3">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex cursor-pointer items-start gap-2.5"
              htmlFor={`type-${opt.key}`}
            >
              <Checkbox
                id={`type-${opt.key}`}
                checked={filters.types[opt.key]}
                onCheckedChange={(v) => toggleType(opt.key, v === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="text-muted-foreground text-xs">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          보호구역
        </Label>
        <div className="flex flex-col gap-2.5 rounded-lg border px-3 py-3">
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="show-child-zones">
            <Checkbox
              id="show-child-zones"
              checked={filters.showChildZones}
              onCheckedChange={(v) => onChange({ ...filters, showChildZones: v === true })}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">어린이보호구역</span>
              <span className="text-muted-foreground text-xs">학교·유치원·어린이집 등 스쿨존</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5" htmlFor="show-elderly-zones">
            <Checkbox
              id="show-elderly-zones"
              checked={filters.showElderlyZones}
              onCheckedChange={(v) => onChange({ ...filters, showElderlyZones: v === true })}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">노인장애인보호구역</span>
              <span className="text-muted-foreground text-xs">경로당·요양시설 등 보호구역</span>
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
          사고 연도 (자전거·어린이)
        </Label>
        <div className="flex items-center gap-2">
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
            <SelectTrigger className="w-full">
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
          <span className="text-muted-foreground text-xs">~</span>
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
            <SelectTrigger className="w-full">
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
          TAAS 개별 사고 데이터가 있는 2020~2024년 범위에서 선택 (피해정도 필터는 자전거에만 적용)
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
          위험 지역 채우기
        </Label>
        <Select
          value={String(filters.gapFillStep)}
          onValueChange={(v) => onChange({ ...filters, gapFillStep: Number(v) as GapFillStep })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAP_STEPS.map((s) => (
              <SelectItem key={s.value} value={String(s.value)}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground mt-1.5 text-xs">{stepMeta.hint}</p>
      </div>
    </div>
  );
}
