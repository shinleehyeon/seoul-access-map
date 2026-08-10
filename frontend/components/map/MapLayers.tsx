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
  return (
    <Source id="districts" type="geojson" data={data}>
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
          "line-opacity": 0.95,
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
