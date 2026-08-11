/** 자치구 CI — public/district-logos/{구이름}.svg (공공누리 제1유형, 출처: 각 구청) */
export function districtLogoSrc(sgg: string): string {
  return `/district-logos/${encodeURIComponent(sgg)}.svg`;
}
