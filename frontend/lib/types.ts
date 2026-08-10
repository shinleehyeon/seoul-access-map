/** 교통안전(자전거·어린이·노인) 자치구 통계 — crime_cctv_stats.json */
export interface CrimeCctvStat {
  sgg: string;
  population: number;
  accidentCount: number;
  accidentPer10k: number;
  bikeAccidentCount: number;
  bikeHotspotCount: number;
  bikeAccidentPer10k: number;
  bikeRoadKm: number;
  bikeAccidentPerRoadKm: number;
  childZoneCount: number;
  childAccidentCount: number;
  childHotspotCount: number;
  childAccidentPerZone: number;
  elderlyZoneCount: number;
  elderlyAccidentCount: number;
  elderlyHotspotCount: number;
  elderlyAccidentPerZone: number;
  elderlyAccidentPer10k: number;
  /** 자전거사고 중 전용도로 50m 이내에서 발생한 비율(%) - 도로설계 vs 인프라부재 구분용 */
  bikeOnRoadRate?: number | null;
  bikeOnRoadSample?: number;
  /** 어린이/노인 사고 중 보호구역 폴리곤 안에서 발생한 비율(%) - 표본이 적어 참고용 */
  childInZoneRate?: number | null;
  childInZoneSample?: number;
  elderlyInZoneRate?: number | null;
  elderlyInZoneSample?: number;
  bikeScore: number;
  childScore: number;
  elderlyScore: number;
  gapScore: number;
}
