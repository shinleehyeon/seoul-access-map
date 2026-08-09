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
