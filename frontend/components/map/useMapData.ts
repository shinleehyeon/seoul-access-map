import { useEffect, useState } from "react";
import type { BikeAccidentInsights } from "@/lib/types";

export type DistrictMetric = BikeAccidentInsights["districts"][number];

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

/** 지도에 필요한 정적 데이터(구 경계, 사고 핀, 보호구역, 자전거도로, 인사이트)를 한 번씩 로드한다. */
export function useMapData() {
  const districtGeo = useGeoJson("/data/seoul_districts.json");
  const accidentGeo = useGeoJson("/data/accident_points.json");
  const childZoneGeo = useGeoJson("/data/child_zone_points.json");
  const elderlyZoneGeo = useGeoJson("/data/elderly_zone_points.json");
  const bikeRoadGeo = useGeoJson("/data/bike_road_polygons.json");

  const [insights, setInsights] = useState<BikeAccidentInsights | null>(null);
  useEffect(() => {
    fetch("/data/bike_accident_insights.json")
      .then((r) => r.json())
      .then((d: BikeAccidentInsights) => setInsights(d))
      .catch(() => setInsights(null));
  }, []);

  return {
    districtGeo,
    accidentGeo,
    childZoneGeo,
    elderlyZoneGeo,
    bikeRoadGeo,
    insights,
  };
}
