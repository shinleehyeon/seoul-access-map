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

export interface FilterState {
  types: AccidentTypeFilter;
  showChildZones: boolean;
  showElderlyZones: boolean;
  showBikeRoads: boolean;
  sgg: string;
  gapFillStep: GapFillStep;
}

export const DEFAULT_TYPES: AccidentTypeFilter = {
  bike: true,
  elderly: true,
  child: true,
};

const TYPE_OPTIONS: { key: AccidentTypeKey; label: string; hint: string }[] = [
  { key: "bike", label: "자전거 사고다발지점", hint: "자전거 관련 사고" },
  { key: "elderly", label: "보행노인 사고다발지점", hint: "고령 보행자 사고" },
  { key: "child", label: "어린이 사고다발지점", hint: "보행어린이·스쿨존 사고" },
];

const GAP_STEPS: { value: GapFillStep; label: string; hint: string }[] = [
  { value: 0, label: "자동 색칠 안 함", hint: "지도에서 구를 클릭해 하나씩 색칠할 수 있어요" },
  { value: 1, label: "1단계 · 위험 1위만", hint: "가장 위험한 구부터 + 클릭 색칠" },
  { value: 3, label: "2단계 · 상위 3개", hint: "위험 구를 조금씩 채움 + 클릭 색칠" },
  { value: 5, label: "3단계 · 상위 5개", hint: "위험 Top5까지 + 클릭 색칠" },
  { value: 10, label: "4단계 · 상위 10개", hint: "절반 정도 채움 + 클릭 색칠" },
  { value: 25, label: "5단계 · 전체 구", hint: "25개 자치구 모두" },
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
        <p className="text-muted-foreground mt-1.5 text-xs">여러 개 선택 가능 · 전부 해제하면 숨김</p>
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
