/**
 * 대시보드 차트 팔레트
 * - 기본: 흑/회색
 * - series: 전용도로·시간대 등 포인트 차트에만 사용
 */
export const CHART = {
  /** 주 막대·주 라인 */
  accent: "#171717",
  /** 보조 시리즈 (이중 축·비교) */
  count: "#a3a3a3",
  /** 연한 보조 */
  muted: "#d4d4d4",
  /** 그리드 */
  grid: "#ececec",
  /**
   * 일부 그래프 전용 포인트 색
   * (리뷰 바: 그린 → 라임 → 골드 → 오렌지 → 소프트 레드)
   */
  series: ["#4ade80", "#a3e635", "#fbbf24", "#fb923c", "#f87171"] as const,
  /** 레이더·다중 시리즈용 무채색 */
  seriesMuted: ["#171717", "#525252", "#737373", "#a3a3a3", "#d4d4d4"] as const,
} as const;

export function ChartTooltipShell({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground mt-0.5">
          {line}
        </p>
      ))}
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: Array<{ color: string; label: string }>;
}) {
  return (
    <div className="text-muted-foreground mb-1 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
