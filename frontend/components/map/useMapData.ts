import { useEffect, useState } from "react";
import type { CrimeCctvStat } from "@/lib/types";

function useGeoJson(url: string) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [url]);
  return data;
}

/** 지도에 필요한 정적 데이터(구 경계, 통계, 사고 핀, 보호구역, 자전거도로)를 한 번씩 로드한다. */
export function useMapData() {
  const districtGeo = useGeoJson("/data/seoul_districts.json");
  const accidentGeo = useGeoJson("/data/accident_points.json");
  const childZoneGeo = useGeoJson("/data/child_zone_points.json");
  const elderlyZoneGeo = useGeoJson("/data/elderly_zone_points.json");
  const bikeRoadGeo = useGeoJson("/data/bike_road_polygons.json");

  const [crimeStats, setCrimeStats] = useState<CrimeCctvStat[]>([]);
  useEffect(() => {
    fetch("/data/crime_cctv_stats.json")
      .then((r) => r.json())
      .then(setCrimeStats)
      .catch(() => setCrimeStats([]));
  }, []);

  return { districtGeo, accidentGeo, childZoneGeo, elderlyZoneGeo, bikeRoadGeo, crimeStats };
}
