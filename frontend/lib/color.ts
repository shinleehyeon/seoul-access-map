/** 지표값 정규화(0~1) → 자치구 fill. 낮음=연한 슬레이트, 높음=진한 로즈 */
export function metricFill(t: number | null | undefined): string {
  if (t === null || t === undefined || Number.isNaN(t)) return "#e5e7eb";
  const x = Math.min(1, Math.max(0, t));
  const r = Math.round(241 + (190 - 241) * x);
  const g = Math.round(245 + (24 - 245) * x);
  const b = Math.round(249 + (72 - 249) * x);
  return `rgb(${r}, ${g}, ${b})`;
}

/** @deprecated 위험점수 색칠 — metricFill 사용 */
export function gapFill(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "#e5e5e5";
  return metricFill(Math.min(1, Math.max(0, score / 100)));
}
