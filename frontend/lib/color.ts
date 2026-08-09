/** 공백 점수(0~100) → 자치구 fill. 진할수록 저녁 약국 접근 취약 */
export function gapFill(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "#e5e5e5";
  const t = Math.min(1, Math.max(0, score / 100));
  // light slate → deep rose
  const r = Math.round(241 + (190 - 241) * t);
  const g = Math.round(245 + (24 - 245) * t);
  const b = Math.round(249 + (72 - 249) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export const PHARM_COLOR = {
  evening: "#0f766e", // teal-700
  late: "#1d4ed8", // blue-700
  normal: "#94a3b8", // slate-400
} as const;

export function pharmacyColor(p: { isEvening: boolean; isLateNight: boolean }): string {
  if (p.isLateNight) return PHARM_COLOR.late;
  if (p.isEvening) return PHARM_COLOR.evening;
  return PHARM_COLOR.normal;
}

export type PharmPinBucket = "evening" | "late" | "normal";

export function pharmacyPinBucket(
  p: { isEvening: boolean; isLateNight: boolean },
  visibleTypes: { evening: boolean; late: boolean; normal: boolean } = {
    evening: true,
    late: true,
    normal: true,
  }
): PharmPinBucket {
  if (p.isLateNight && visibleTypes.late) return "late";
  if (p.isEvening && visibleTypes.evening) return "evening";
  return "normal";
}
