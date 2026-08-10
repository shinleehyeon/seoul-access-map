export interface PharmacyHours {
  mon: [string | null, string | null];
  tue: [string | null, string | null];
  wed: [string | null, string | null];
  thu: [string | null, string | null];
  fri: [string | null, string | null];
  sat: [string | null, string | null];
  sun: [string | null, string | null];
  holiday: [string | null, string | null];
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  tel: string | null;
  lon: number;
  lat: number;
  sgg: string;
  isEvening: boolean;
  isLateNight: boolean;
  maxWeekdayClose: number | null;
  maxClose: number | null;
  hours: PharmacyHours;
}

export interface DistrictStat {
  sgg: string;
  population: number;
  eveningLivingPop?: number;
  pharmacyCount: number;
  eveningCount: number;
  lateNightCount: number;
  eveningPer10k: number;
  meanNearestM: number;
  uncoveredShare: number;
  estUncoveredPop: number;
  gapScore: number;
  sampleCount: number;
  /** 토·일·공휴일 마감 22시+ */
  weekendLateCount?: number;
  weekendLatePer10k?: number;
  eveningOnlyCount?: number;
  lateOnlyCount?: number;
  bothLateEveningCount?: number;
  /** 저녁 생활인구 / 주민등록 */
  livingPopRatio?: number;
  /** 시 전체 저녁 약국 대비 점유율 */
  eveningShare?: number;
  /** 고령 1인가구 쉼터 접근 공백 (독거노인 밀도 ↑, 경로당·약국 부족 ↑일수록 상승) */
  elderlyCount?: number;
  elderlyPer10k?: number;
  centerCount?: number;
  centerPer1kElderly?: number;
  pharmacyGapScore?: number;
}

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
  childAccidentPerZone: number;
  elderlyZoneCount: number;
  elderlyAccidentCount: number;
  elderlyAccidentPerZone: number;
  bikeScore: number;
  childScore: number;
  elderlyScore: number;
  gapScore: number;
}

export interface Summary {
  pharmacyCount: number;
  eveningCount: number;
  lateNightCount: number;
  walkMeters: number;
  eveningCloseThreshold: number;
  lateCloseThreshold: number;
  method?: string;
  spopDate?: string;
  spopHour?: number;
  worst: {
    sgg: string;
    gapScore: number;
    uncoveredShare: number;
    estUncoveredPop: number;
  };
  best: {
    sgg: string;
    gapScore: number;
    uncoveredShare: number;
    estUncoveredPop: number;
  };
  avgUncoveredShare: number;
  weekendLateCount?: number;
  eveningTop3Share?: number;
  eveningTop3?: { sgg: string; eveningCount: number; share: number }[];
  highestLivingRatio?: {
    sgg: string;
    ratio: number;
    eveningLivingPop: number;
    population: number;
    eveningCount: number;
  };
  lowestWeekendLate?: {
    sgg: string;
    weekendLatePer10k: number;
    weekendLateCount: number;
  };
}
