"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatPeriodLabel,
  normalizeRange,
  type PeriodRange,
  type YearMonth,
  ymKey,
} from "@/lib/bikeInsightPeriod";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

/** 연·월 기간 선택 (시작~끝) */
export function YearCalendarPicker({
  years,
  value,
  onChange,
}: {
  years: string[];
  value: PeriodRange;
  onChange: (next: PeriodRange) => void;
}) {
  const [anchor, setAnchor] = useState<YearMonth | null>(null);
  const [hover, setHover] = useState<YearMonth | null>(null);

  const label = formatPeriodLabel(value, years);

  const preview: PeriodRange =
    anchor && hover
      ? { kind: "range", ...normalizeRange(anchor, hover) }
      : anchor
        ? { kind: "range", start: anchor, end: anchor }
        : value;

  function inPreview(ym: YearMonth): boolean {
    if (preview.kind !== "range") return false;
    const k = ymKey(ym);
    return k >= ymKey(preview.start) && k <= ymKey(preview.end);
  }

  function isEdge(ym: YearMonth): boolean {
    if (preview.kind !== "range") return false;
    const k = ymKey(ym);
    return k === ymKey(preview.start) || k === ymKey(preview.end);
  }

  function handlePick(ym: YearMonth) {
    if (!anchor) {
      setAnchor(ym);
      setHover(ym);
      return;
    }
    onChange({ kind: "range", ...normalizeRange(anchor, ym) });
    setAnchor(null);
    setHover(null);
  }

  function selectFullYear(year: number) {
    onChange({
      kind: "range",
      start: { year, month: 1 },
      end: { year, month: 12 },
    });
    setAnchor(null);
    setHover(null);
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) {
          setAnchor(null);
          setHover(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-48 justify-between rounded-xl font-normal">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="text-muted-foreground size-4" />
            {label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-sm font-medium">기간 선택</p>
          <p className="text-muted-foreground text-xs">
            {anchor ? "끝 지점을 고르세요" : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange({ kind: "all" });
            setAnchor(null);
            setHover(null);
          }}
          className={cn(
            "mb-2 w-full rounded-lg border px-2 py-2 text-sm transition-colors",
            value.kind === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-accent"
          )}
        >
          전체 기간
          {years.length ? ` (${years[0]}–${years[years.length - 1]})` : ""}
        </button>

        <div className="max-h-80 space-y-3 overflow-y-auto pr-0.5">
          {years.map((yStr) => {
            const year = Number(yStr);
            return (
              <div key={yStr}>
                <div className="mb-1.5 flex items-center justify-between px-0.5">
                  <p className="text-sm font-medium tabular-nums">{yStr}년</p>
                  <button
                    type="button"
                    onClick={() => selectFullYear(year)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    연 전체
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {MONTH_LABELS.map((mLabel, i) => {
                    const ym = { year, month: i + 1 };
                    const selected = inPreview(ym);
                    const edge = isEdge(ym);
                    return (
                      <button
                        type="button"
                        key={mLabel}
                        onClick={() => handlePick(ym)}
                        onMouseEnter={() => {
                          if (anchor) setHover(ym);
                        }}
                        className={cn(
                          "rounded-md border px-1 py-2 text-xs transition-colors",
                          selected
                            ? edge
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-primary/15 border-primary/30"
                            : "hover:bg-accent"
                        )}
                      >
                        {mLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
