export type LonLat = [number, number];

/** Andrew's monotone chain — 좌표 10~20개 수준의 소규모 점군에 충분 */
export function convexHull(points: LonLat[]): LonLat[] {
  const pts = [...new Set(points.map((p) => `${p[0]},${p[1]}`))].map((s) => {
    const [x, y] = s.split(",").map(Number);
    return [x, y] as LonLat;
  });
  if (pts.length < 3) return pts;
  pts.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const cross = (o: LonLat, a: LonLat, b: LonLat) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: LonLat[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: LonLat[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** 볼록껍질을 살짝 부풀려서(단순 방사 확장) 점 자체가 가장자리에 딱 붙지 않게 함 */
export function bufferHull(hull: LonLat[], factor = 1.15): LonLat[] {
  if (hull.length < 3) return hull;
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}
