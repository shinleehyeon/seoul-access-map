/** TAAS 자전거 가해 사고 인사이트 — bike_accident_insights.json */
export interface BikeInsightBucket {
  key: string;
  n: number;
  share: number;
  deaths: number;
  fatalityPer1000: number;
  seriousRate: number;
}

export interface BikeInsightSlice {
  total: number;
  deaths: number;
  headline: {
    heavyVehicleAccidentShare: number;
    heavyVehicleDeathShare: number;
    elderlyAccidentShare: number;
    elderlyDeathShare: number;
    dawnAccidents: number;
    dawnDeaths: number;
    dawnFatalityPer1000: number;
    bikeBikeSeriousRate: number;
    pedestrianCount: number;
    pedestrianSeriousRate: number;
    sidewalkRidingShareOfPed: number;
  };
  roadTypes: BikeInsightBucket[];
  opponents: BikeInsightBucket[];
  ages: BikeInsightBucket[];
  violations: BikeInsightBucket[];
  hours: Array<{
    hour: number;
    label: string;
    n: number;
    deaths: number;
    fatalityPer1000: number;
    seriousRate: number;
  }>;
  seasons: BikeInsightBucket[];
  months: Array<{ month: number; n: number }>;
  bikeRoadCompare: BikeInsightBucket[];
}

export type BikeDistrictRow = {
  sgg: string;
  n: number;
  deaths: number;
  fatalityPer1000: number;
  seriousRate: number;
  pedShare: number;
  bikeShare: number;
  truckShare: number;
  crossShare: number;
  elderlyShare: number;
};

export type BikeMonthBundle = BikeInsightSlice & {
  bySgg: Record<string, BikeInsightSlice>;
  districts: BikeDistrictRow[];
};

export type BikeYearBundle = BikeInsightSlice & {
  bySgg: Record<string, BikeInsightSlice>;
  districts: BikeDistrictRow[];
  byMonth: Record<string, BikeMonthBundle>;
};

export interface BikeAccidentInsights extends Omit<BikeInsightSlice, "total" | "deaths"> {
  meta: {
    source: string;
    period: string;
    total: number;
    deaths: number;
    sggList: string[];
    yearList: string[];
    role?: string;
    perpetratorTotal?: number;
    victimTotal?: number;
  };
  districts: BikeDistrictRow[];
  bySgg: Record<string, BikeInsightSlice>;
  byYear: Record<string, BikeYearBundle>;
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
