"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { BikeAccidentInsights } from "@/lib/types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type DayHourRow = BikeAccidentInsights["dayHour"][number];
type Mode = "n" | "serious";

function cellColor(t: number): string {
  const g = Math.round(245 - t * 200);
  return `rgb(${g}, ${g}, ${g})`;
}

function seriousCount(row: DayHourRow): number {
  return Math.round((row.seriousRate / 100) * row.n);
}

export function DayHourHeatmap({ data }: { data: DayHourRow[] }) {
  const [mode, setMode] = useState<Mode>("n");
  const [tip, setTip] = useState<{
    row: DayHourRow;
    x: number;
    y: number;
  } | null>(null);

  const { grid, maxN, maxSerious } = useMemo(() => {
    const map = new Map<string, DayHourRow>();
    let maxN = 1;
    let maxSerious = 1;
    for (const row of data) {
      map.set(`${row.day}-${row.hour}`, row);
      if (row.n > maxN) maxN = row.n;
      const sc = seriousCount(row);
      if (sc > maxSerious) maxSerious = sc;
    }
    const grid = DAYS.map((day) =>
      HOURS.map(
        (hour) =>
          map.get(`${day}-${hour}`) ?? {
            day,
            hour,
            n: 0,
            deaths: 0,
            fatalityPer1000: 0,
            seriousRate: 0,
          }
      )
    );
    return { grid, maxN, maxSerious };
  }, [data]);

  if (!data.length) {
    return (
      <p className="text-muted-foreground text-sm">
        이 필터 조합에서는 요일×시간 데이터가 없습니다. 기간을 넓히거나 전체 구로 보세요.
      </p>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex w-fit gap-1 rounded-lg border p-0.5">
        <button
          type="button"
          onClick={() => setMode("n")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === "n" ? "bg-[#171717] text-white" : "text-muted-foreground hover:bg-gray-50"
          }`}
        >
          건수
        </button>
        <button
          type="button"
          onClick={() => setMode("serious")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === "serious"
              ? "bg-[#171717] text-white"
              : "text-muted-foreground hover:bg-gray-50"
          }`}
        >
          심각건수
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="inline-grid min-w-full gap-0.5"
          style={{ gridTemplateColumns: `28px repeat(24, minmax(14px, 1fr))` }}
        >
          <div />
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-muted-foreground pb-1 text-center text-[10px] tabular-nums"
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}

          {grid.map((row, di) => (
            <div key={DAYS[di]} className="contents">
              <div className="text-muted-foreground flex items-center text-xs font-medium">
                {DAYS[di]}
              </div>
              {row.map((cell) => {
                const sc = seriousCount(cell);
                const t =
                  mode === "n" ? cell.n / maxN : Math.min(1, sc / maxSerious);
                return (
                  <button
                    key={`${cell.day}-${cell.hour}`}
                    type="button"
                    className="aspect-square min-h-[14px] rounded-[3px] outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-[#171717]"
                    style={{ background: cellColor(t) }}
                    onMouseEnter={(e) =>
                      setTip({ row: cell, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) => {
                      setTip((prev) =>
                        prev ? { row: prev.row, x: e.clientX, y: e.clientY } : null
                      );
                    }}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTip({ row: cell, x: r.left + r.width / 2, y: r.top });
                    }}
                    onBlur={() => setTip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex h-4 items-center justify-end gap-2 text-[10px]">
        <span>낮음</span>
        <div className="flex h-2 w-24 overflow-hidden rounded-full">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span key={t} className="h-full flex-1" style={{ background: cellColor(t) }} />
          ))}
        </div>
        <span>높음</span>
      </div>

      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] rounded-lg border bg-white px-3 py-2 text-xs shadow-md"
              style={{
                left: Math.min(tip.x + 12, window.innerWidth - 160),
                top: Math.min(tip.y + 12, window.innerHeight - 100),
              }}
            >
              <p className="font-semibold">
                {tip.row.day}요일 {String(tip.row.hour).padStart(2, "0")}시
              </p>
              <p className="text-muted-foreground mt-0.5">
                {tip.row.n.toLocaleString()}건
              </p>
              <p className="text-muted-foreground">
                심각 {seriousCount(tip.row).toLocaleString()}건
              </p>
              <p className="text-muted-foreground">사망 {tip.row.deaths}명</p>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
