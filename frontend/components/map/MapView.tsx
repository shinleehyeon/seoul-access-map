"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { gapFill, pharmacyPinBucket } from "@/lib/color";
import type { DistrictStat, Pharmacy } from "@/lib/types";

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
const INTERACTIVE = ["pharm-clusters", "pharm-points", "districts-fill"];
const PIN_IDS = ["evening", "late", "normal"] as const;
const SUGGEST_PIN = "pin-suggest";

function roadviewUrl(lat: number, lon: number) {
  return `https://map.kakao.com/link/roadview/${lat},${lon}`;
}

async function ensurePinImages(map: MapLibreMap) {
  const jobs = [
    ...PIN_IDS.map((id) => ({ name: `pin-pharm-${id}`, url: `/markers/pin-pharm-${id}.png` })),
    { name: SUGGEST_PIN, url: `/markers/${SUGGEST_PIN}.png` },
  ];
  await Promise.all(
    jobs.map(async ({ name, url }) => {
      if (map.hasImage(name)) return;
      const result = await map.loadImage(url);
      if (!map.hasImage(name)) {
        map.addImage(name, result.data, { pixelRatio: 2 });
      }
    })
  );
}

function fmtClose(hhmm: number | null) {
  if (hhmm == null) return "—";
  return `${String(Math.floor(hhmm / 100)).padStart(2, "0")}:${String(hhmm % 100).padStart(2, "0")}`;
}

