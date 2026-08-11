/** 대시보드 차트 고정 팔레트 — 위험점수 색상 스케일 대신 의미별 색 */
export const CHART = {
  count: "#64748b",
  fatality: "#e11d48",
  serious: "#d97706",
  accent: "#0f766e",
  muted: "#94a3b8",
  /** 전용도로 위/밖 대비용 */
  bikeOn: "#0f766e",
  bikeOff: "#ea580c",
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
