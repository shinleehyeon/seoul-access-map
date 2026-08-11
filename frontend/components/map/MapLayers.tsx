"use client";

import { Layer, Source } from "react-map-gl/maplibre";

/** 구 경계 색칠 레이어. fillColorExpr는 자치구명→색상 match 표현식. */
export function DistrictLayer({
  data,
  fillColorExpr,
  anyPainted,
}: {
  data: GeoJSON.FeatureCollection;
  fillColorExpr: unknown[];
  anyPainted: boolean;
}) {
  // "match" 표현식은 케이스가 1개 이상 있어야 유효하다 (통계 로딩 전에는 빈 배열이 될 수 있음).
  const hasCases = fillColorExpr.length > 3;
  return (
    <Source id="districts" type="geojson" data={data}>
      <Layer
        id="districts-fill"
        type="fill"
        paint={{
          "fill-color": hasCases ? (fillColorExpr as unknown as string) : "#e5e7eb",
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
  );
}

export function BikeRoadLayer({
  data,
  visible,
}: {
  data: GeoJSON.FeatureCollection;
  visible: boolean;
}) {
  return (
    <Source id="bike-roads" type="geojson" data={data} tolerance={0}>
      <Layer
        id="bike-road-line"
        type="line"
        layout={{
          visibility: visible ? "visible" : "none",
          "line-join": "round",
          "line-cap": "round",
        }}
        paint={{
          "line-color": "#eab308",
          "line-opacity": 0.5,
          // 줌 아웃에서도 보이도록 두께를 줌에 맞춰 키움
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 12, 2.5, 15, 5, 17, 8],
        }}
      />
    </Source>
  );
}

/** 어린이/노인장애인보호구역 폴리곤 레이어 (OSM 도로망 버퍼 근사) */
export function ZoneLayer({
  id,
  data,
  visible,
  fillColor,
  lineColor,
}: {
  id: "child-zone" | "elderly-zone";
  data: GeoJSON.FeatureCollection;
  visible: boolean;
  fillColor: string;
  lineColor: string;
}) {
  return (
    <Source id={`${id}s`} type="geojson" data={data} tolerance={0}>
      <Layer
        id={`${id}-fill`}
        type="fill"
        layout={{ visibility: visible ? "visible" : "none" }}
        paint={{ "fill-color": fillColor, "fill-opacity": 0.22 }}
      />
      <Layer
        id={`${id}-outline`}
        type="line"
        layout={{ visibility: visible ? "visible" : "none" }}
        paint={{ "line-color": lineColor, "line-width": 1.2, "line-opacity": 0.85 }}
      />
    </Source>
  );
}

export function AccidentLayer({
  data,
  visible,
}: {
  data: GeoJSON.FeatureCollection;
  visible: boolean;
}) {
  return (
    <Source id="accidents" type="geojson" data={data}>
      <Layer
        id="accident-points"
        type="symbol"
        layout={{
          "icon-image": ["get", "icon"],
          "icon-size": ["match", ["get", "icon"], "pin-accident-elderly", 0.13, 0.1],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          visibility: visible ? "visible" : "none",
        }}
      />
    </Source>
  );
}

/**
 * 자전거 사고(건수가 많아 개별 핀으로 보면 지저분함)를 줌 레벨에 따라
 * 다발구역처럼 뭉쳐서 보여주는 클러스터 레이어. 확대하면 자동으로 풀려서
 * 개별 핀(피해정도별 색상)이 나온다.
 */
export function BikeAccidentClusterLayer({
  data,
  visible,
}: {
  data: GeoJSON.FeatureCollection;
  visible: boolean;
}) {
  return (
    <Source
      id="bike-accidents"
      type="geojson"
      data={data}
      cluster={true}
      clusterMaxZoom={15}
      clusterRadius={45}
    >
      <Layer
        id="bike-cluster-circles"
        type="circle"
        filter={["has", "point_count"]}
        layout={{ visibility: visible ? "visible" : "none" }}
        paint={{
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#fde68a",
            10,
            "#fbbf24",
            50,
            "#f59e0b",
            200,
            "#dc2626",
          ],
          "circle-radius": ["step", ["get", "point_count"], 12, 10, 16, 50, 20, 200, 26],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.85,
        }}
      />
      <Layer
        id="bike-cluster-count"
        type="symbol"
        filter={["has", "point_count"]}
        layout={{
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Regular"],
          visibility: visible ? "visible" : "none",
        }}
        paint={{ "text-color": "#1f2937" }}
      />
      <Layer
        id="bike-unclustered-point"
        type="symbol"
        filter={["!", ["has", "point_count"]]}
        layout={{
          "icon-image": ["get", "icon"],
          "icon-size": 0.1,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          visibility: visible ? "visible" : "none",
        }}
      />
    </Source>
  );
}
