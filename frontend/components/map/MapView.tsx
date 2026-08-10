"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gapFill } from "@/lib/color";
import type { Pharmacy } from "@/lib/types";

const ACCIDENT_ICON_BY_TYPE: Record<string, string> = {
  자전거: "pin-accident-bike",
  보행노인: "pin-accident-elderly",
  보행어린이: "pin-accident-child",
  스쿨존어린이: "pin-accident-child",
};
const ACCIDENT_FILTER_KEY_BY_TYPE: Record<string, "bike" | "elderly" | "child"> = {
  자전거: "bike",
  보행노인: "elderly",
  보행어린이: "child",
  스쿨존어린이: "child",
};
const ACCIDENT_ICONS = ["pin-accident-bike", "pin-accident-elderly", "pin-accident-child"] as const;

function roadviewUrl(lat: number, lon: number) {
  return `https://map.kakao.com/link/roadview/${lat},${lon}`;
}

async function ensureAccidentIcons(map: MapLibreMap) {
  await Promise.all(
    ACCIDENT_ICONS.map(async (name) => {
      if (map.hasImage(name)) return;
      const result = await map.loadImage(`/markers/${name}.png`);
      if (!map.hasImage(name)) {
        map.addImage(name, result.data, { pixelRatio: 2 });
      }
    })
  );
}

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "carto-positron": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: "carto-positron-layer", type: "raster", source: "carto-positron" }],
};

const SEOUL_CENTER = { longitude: 126.978, latitude: 37.5665, zoom: 11 };
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface CrimeCctvStat {
  sgg: string;
  population: number;
  accidentCount: number;
  accidentPer10k: number;
  bikeAccidentCount: number;
  /** 지도에 찍히는 자전거 사고다발지점 핀 수 (발생 건수와 별개) */
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
  bikeOnRoadRate?: number | null;
  bikeOnRoadSample?: number;
  childInZoneRate?: number | null;
  childInZoneSample?: number;
  elderlyInZoneRate?: number | null;
  elderlyInZoneSample?: number;
  bikeScore: number;
  childScore: number;
  elderlyScore: number;
  gapScore: number;
}

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={highlight ? "text-sm font-semibold" : "text-xs font-medium"}>{value}</span>
    </div>
  );
}

