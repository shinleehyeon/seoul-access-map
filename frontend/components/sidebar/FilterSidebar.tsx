"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 공백 점수 높은 구부터 N개만 색칠 (0=없음, 25=전체) */
export type GapFillStep = 0 | 1 | 3 | 5 | 10 | 25;

export type PharmTypeKey = "evening" | "late" | "normal";

export interface PharmTypeFilter {
  evening: boolean;
  late: boolean;
  normal: boolean;
}

export interface FilterState {
  types: PharmTypeFilter;
  sgg: string;
  query: string;
  gapFillStep: GapFillStep;
}

export const DEFAULT_TYPES: PharmTypeFilter = {
  evening: true,
  late: true,
  normal: true,
};

const TYPE_OPTIONS: { key: PharmTypeKey; label: string; hint: string }[] = [
  { key: "evening", label: "저녁 약국 (21시+)", hint: "평일 마감 21시 이후" },
  { key: "late", label: "심야 약국 (22시+)", hint: "마감 22시 이후" },
  { key: "normal", label: "일반 약국", hint: "저녁·심야 해당 없음" },
];

const GAP_STEPS: { value: GapFillStep; label: string; hint: string }[] = [
  { value: 0, label: "자동 색칠 안 함", hint: "지도에서 구를 클릭해 하나씩 색칠할 수 있어요" },
  { value: 1, label: "1단계 · 공백 1위만", hint: "가장 부족한 구부터 + 클릭 색칠" },
  { value: 3, label: "2단계 · 상위 3개", hint: "부족 구를 조금씩 채움 + 클릭 색칠" },
  { value: 5, label: "3단계 · 상위 5개", hint: "공백 Top5까지 + 클릭 색칠" },
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

  function toggleType(key: PharmTypeKey, checked: boolean) {
    onChange({
      ...filters,
      types: { ...filters.types, [key]: checked },
    });
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <Label className="text-muted-foreground mb-2.5 text-xs font-semibold tracking-wide uppercase">
          약국명·주소 검색
        </Label>
        <Input
          placeholder="예: 종로, 메트로약국"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
        />
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            영업 유형
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
          공백 영역 채우기
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