export function MapView({
  pharmacies,
  districtStats,
  selected,
  onSelect,
  detailOpen = false,
  gapFillStep = 0,
  focusSgg = null,
  dataKey = "all",
  visibleTypes = { evening: true, late: true, normal: true },
}: {
  pharmacies: Pharmacy[];
  districtStats: DistrictStat[];
  selected: Pharmacy | null;
  onSelect: (p: Pharmacy | null) => void;
  detailOpen?: boolean;
  /** 공백 점수 높은 구부터 N개만 색칠 (0=없음) */
  gapFillStep?: number;
  /** 필터된 자치구 — 지도 포커스 + 추천 위치 범위 */
  focusSgg?: string | null;
  /** 저녁·심야 필터가 꺼졌을 때 핀 색상이 남는 것을 막기 위한 활성 타입 */
  visibleTypes?: { evening: boolean; late: boolean; normal: boolean };
  /** 필터 변경 시 클러스터 소스 강제 리마운트 */
  dataKey?: string;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const didInitialFlyRef = useRef(false);
  const hoverClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupHoverRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const [districtGeo, setDistrictGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [coverage, setCoverage] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showUncovered, setShowUncovered] = useState(false);
  const [iconsReady, setIconsReady] = useState(false);
  const [hovered, setHovered] = useState<Pharmacy | null>(null);
  const [cursor, setCursor] = useState("grab");
  /** 지도에서 클릭해 색칠한 구 */
  const [paintedSggs, setPaintedSggs] = useState<string[]>([]);
  const [inspectedSgg, setInspectedSgg] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, Pharmacy>();
    for (const p of pharmacies) m.set(p.id, p);
    return m;
  }, [pharmacies]);

  const bySgg = useMemo(() => {
    const m = new Map<string, DistrictStat>();
    for (const d of districtStats) m.set(d.sgg, d);
    return m;
  }, [districtStats]);

  const pointsGeo = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: pharmacies.map((p) => ({
        type: "Feature",
        properties: {
          id: p.id,
          pin: `pin-pharm-${pharmacyPinBucket(p, visibleTypes)}`,
          name: p.name,
        },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    };
  }, [pharmacies, visibleTypes]);

  const autoHighlighted = useMemo(() => {
    if (gapFillStep <= 0) return new Set<string>();
    return new Set(
      [...districtStats]
        .sort((a, b) => b.gapScore - a.gapScore)
        .slice(0, gapFillStep)
        .map((d) => d.sgg)
    );
  }, [districtStats, gapFillStep]);

  const paintedSet = useMemo(() => new Set(paintedSggs), [paintedSggs]);

  const fillColorExpr = useMemo(() => {
    const expr: unknown[] = ["match", ["get", "name"]];
    for (const d of districtStats) {
      const on = paintedSet.has(d.sgg) || autoHighlighted.has(d.sgg);
      expr.push(d.sgg, on ? gapFill(d.gapScore) : "#e5e7eb");
    }
    expr.push("#e5e7eb");
    return expr;
  }, [districtStats, paintedSet, autoHighlighted]);

  const anyPainted = paintedSggs.length > 0 || gapFillStep > 0;

  const inspected = inspectedSgg ? bySgg.get(inspectedSgg) ?? null : null;

  useEffect(() => {
    fetch("/data/seoul_districts.json")
      .then((r) => r.json())
      .then(setDistrictGeo)
      .catch(() => setDistrictGeo(null));
  }, []);

  useEffect(() => {
    fetch("/data/coverage_samples.json")
      .then((r) => r.json())
      .then(
        (data: {
          points: { lon: number; lat: number; uncovered: boolean; nearestM: number; sgg?: string }[];
        }) => {
          const features = (data.points ?? [])
            .filter((p) => p.uncovered && (!focusSgg || p.sgg === focusSgg))
            .map((p) => ({
              type: "Feature" as const,
              properties: { nearestM: p.nearestM },
              geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
            }));
          setCoverage({ type: "FeatureCollection", features });
        }
      )
      .catch(() => setCoverage(null));
  }, [focusSgg]);

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
    // 딥링크(초기 진입 시 선택된 약국)만 지도를 이동시키고, 이후 "자세히 보기" 클릭 등
    // 사용자가 이미 보고 있는 화면(줌 포함)은 그대로 유지한다.
    if (selected && !didInitialFlyRef.current) {
      didInitialFlyRef.current = true;
      mapRef.current?.flyTo({ center: [selected.lon, selected.lat], zoom: 14, duration: 800 });
    }
  }, [selected]);

  useEffect(() => {
    if (!detailOpen) return;
    if (hoverClearRef.current) clearTimeout(hoverClearRef.current);
    popupHoverRef.current = false;
    hoveredIdRef.current = null;
    setHovered(null);
  }, [detailOpen]);

  const cancelHoverClear = useCallback(() => {
    if (hoverClearRef.current) {
      clearTimeout(hoverClearRef.current);
      hoverClearRef.current = null;
    }
  }, []);

  const clearHover = useCallback(() => {
    cancelHoverClear();
    popupHoverRef.current = false;
    hoveredIdRef.current = null;
    setHovered(null);
  }, [cancelHoverClear]);

  useEffect(() => {
    // 필터 바뀌면 이전 호버/팝업·잔상 클러스터 제거
    clearHover();
  }, [dataKey, clearHover]);

  /** 핀→팝업 이동 시 빈 공간을 건널 수 있게 유지 */
  const scheduleHoverClear = useCallback(() => {
    cancelHoverClear();
    hoverClearRef.current = setTimeout(() => {
      if (!popupHoverRef.current) clearHover();
    }, 220);
  }, [cancelHoverClear, clearHover]);

  const pick = useCallback(
    (e: MapLayerMouseEvent) => {
      const f = e.features?.find((x) => x.layer.id === "pharm-points");
      const id = f?.properties?.id as string | undefined;
      return id ? (byId.get(id) ?? null) : null;
    },
    [byId]
  );

  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (detailOpen) return;
      if (e.features?.some((x) => x.layer.id === "pharm-clusters")) {
        setCursor("pointer");
        if (!popupHoverRef.current) clearHover();
        return;
      }
      const rec = pick(e);
      const onDistrict = e.features?.some((x) => x.layer.id === "districts-fill");
      setCursor(rec || onDistrict ? "pointer" : "grab");
      if (rec) {
        cancelHoverClear();
        if (hoveredIdRef.current !== rec.id) {
          hoveredIdRef.current = rec.id;
          setHovered(rec);
        }
      } else if (!popupHoverRef.current) {
        scheduleHoverClear();
      }
    },
    [cancelHoverClear, clearHover, detailOpen, pick, scheduleHoverClear]
  );

  const onClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      if (detailOpen) return;
      const cluster = e.features?.find((x) => x.layer.id === "pharm-clusters");
      if (cluster && cluster.properties?.cluster_id != null) {
        const map = mapRef.current?.getMap();
        const source = map?.getSource("pharm-points") as GeoJSONSource | undefined;
        if (map && source) {
          const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id as number);
          const [lon, lat] = (cluster.geometry as GeoJSON.Point).coordinates;
          map.easeTo({ center: [lon, lat], zoom });
        }
        return;
      }
      const rec = pick(e);
      if (rec) {
        onSelect(rec);
        return;
      }
      const district = e.features?.find((x) => x.layer.id === "districts-fill");
      const name = district?.properties?.name as string | undefined;
      if (!name) return;
      const wasPainted = paintedSggs.includes(name);
      setInspectedSgg(wasPainted ? null : name);
      setPaintedSggs((prev) =>
        wasPainted ? prev.filter((s) => s !== name) : [...prev, name]
      );
    },
    [detailOpen, onSelect, paintedSggs, pick]
  );

  const popup = detailOpen ? null : hovered;
  const selectedId = selected?.id ?? "";

  return (
    <>
      <MapGL
        ref={mapRef}
        initialViewState={SEOUL_CENTER}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        cursor={detailOpen ? "default" : cursor}
        interactiveLayerIds={detailOpen ? [] : INTERACTIVE}
        onLoad={async () => {
          const map = mapRef.current?.getMap();
          if (!map) return;
          try {
            await ensurePinImages(map);
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
                if (!popupHoverRef.current) clearHover();
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

        {coverage && showUncovered && iconsReady && (
          <Source id="uncovered" type="geojson" data={coverage}>
            <Layer
              id="suggest-pins"
              type="symbol"
              layout={{
                "icon-image": SUGGEST_PIN,
                "icon-size": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  10,
                  0.1,
                  14,
                  0.14,
                ],
                "icon-anchor": "bottom",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
            />
          </Source>
        )}

        <Source
          id="pharm-points"
          key={dataKey}
          type="geojson"
          data={pointsGeo}
          cluster
          clusterMaxZoom={13}
          clusterRadius={50}
        >
          <Layer
            id="pharm-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": ["step", ["get", "point_count"], "#5eead4", 20, "#14b8a6", 60, "#0f766e"],
              "circle-radius": ["step", ["get", "point_count"], 18, 20, 24, 60, 30],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="pharm-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 16,
              "text-font": ["Open Sans Bold", "Open Sans Regular"],
            }}
            paint={{ "text-color": "#ffffff" }}
          />
          {iconsReady && (
            <Layer
              id="pharm-points"
              type="symbol"
              filter={["!", ["has", "point_count"]]}
              layout={{
                "icon-image": ["get", "pin"],
                "icon-size": [
                  "case",
                  ["==", ["get", "id"], selectedId],
                  0.16,
                  0.12,
                ],
                "icon-anchor": "bottom",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
            />
          )}
        </Source>

        {popup && (
          <Popup
            longitude={popup.lon}
            latitude={popup.lat}
            anchor="bottom"
            offset={12}
            maxWidth="360px"
            closeButton={false}
            closeOnClick={false}
            className="halflife-popup"
          >
            <div
              className="w-[340px] overflow-hidden rounded-lg"
              onMouseEnter={() => {
                popupHoverRef.current = true;
                cancelHoverClear();
              }}
              onMouseLeave={() => {
                popupHoverRef.current = false;
                clearHover();
              }}
            >
              <div className="p-3">
                <p className="text-sm font-semibold">{popup.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">{popup.sgg}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {popup.isEvening && <Badge variant="secondary">저녁 21시+</Badge>}
                  {popup.isLateNight && <Badge variant="secondary">심야 22시+</Badge>}
                  <Badge variant="outline">평일 마감 {fmtClose(popup.maxWeekdayClose)}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 border-t">
                <Button
                  variant="ghost"
                  className="rounded-none text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(popup);
                  }}
                >
                  자세히 보기
                </Button>
                <Button asChild variant="ghost" className="rounded-none border-l text-sm">
                  <a
                    href={roadviewUrl(popup.lat, popup.lon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    로드뷰
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </div>
          </Popup>
        )}
      </MapGL>

      <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[280px] flex-col gap-1.5 rounded-xl border bg-background/90 p-3 text-xs shadow-lg backdrop-blur-md">
        {inspected ? (
          <div className="mt-1 rounded-lg border bg-background/80 p-2.5">
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-3.5 shrink-0 rounded-sm border"
                style={{ background: gapFill(inspected.gapScore) }}
              />
              <span className="font-semibold">{inspected.sgg}</span>
              {paintedSet.has(inspected.sgg) || autoHighlighted.has(inspected.sgg) ? (
                <span className="text-muted-foreground">색칠됨</span>
              ) : (
                <span className="text-muted-foreground">해제됨</span>
              )}
            </div>
            <div className="text-muted-foreground mt-1.5 space-y-0.5">
              <div>
                공백 점수 <span className="text-foreground font-medium">{inspected.gapScore}</span>
                {" · "}
                공백 {(inspected.uncoveredShare * 100).toFixed(1)}%
              </div>
              <div>
                저녁 약국 {inspected.eveningCount}곳 · 추정 공백인구{" "}
                {inspected.estUncoveredPop.toLocaleString()}명
              </div>
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
            필터: 공백 상위 {Math.min(gapFillStep, 25)}개 구도 함께 표시 중
          </div>
        ) : null}
        <label className="mt-1 flex cursor-pointer items-center gap-1.5">
          <Checkbox checked={showUncovered} onCheckedChange={(v) => setShowUncovered(v === true)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-suggest.png" alt="" className="h-5 w-5 object-contain" />
          저녁 약국이 있으면 좋을 위치
        </label>
        <div className="mt-1 flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-pharm-evening.png" alt="" className="h-5 w-5 object-contain" />
          저녁 약국 (21시+)
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-pharm-late.png" alt="" className="h-5 w-5 object-contain" />
          심야 약국 (22시+)
        </div>
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/markers/pin-pharm-normal.png" alt="" className="h-5 w-5 object-contain" />
          일반 약국
        </div>
      </div>
    </>
  );
}