function OnInfraVerdict({
  rate,
  sample,
  onLabel,
  offLabel,
  lowConfidence = false,
}: {
  rate: number;
  sample?: number;
  onLabel: string;
  offLabel: string;
  lowConfidence?: boolean;
}) {
  const onInfra = rate >= 50;
  return (
    <div className="border-t pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">인프라 위/근처 발생 비율</span>
        <span className="text-sm font-semibold">{rate}%</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            onInfra ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"
          }`}
        >
          {onInfra ? onLabel : offLabel}
        </span>
        <span className="text-muted-foreground text-[10px]">
          표본 {sample ?? 0}곳{lowConfidence ? " · 참고용" : ""}
        </span>
      </div>
    </div>
  );
}

export function MapView({
  selected,
  detailOpen = false,
  gapFillStep = 0,
  focusSgg = null,
  visibleAccidentTypes = { bike: true, elderly: true, child: true },
  showChildZones = false,
  showElderlyZones = false,
  showBikeRoads = false,
}: {
  pharmacies?: Pharmacy[];
  /** 약국 분석 시절 유산 - 더 이상 지도에서 안 쓰지만 호출부 호환을 위해 받아둔다 */
  districtStats?: unknown;
  visibleTypes?: unknown;
  selected?: Pharmacy | null;
  onSelect?: (p: Pharmacy | null) => void;
  detailOpen?: boolean;
  /** 위험도 점수 높은 구부터 N개만 색칠 (0=없음) */
  gapFillStep?: number;
  /** 필터된 자치구 — 지도 포커스 */
  focusSgg?: string | null;
  /** 사고유형별 지도 핀 표시 여부 */
  visibleAccidentTypes?: { bike: boolean; elderly: boolean; child: boolean };
  /** 어린이보호구역 표시 여부 */
  showChildZones?: boolean;
  /** 노인장애인보호구역 표시 여부 */
  showElderlyZones?: boolean;
  /** 자전거전용도로 표시 여부 */
  showBikeRoads?: boolean;
  dataKey?: string;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const [districtGeo, setDistrictGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [crimeStats, setCrimeStats] = useState<CrimeCctvStat[]>([]);
  const [accidentGeo, setAccidentGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [childZoneGeo, setChildZoneGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [elderlyZoneGeo, setElderlyZoneGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [bikeRoadGeo, setBikeRoadGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoveredAccident, setHoveredAccident] = useState<{
    name: string;
    accidentType: string;
    accidentCount: number;
    casualties: number;
    lon: number;
    lat: number;
  } | null>(null);
  const [hoveredChildZone, setHoveredChildZone] = useState<{
    key: string;
    name: string;
    facilityType: string;
    cctv: boolean;
    cctvCount: number;
    lon: number;
    lat: number;
  } | null>(null);
  const [hoveredElderlyZone, setHoveredElderlyZone] = useState<{
    key: string;
    name: string;
    facilityType: string;
    cctv: boolean;
    cctvCount: number;
    lon: number;
    lat: number;
  } | null>(null);
  const [hoveredBikeRoad, setHoveredBikeRoad] = useState<{
    key: string;
    name: string;
    lon: number;
    lat: number;
  } | null>(null);
  /** 팝업 위에 마우스가 있으면 호버 해제하지 않음 (로드뷰 클릭용) */
  const popupLockRef = useRef(false);
  const [cursor, setCursor] = useState("grab");
  const [iconsReady, setIconsReady] = useState(false);
  /** 지도에서 클릭해 색칠한 구 */
  const [paintedSggs, setPaintedSggs] = useState<string[]>([]);
  const [inspectedSgg, setInspectedSgg] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<"bike" | "child" | "elderly">(() => {
    if (typeof window === "undefined") return "bike";
    const saved = window.localStorage.getItem("map-color-mode");
    return saved === "bike" || saved === "child" || saved === "elderly" ? saved : "bike";
  });

  useEffect(() => {
    window.localStorage.setItem("map-color-mode", colorMode);
  }, [colorMode]);

  const scoreOf = (d: CrimeCctvStat) =>
    colorMode === "bike" ? d.bikeScore : colorMode === "child" ? d.childScore : d.elderlyScore;

  const bySgg = useMemo(() => {
    const m = new Map<string, CrimeCctvStat>();
    for (const d of crimeStats) m.set(d.sgg, d);
    return m;
  }, [crimeStats]);

  const accidentGeoFiltered = useMemo(() => {
    if (!accidentGeo) return null;
    const features = accidentGeo.features
      .filter((f) => !focusSgg || f.properties?.sgg === focusSgg)
      .filter((f) => {
        const key = ACCIDENT_FILTER_KEY_BY_TYPE[f.properties?.accidentType as string] ?? "bike";
        return visibleAccidentTypes[key];
      })
      .map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          icon: ACCIDENT_ICON_BY_TYPE[f.properties?.accidentType as string] ?? "pin-accident-bike",
        },
      }));
    return { ...accidentGeo, features };
  }, [accidentGeo, focusSgg, visibleAccidentTypes]);

  const interactiveLayerIds = useMemo(() => {
    const ids = ["districts-fill", "accident-points"];
    if (showChildZones) ids.push("child-zone-fill");
    if (showElderlyZones) ids.push("elderly-zone-fill");
    if (showBikeRoads) ids.push("bike-road-line");
    return ids;
  }, [showChildZones, showElderlyZones, showBikeRoads]);

  const childZoneGeoFiltered = useMemo(() => {
    if (!childZoneGeo || !showChildZones) return EMPTY_FC;
    if (!focusSgg) return childZoneGeo;
    return {
      ...childZoneGeo,
      features: childZoneGeo.features.filter((f) => f.properties?.sgg === focusSgg),
    };
  }, [childZoneGeo, focusSgg, showChildZones]);

  const elderlyZoneGeoFiltered = useMemo(() => {
    if (!elderlyZoneGeo || !showElderlyZones) return EMPTY_FC;
    if (!focusSgg) return elderlyZoneGeo;
    return {
      ...elderlyZoneGeo,
      features: elderlyZoneGeo.features.filter((f) => f.properties?.sgg === focusSgg),
    };
  }, [elderlyZoneGeo, focusSgg, showElderlyZones]);

  const bikeRoadGeoFiltered = useMemo(() => {
    if (!bikeRoadGeo || !showBikeRoads) return EMPTY_FC;
    if (!focusSgg) return bikeRoadGeo;
    return {
      ...bikeRoadGeo,
      features: bikeRoadGeo.features.filter((f) => f.properties?.sgg === focusSgg),
    };
  }, [bikeRoadGeo, focusSgg, showBikeRoads]);

  const autoHighlighted = useMemo(() => {
    if (gapFillStep <= 0) return new Set<string>();
    return new Set(
      [...crimeStats]
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, gapFillStep)
        .map((d) => d.sgg)
    );
  }, [crimeStats, gapFillStep, colorMode]);

  const paintedSet = useMemo(() => new Set(paintedSggs), [paintedSggs]);

  const fillColorExpr = useMemo(() => {
    const expr: unknown[] = ["match", ["get", "name"]];
    for (const d of crimeStats) {
      const on = paintedSet.has(d.sgg) || autoHighlighted.has(d.sgg);
      expr.push(d.sgg, on ? gapFill(scoreOf(d)) : "#e5e7eb");
    }
    expr.push("#e5e7eb");
    return expr;
  }, [crimeStats, paintedSet, autoHighlighted, colorMode]);

  const anyPainted = paintedSggs.length > 0 || gapFillStep > 0;

  const inspected = inspectedSgg ? (bySgg.get(inspectedSgg) ?? null) : null;

  useEffect(() => {
    fetch("/data/seoul_districts.json")
      .then((r) => r.json())
      .then(setDistrictGeo)
      .catch(() => setDistrictGeo(null));
  }, []);

  useEffect(() => {
    fetch("/data/crime_cctv_stats.json")
      .then((r) => r.json())
      .then(setCrimeStats)
      .catch(() => setCrimeStats([]));
  }, []);

  useEffect(() => {
    fetch("/data/accident_points.json")
      .then((r) => r.json())
      .then(setAccidentGeo)
      .catch(() => setAccidentGeo(null));
  }, []);

  useEffect(() => {
    fetch("/data/child_zone_points.json")
      .then((r) => r.json())
      .then(setChildZoneGeo)
      .catch(() => setChildZoneGeo(null));
  }, []);

  useEffect(() => {
    fetch("/data/elderly_zone_points.json")
      .then((r) => r.json())
      .then(setElderlyZoneGeo)
      .catch(() => setElderlyZoneGeo(null));
  }, []);

  useEffect(() => {
    fetch("/data/bike_road_polygons.json")
      .then((r) => r.json())
      .then(setBikeRoadGeo)
      .catch(() => setBikeRoadGeo(null));
  }, []);

  useEffect(() => {
    if (!focusSgg || !districtGeo) return;
    const feat = districtGeo.features.find((f) => f.properties?.name === focusSgg);
    if (!feat?.geometry) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    const walk = (coords: unknown): void => {
      if (!Array.isArray(coords) || coords.length === 0) return;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        const lon = coords[0] as number;
        const lat = coords[1] as number;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        return;
      }
      for (const c of coords) walk(c);
    };
    walk((feat.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
    if (!Number.isFinite(minLon)) return;
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: 48, duration: 700, maxZoom: 13 }
    );
  }, [focusSgg, districtGeo]);

  useEffect(() => {
    if (selected) {
      mapRef.current?.flyTo({ center: [selected.lon, selected.lat], zoom: 14, duration: 800 });
    }
  }, [selected]);

  const clearZoneHovers = () => {
    if (popupLockRef.current) return;
    setHoveredChildZone(null);
    setHoveredElderlyZone(null);
    setHoveredBikeRoad(null);
  };

  const onMouseMove = (e: MapLayerMouseEvent) => {
    if (detailOpen) return;
    const accidentFeat = e.features?.find((x) => x.layer.id === "accident-points");
    if (accidentFeat) {
      setCursor("pointer");
      clearZoneHovers();
      popupLockRef.current = false;
      const [lon, lat] = (accidentFeat.geometry as GeoJSON.Point).coordinates;
      setHoveredAccident({
        name: (accidentFeat.properties?.name as string) ?? "",
        accidentType: (accidentFeat.properties?.accidentType as string) ?? "",
        accidentCount: (accidentFeat.properties?.accidentCount as number) ?? 0,
        casualties: (accidentFeat.properties?.casualties as number) ?? 0,
        lon,
        lat,
      });
      return;
    }
    setHoveredAccident(null);
    const childZoneFeat = e.features?.find((x) => x.layer.id === "child-zone-fill");
    if (childZoneFeat) {
      setCursor("pointer");
      setHoveredElderlyZone(null);
      setHoveredBikeRoad(null);
      const name = (childZoneFeat.properties?.name as string) ?? "";
      const key = `${childZoneFeat.properties?.sgg ?? ""}:${name}`;
      setHoveredChildZone((prev) =>
        prev?.key === key
          ? prev
          : {
              key,
              name,
              facilityType: (childZoneFeat.properties?.facilityType as string) ?? "",
              cctv: Number(childZoneFeat.properties?.cctv) === 1,
              cctvCount: Number(childZoneFeat.properties?.cctvCount) || 0,
              lon: e.lngLat.lng,
              lat: e.lngLat.lat,
            }
      );
      return;
    }
    const elderlyZoneFeat = e.features?.find((x) => x.layer.id === "elderly-zone-fill");
    if (elderlyZoneFeat) {
      setCursor("pointer");
      setHoveredChildZone(null);
      setHoveredBikeRoad(null);
      const name = (elderlyZoneFeat.properties?.name as string) ?? "";
      const key = `${elderlyZoneFeat.properties?.sgg ?? ""}:${name}`;
      setHoveredElderlyZone((prev) =>
        prev?.key === key
          ? prev
          : {
              key,
              name,
              facilityType: (elderlyZoneFeat.properties?.facilityType as string) ?? "",
              cctv: Number(elderlyZoneFeat.properties?.cctv) === 1,
              cctvCount: Number(elderlyZoneFeat.properties?.cctvCount) || 0,
              lon: e.lngLat.lng,
              lat: e.lngLat.lat,
            }
      );
      return;
    }
    const bikeRoadFeat = e.features?.find((x) => x.layer.id === "bike-road-line");
    if (bikeRoadFeat) {
      setCursor("pointer");
      setHoveredChildZone(null);
      setHoveredElderlyZone(null);
      const name = (bikeRoadFeat.properties?.name as string) ?? "자전거전용도로";
      const key = `${bikeRoadFeat.properties?.sgg ?? ""}:${name}`;
      setHoveredBikeRoad((prev) =>
        prev?.key === key
          ? prev
          : {
              key,
              name,
              lon: e.lngLat.lng,
              lat: e.lngLat.lat,
            }
      );
      return;
    }
    clearZoneHovers();
    const onDistrict = e.features?.some((x) => x.layer.id === "districts-fill");
    setCursor(onDistrict ? "pointer" : "grab");
  };

  const onClick = (e: MapLayerMouseEvent) => {
    if (detailOpen) return;
    const district = e.features?.find((x) => x.layer.id === "districts-fill");
    const name = district?.properties?.name as string | undefined;
    if (!name) return;
    const wasPainted = paintedSggs.includes(name);
    setInspectedSgg(wasPainted ? null : name);
    setPaintedSggs((prev) => (wasPainted ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  return (
    <>
      <MapGL
        ref={mapRef}
        initialViewState={SEOUL_CENTER}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        cursor={detailOpen ? "default" : cursor}
        interactiveLayerIds={detailOpen ? [] : interactiveLayerIds}
        onLoad={async () => {
          const map = mapRef.current?.getMap();
          if (!map) return;
          try {
            await ensureAccidentIcons(map);
            setIconsReady(true);
          } catch {
            setIconsReady(false);
          }
        }}
        onMouseMove={detailOpen ? undefined : onMouseMove}
        onMouseLeave={
          detailOpen
            ? undefined
            : () => {
                setCursor("grab");
                setHoveredAccident(null);
                if (!popupLockRef.current) {
                  setHoveredChildZone(null);
                  setHoveredElderlyZone(null);
                  setHoveredBikeRoad(null);
                }
              }
        }
        onClick={detailOpen ? undefined : onClick}
      >
        <NavigationControl position="top-right" />

        {districtGeo && (
          <Source id="districts" type="geojson" data={districtGeo}>
            <Layer
              id="districts-fill"
              type="fill"
              paint={{
                "fill-color": fillColorExpr as unknown as string,
                "fill-opacity": anyPainted ? 0.6 : 0.14,
              }}
            />
            <Layer
              id="districts-outline"
              type="line"
              paint={{
                "line-color": anyPainted ? "#fff" : "#94a3b8",
                "line-width": anyPainted ? 1.2 : 1,
              }}
            />
          </Source>
        )}

        {bikeRoadGeo && (
          <Source id="bike-roads" type="geojson" data={bikeRoadGeoFiltered} tolerance={0}>
            <Layer
              id="bike-road-line"
              type="line"
              layout={{
                visibility: showBikeRoads ? "visible" : "none",
                "line-join": "round",
                "line-cap": "round",
              }}
              paint={{
                "line-color": "#eab308",
                "line-opacity": 0.95,
                // 줌 아웃에서도 보이도록 두께를 줌에 맞춰 키움
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  9,
                  1.2,
                  12,
                  2.5,
                  15,
                  5,
                  17,
                  8,
                ],
              }}
            />
          </Source>
        )}

        {childZoneGeo && (
          <Source id="child-zones" type="geojson" data={childZoneGeoFiltered} tolerance={0}>
            <Layer
              id="child-zone-fill"
              type="fill"
              layout={{ visibility: showChildZones ? "visible" : "none" }}
              paint={{
                "fill-color": "#f59e0b",
                "fill-opacity": 0.22,
              }}
            />
            <Layer
              id="child-zone-outline"
              type="line"
              layout={{ visibility: showChildZones ? "visible" : "none" }}
              paint={{
                "line-color": "#b45309",
                "line-width": 1.2,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {elderlyZoneGeo && (
          <Source id="elderly-zones" type="geojson" data={elderlyZoneGeoFiltered} tolerance={0}>
            <Layer
              id="elderly-zone-fill"
              type="fill"
              layout={{ visibility: showElderlyZones ? "visible" : "none" }}
              paint={{
                "fill-color": "#8b5cf6",
                "fill-opacity": 0.22,
              }}
            />
            <Layer
              id="elderly-zone-outline"
              type="line"
              layout={{ visibility: showElderlyZones ? "visible" : "none" }}
              paint={{
                "line-color": "#5b21b6",
                "line-width": 1.2,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {accidentGeoFiltered && iconsReady && (
          <Source id="accidents" type="geojson" data={accidentGeoFiltered}>
            <Layer
              id="accident-points"
              type="symbol"
              layout={{
                "icon-image": ["get", "icon"],
                "icon-size": [
                  "match",
                  ["get", "icon"],
                  "pin-accident-elderly",
                  0.13,
                  0.1,
                ],
                "icon-anchor": "bottom",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                visibility: accidentGeoFiltered.features.length > 0 ? "visible" : "none",
              }}
            />
          </Source>
        )}

        {hoveredAccident && (
          <Popup
            longitude={hoveredAccident.lon}
            latitude={hoveredAccident.lat}
            anchor="bottom"
            offset={10}
            closeButton={false}
            closeOnClick={false}
          >
            <div
              className="w-[220px] p-2 text-xs"
              onMouseEnter={() => {
                popupLockRef.current = true;
              }}
              onMouseLeave={() => {
                popupLockRef.current = false;
                setHoveredAccident(null);
              }}
            >
              <p className="font-semibold">{hoveredAccident.name}</p>
              <p className="text-muted-foreground mt-0.5">
                {hoveredAccident.accidentType} · 사고 {hoveredAccident.accidentCount}건 · 사상자{" "}
                {hoveredAccident.casualties}명
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a
                  href={roadviewUrl(hoveredAccident.lat, hoveredAccident.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  로드뷰 보기
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </Popup>
        )}

        {!hoveredAccident && hoveredChildZone && (
          <Popup
            longitude={hoveredChildZone.lon}
            latitude={hoveredChildZone.lat}
            anchor="bottom"
            offset={8}
            closeButton={false}
            closeOnClick={false}
          >
            <div
              className="w-[220px] p-2 text-xs"
              onMouseEnter={() => {
                popupLockRef.current = true;
              }}
              onMouseLeave={() => {
                popupLockRef.current = false;
                setHoveredChildZone(null);
              }}
            >
              <p className="font-semibold">{hoveredChildZone.name}</p>
              <p className="text-muted-foreground mt-0.5">
                어린이보호구역 · {hoveredChildZone.facilityType} · 도로 따라 300m
              </p>
              <p className="text-muted-foreground mt-0.5">
                CCTV {hoveredChildZone.cctv ? `설치 (${hoveredChildZone.cctvCount}대)` : "미설치"}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a
                  href={roadviewUrl(hoveredChildZone.lat, hoveredChildZone.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  로드뷰 보기
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </Popup>
        )}

        {!hoveredAccident && !hoveredChildZone && hoveredElderlyZone && (
          <Popup
            longitude={hoveredElderlyZone.lon}
            latitude={hoveredElderlyZone.lat}
            anchor="bottom"
            offset={8}
            closeButton={false}
            closeOnClick={false}
          >
            <div
              className="w-[220px] p-2 text-xs"
              onMouseEnter={() => {
                popupLockRef.current = true;
              }}
              onMouseLeave={() => {
                popupLockRef.current = false;
                setHoveredElderlyZone(null);
              }}
            >
              <p className="font-semibold">{hoveredElderlyZone.name}</p>
              <p className="text-muted-foreground mt-0.5">
                노인장애인보호구역 · 도로 따라 300m
              </p>
              <p className="text-muted-foreground mt-0.5">
                CCTV {hoveredElderlyZone.cctv ? `설치 (${hoveredElderlyZone.cctvCount}대)` : "미설치"}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a
                  href={roadviewUrl(hoveredElderlyZone.lat, hoveredElderlyZone.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  로드뷰 보기
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </Popup>
        )}

        {!hoveredAccident && !hoveredChildZone && !hoveredElderlyZone && hoveredBikeRoad && (
          <Popup
            longitude={hoveredBikeRoad.lon}
            latitude={hoveredBikeRoad.lat}
            anchor="bottom"
            offset={8}
            closeButton={false}
            closeOnClick={false}
          >
            <div
              className="w-[200px] p-2 text-xs"
              onMouseEnter={() => {
                popupLockRef.current = true;
              }}
              onMouseLeave={() => {
                popupLockRef.current = false;
                setHoveredBikeRoad(null);
              }}
            >
              <p className="font-semibold">{hoveredBikeRoad.name}</p>
              <p className="text-muted-foreground mt-0.5">OSM 자전거전용도로</p>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a
                  href={roadviewUrl(hoveredBikeRoad.lat, hoveredBikeRoad.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  로드뷰 보기
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </Popup>
        )}
      </MapGL>

      <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[280px] flex-col gap-1.5 rounded-xl border bg-background/90 p-3 text-xs shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
              colorMode === "bike" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => setColorMode("bike")}
          >
            자전거
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
              colorMode === "child" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => setColorMode("child")}
          >
            어린이
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
              colorMode === "elderly" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => setColorMode("elderly")}
          >
            노인
          </button>
        </div>
        {inspected ? (
          <div className="mt-1 overflow-hidden rounded-lg border bg-background/80">
            <div
              className="flex items-baseline justify-between px-3 py-2.5"
              style={{ background: gapFill(scoreOf(inspected)), color: "#fff" }}
            >
              <div>
                <p className="text-[11px] font-medium opacity-90">
                  {inspected.sgg} ·{" "}
                  {colorMode === "bike" ? "자전거" : colorMode === "child" ? "어린이" : "노인"} 위험
                  점수
                </p>
                <p className="text-2xl leading-tight font-bold">{scoreOf(inspected)}</p>
              </div>
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium">
                {paintedSet.has(inspected.sgg) || autoHighlighted.has(inspected.sgg)
                  ? "색칠됨"
                  : "해제됨"}
              </span>
            </div>

            <div className="space-y-2 px-3 py-2.5">
              {colorMode === "bike" && (
                <>
                  <StatRow label="연간 자전거사고" value={`${inspected.bikeAccidentCount}건`} />
                  <StatRow label="자전거도로" value={`${inspected.bikeRoadKm}km`} />
                  <StatRow
                    label="도로 1km당 사고"
                    value={inspected.bikeAccidentPerRoadKm}
                    highlight
                  />
                  <StatRow
                    label="지도 다발지점"
                    value={`${inspected.bikeHotspotCount ?? 0}곳 / 전체 ${inspected.accidentCount}곳`}
                  />
                  {inspected.bikeOnRoadRate != null && (
                    <OnInfraVerdict
                      rate={inspected.bikeOnRoadRate}
                      sample={inspected.bikeOnRoadSample}
                      onLabel="도로 설계 문제"
                      offLabel="인프라 부재 문제"
                    />
                  )}
                </>
              )}
              {colorMode === "child" && (
                <>
                  <StatRow
                    label="연간 보행 어린이사고"
                    value={`${inspected.childAccidentCount}건`}
                  />
                  <StatRow label="어린이보호구역" value={`${inspected.childZoneCount}곳`} />
                  <StatRow
                    label="보호구역 100곳당 사고"
                    value={inspected.childAccidentPerZone}
                    highlight
                  />
                  {inspected.childInZoneRate != null && (
                    <OnInfraVerdict
                      rate={inspected.childInZoneRate}
                      sample={inspected.childInZoneSample}
                      onLabel="보호구역 안에서 발생"
                      offLabel="보호구역 밖에서 발생"
                      lowConfidence
                    />
                  )}
                </>
              )}
              {colorMode === "elderly" && (
                <>
                  <StatRow
                    label="연간 보행 노인사고"
                    value={`${inspected.elderlyAccidentCount}건`}
                  />
                  <StatRow
                    label="인구 1만명당 사고"
                    value={inspected.elderlyAccidentPer10k}
                    highlight
                  />
                  <StatRow label="노인장애인보호구역" value={`${inspected.elderlyZoneCount}곳`} />
                  {inspected.elderlyInZoneRate != null && (
                    <OnInfraVerdict
                      rate={inspected.elderlyInZoneRate}
                      sample={inspected.elderlyInZoneSample}
                      onLabel="보호구역 안에서 발생"
                      offLabel="보호구역 밖에서 발생"
                      lowConfidence
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
        {paintedSggs.length > 0 ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-0.5 text-left underline-offset-2 hover:underline"
            onClick={() => {
              setPaintedSggs([]);
              setInspectedSgg(null);
            }}
          >
            클릭 색칠 모두 지우기 ({paintedSggs.length})
          </button>
        ) : null}
        {gapFillStep > 0 ? (
          <div className="text-muted-foreground">
            필터: 위험 상위 {Math.min(gapFillStep, 25)}개 구도 함께 표시 중
          </div>
        ) : null}
        <div className="text-muted-foreground mt-1">
          {colorMode === "bike"
            ? ""
            : colorMode === "child"
              ? ""
              : ""}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#a16207] bg-[#eab308]/55" />
          자전거전용도로
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#b45309] bg-[#f59e0b]/55" />
          어린이보호구역 (도로 연결)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 shrink-0 rounded-sm border border-[#5b21b6] bg-[#8b5cf6]/55" />
          노인장애인보호구역 (도로 연결)
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-bike.png" alt="" className="h-6 w-6 object-contain" />
          자전거 사고다발지점
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-elderly.png" alt="" className="h-7 w-7 object-contain" />
          보행노인 사고다발지점
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-accident-child.png" alt="" className="h-6 w-6 object-contain" />
          보행/스쿨존 어린이 사고다발지점
        </div>
      </div>
    </>
  );
}
