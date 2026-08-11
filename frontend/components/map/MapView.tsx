"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { NavigationControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl } from "maplibre-gl";
import {
  ACCIDENT_FILTER_KEY_BY_TYPE,
  ACCIDENT_ICON_BY_TYPE,
  BIKE_ACCIDENT_ICON_BY_SEVERITY,
  EMPTY_FC,
  MAP_STYLE,
  SEOUL_CENTER,
  ensureAccidentIcons,
} from "@/lib/mapConstants";
import { metricFill } from "@/lib/color";
import { resolvePeriodDistricts } from "@/lib/bikeInsightPeriod";
import { useMapData } from "./useMapData";
import { AccidentDetailDialog, MapHoverPopup, useMapHover } from "./MapHoverPopup";
import { AccidentLayer, BikeAccidentClusterLayer, BikeRoadLayer, DistrictLayer, ZoneLayer } from "./MapLayers";
import { DistrictInspectorCard, MapLegend, metricValue } from "./MapInspectorPanel";
import {
  BIKE_ACCIDENT_YEAR_MAX,
  BIKE_ACCIDENT_YEAR_MIN,
  DEFAULT_SEVERITY_FILTER,
  type ChoroplethMetric,
  type SeverityFilter,
} from "@/components/sidebar/FilterSidebar";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

export function MapView({
  detailOpen = false,
  choroplethMetric = "none",
  focusSgg = null,
  visibleAccidentTypes = { bike: true, elderly: true, child: true },
  showChildZones = false,
  showElderlyZones = false,
  showBikeRoads = false,
  bikeAccidentYearRange = [BIKE_ACCIDENT_YEAR_MIN, BIKE_ACCIDENT_YEAR_MAX],
  visibleSeverities = DEFAULT_SEVERITY_FILTER,
}: {
  detailOpen?: boolean;
  /** 자치구 전체 색칠 지표 */
  choroplethMetric?: ChoroplethMetric;
  /** 필터된 자치구 — 지도 포커스 */
  focusSgg?: string | null;
  /** 사고유형별 지도 핀 표시 여부 */
  visibleAccidentTypes?: { bike: boolean; elderly: boolean; child: boolean };
  showChildZones?: boolean;
  showElderlyZones?: boolean;
  showBikeRoads?: boolean;
  bikeAccidentYearRange?: [number, number];
  visibleSeverities?: SeverityFilter;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const { districtGeo, accidentGeo, childZoneGeo, elderlyZoneGeo, bikeRoadGeo, insights } =
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
  const [inspectedSgg, setInspectedSgg] = useState<string | null>(null);

  const districtMetrics = useMemo(() => {
    if (!insights) return [];
    const [from, to] = bikeAccidentYearRange;
    return resolvePeriodDistricts(insights, {
      kind: "range",
      start: { year: from, month: 1 },
      end: { year: to, month: 12 },
    });
  }, [insights, bikeAccidentYearRange]);

  const bySgg = useMemo(() => {
    const m = new Map(districtMetrics.map((d) => [d.sgg, d]));
    return m;
  }, [districtMetrics]);

  const scale = useMemo(() => {
    if (choroplethMetric === "none" || districtMetrics.length === 0) {
      return { min: 0, max: 1 };
    }
    const values = districtMetrics.map((d) => metricValue(d, choroplethMetric));
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [districtMetrics, choroplethMetric]);

  const toneOf = useCallback(
    (sgg: string) => {
      if (choroplethMetric === "none") return 0;
      const d = bySgg.get(sgg);
      if (!d) return 0;
      const v = metricValue(d, choroplethMetric);
      const span = scale.max - scale.min;
      if (span <= 0) return 0.5;
      return (v - scale.min) / span;
    },
    [bySgg, choroplethMetric, scale]
  );

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

  const fillColorExpr = useMemo(() => {
    const expr: unknown[] = ["match", ["get", "name"]];
    if (choroplethMetric === "none") {
      for (const d of districtMetrics) expr.push(d.sgg, "#e5e7eb");
    } else {
      for (const d of districtMetrics) {
        expr.push(d.sgg, metricFill(toneOf(d.sgg)));
      }
    }
    expr.push("#e5e7eb");
    return expr;
  }, [districtMetrics, choroplethMetric, toneOf]);

  const anyPainted = choroplethMetric !== "none";
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
    setInspectedSgg(focusSgg);
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
    setInspectedSgg((prev) => (prev === name ? null : name));
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
          <AccidentLayer data={otherAccidentGeo} visible={otherAccidentGeo.features.length > 0} />
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
        {inspected && (
          <DistrictInspectorCard
            district={inspected}
            metric={choroplethMetric}
            tone={toneOf(inspected.sgg)}
          />
        )}

        <MapLegend />
      </div>
    </>
  );
}
