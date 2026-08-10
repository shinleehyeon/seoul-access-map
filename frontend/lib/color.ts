/** 위험 점수(0~100) → 자치구 fill. 진할수록 교통안전 공백이 큼 */
export function gapFill(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "#e5e5e5";
  const t = Math.min(1, Math.max(0, score / 100));
  // light slate → deep rose
  const r = Math.round(241 + (190 - 241) * t);
  const g = Math.round(245 + (24 - 245) * t);
  const b = Math.round(249 + (72 - 249) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
