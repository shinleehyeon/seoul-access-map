"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { NavigationControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import type { CrimeCctvStat } from "@/lib/types";
import { ACCIDENT_FILTER_KEY_BY_TYPE, ACCIDENT_ICON_BY_TYPE, BIKE_ACCIDENT_ICON_BY_SEVERITY, EMPTY_FC, MAP_STYLE, SEOUL_CENTER, ensureAccidentIcons } from "@/lib/mapConstants";
import { gapFill } from "@/lib/color";
import { useMapData } from "./useMapData";
import { AccidentDetailDialog, MapHoverPopup, useMapHover } from "./MapHoverPopup";
import { AccidentLayer, BikeAccidentClusterLayer, BikeRoadLayer, DistrictLayer, ZoneLayer } from "./MapLayers";
import { ColorModeTabs, DistrictInspectorCard, MapLegend, type ColorMode } from "./MapInspectorPanel";
import { DEFAULT_SEVERITY_FILTER, type SeverityFilter } from "@/components/sidebar/FilterSidebar";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

export function MapView({
  detailOpen = false,
  gapFillStep = 0,
  focusSgg = null,
  visibleAccidentTypes = { bike: true, elderly: true, child: true },
  showChildZones = false,
  showElderlyZones = false,
  showBikeRoads = false,
  bikeAccidentYearRange = [2020, 2024],
  visibleSeverities = DEFAULT_SEVERITY_FILTER,
}: {
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
  /** 자전거 사고 핀(acdntYear)에 적용되는 연도 범위 [min, max] 포함 */
  bikeAccidentYearRange?: [number, number];
  /** true면 자전거 사망사고만 지도에 표시 */
  /** 자전거 사고 핀(severity)에 적용되는 피해정도 필터. false인 값은 지도에서 숨김 */
  visibleSeverities?: SeverityFilter;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const { districtGeo, accidentGeo, childZoneGeo, elderlyZoneGeo, bikeRoadGeo, crimeStats } =
    useMapData();
  const {
    hover,
    popupLockRef,
    onMouseMove: hoverOnMouseMove,
    onMouseLeave: hoverOnMouseLeave,
    detailAccident,
    openDetail,
    closeDetail,
  } = useMapHover();

  const [cursor, setCursor] = useState("grab");
  const [iconsReady, setIconsReady] = useState(false);
  /** 지도에서 클릭해 색칠한 구 */
  const [paintedSggs, setPaintedSggs] = useState<string[]>([]);
  const [inspectedSgg, setInspectedSgg] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
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
      .filter((f) => {
        const year = f.properties?.acdntYear as number | undefined;
        if (year == null) return true;
        return year >= bikeAccidentYearRange[0] && year <= bikeAccidentYearRange[1];
      })
      .filter(
        (f) =>
          f.properties?.accidentType !== "자전거" ||
          visibleSeverities[f.properties?.severity as keyof SeverityFilter] !== false
      )
      .map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          icon:
            f.properties?.accidentType === "자전거"
              ? (BIKE_ACCIDENT_ICON_BY_SEVERITY[f.properties?.severity as string] ??
                "pin-accident-bike")
              : (ACCIDENT_ICON_BY_TYPE[f.properties?.accidentType as string] ?? "pin-accident-bike"),
        },
      }));
    return { ...accidentGeo, features };
  }, [accidentGeo, focusSgg, visibleAccidentTypes, bikeAccidentYearRange, visibleSeverities]);

  // 자전거 사고는 건수가 많아 클러스터 레이어로, 나머지(어린이/노인)는 개별 핀 레이어로 분리
  const bikeAccidentGeo = useMemo(() => {
    if (!accidentGeoFiltered) return null;
    return {
      ...accidentGeoFiltered,
      features: accidentGeoFiltered.features.filter(
        (f) => (f.properties as { accidentType?: string })?.accidentType === "자전거"
      ),
    };
  }, [accidentGeoFiltered]);

  const otherAccidentGeo = useMemo(() => {
    if (!accidentGeoFiltered) return null;
    return {
      ...accidentGeoFiltered,
      features: accidentGeoFiltered.features.filter(
        (f) => (f.properties as { accidentType?: string })?.accidentType !== "자전거"
      ),
    };
  }, [accidentGeoFiltered]);

  const interactiveLayerIds = useMemo(() => {
    const ids = ["districts-fill", "accident-points", "bike-cluster-circles", "bike-unclustered-point"];
    if (showChildZones) ids.push("child-zone-fill");
    if (showElderlyZones) ids.push("elderly-zone-fill");
    if (showBikeRoads) ids.push("bike-road-line");
    return ids;
  }, [showChildZones, showElderlyZones, showBikeRoads]);

  const filterBySgg = useCallback(
    (geo: GeoJSON.FeatureCollection | null, visible: boolean) => {
      if (!geo || !visible) return EMPTY_FC;
      if (!focusSgg) return geo;
      return { ...geo, features: geo.features.filter((f) => f.properties?.sgg === focusSgg) };
    },
    [focusSgg]
  );
  const childZoneGeoFiltered = useMemo(
    () => filterBySgg(childZoneGeo, showChildZones),
    [childZoneGeo, showChildZones, filterBySgg]
  );
  const elderlyZoneGeoFiltered = useMemo(
    () => filterBySgg(elderlyZoneGeo, showElderlyZones),
    [elderlyZoneGeo, showElderlyZones, filterBySgg]
  );
  const bikeRoadGeoFiltered = useMemo(
    () => filterBySgg(bikeRoadGeo, showBikeRoads),
    [bikeRoadGeo, showBikeRoads, filterBySgg]
  );

  const autoHighlighted = useMemo(() => {
    if (gapFillStep <= 0) return new Set<string>();
    return new Set(
      [...crimeStats]
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, gapFillStep)
        .map((d) => d.sgg)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crimeStats, paintedSet, autoHighlighted, colorMode]);

  const anyPainted = paintedSggs.length > 0 || gapFillStep > 0;
  const inspected = inspectedSgg ? (bySgg.get(inspectedSgg) ?? null) : null;

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

  const onMouseMove = (e: MapLayerMouseEvent) => {
    if (detailOpen) return;
    const result = hoverOnMouseMove(e);
    setCursor(result === "pointer" || result === "district" ? "pointer" : "grab");
  };

  const onClick = async (e: MapLayerMouseEvent) => {
    if (detailOpen) return;

    const cluster = e.features?.find((x) => x.layer.id === "bike-cluster-circles");
    if (cluster) {
      const map = mapRef.current?.getMap();
      const clusterId = cluster.properties?.cluster_id as number | undefined;
      const source = map?.getSource("bike-accidents") as
        | { getClusterExpansionZoom: (id: number) => Promise<number> }
        | undefined;
      if (map && source && clusterId != null) {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const [lon, lat] = (cluster.geometry as GeoJSON.Point).coordinates;
        map.easeTo({ center: [lon, lat], zoom, duration: 500 });
      }
      return;
    }

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
                hoverOnMouseLeave();
              }
        }
        onClick={detailOpen ? undefined : onClick}
      >
        <NavigationControl position="top-right" />

        {districtGeo && (
          <DistrictLayer data={districtGeo} fillColorExpr={fillColorExpr} anyPainted={anyPainted} />
        )}

        {bikeRoadGeo && <BikeRoadLayer data={bikeRoadGeoFiltered} visible={showBikeRoads} />}

        {childZoneGeo && (
          <ZoneLayer
            id="child-zone"
            data={childZoneGeoFiltered}
            visible={showChildZones}
            fillColor="#f59e0b"
            lineColor="#b45309"
          />
        )}

        {elderlyZoneGeo && (
          <ZoneLayer
            id="elderly-zone"
            data={elderlyZoneGeoFiltered}
            visible={showElderlyZones}
            fillColor="#8b5cf6"
            lineColor="#5b21b6"
          />
        )}

        {bikeAccidentGeo && iconsReady && (
          <BikeAccidentClusterLayer
            data={bikeAccidentGeo}
            visible={bikeAccidentGeo.features.length > 0}
          />
        )}

        {otherAccidentGeo && iconsReady && (
          <AccidentLayer
            data={otherAccidentGeo}
            visible={otherAccidentGeo.features.length > 0}
          />
        )}

        {hover && (
          <MapHoverPopup
            hover={hover}
            popupLockRef={popupLockRef}
            onClose={hoverOnMouseLeave}
            onOpenDetail={openDetail}
          />
        )}
      </MapGL>

      <AccidentDetailDialog detailAccident={detailAccident} onClose={closeDetail} />

      <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[280px] flex-col gap-1.5 rounded-xl border bg-background/90 p-3 text-xs shadow-lg backdrop-blur-md">
        <ColorModeTabs mode={colorMode} onChange={setColorMode} />

        {inspected && (
          <DistrictInspectorCard
            district={inspected}
            colorMode={colorMode}
            score={scoreOf(inspected)}
            painted={paintedSet.has(inspected.sgg) || autoHighlighted.has(inspected.sgg)}
          />
        )}

        {paintedSggs.length > 0 && (
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
        )}

        {gapFillStep > 0 && (
          <div className="text-muted-foreground">
            필터: 위험 상위 {Math.min(gapFillStep, 25)}개 구도 함께 표시 중
          </div>
        )}

        <MapLegend />
      </div>
    </>
  );
}
