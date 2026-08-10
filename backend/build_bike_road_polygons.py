"""
OSM 자전거 전용도로를 LineString GeoJSON으로 내보낸다.
(폴리곤 버퍼는 줌 아웃 시 MapLibre 단순화로 사라지거나 덩어리로 보이는 문제가 있어 라인으로 표시)

추가로 사고다발지점이 전용도로 근처(기본 50m)인지 표시해 accident_points.json 에 onBikeRoad 를 붙인다.

입력: OSM (최초 1회 캐시), accident_points.json
출력: frontend/public/data/bike_road_polygons.json, accident_points.json(갱신)
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Point, mapping, shape
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
CACHE_CYCLE = PROCESSED / "seoul_cycleways.geojson"
DISTRICTS = ROOT / "frontend" / "public" / "data" / "seoul_districts.json"
OUT_PATH = ROOT / "frontend" / "public" / "data" / "bike_road_polygons.json"
ACCIDENT_PATH = ROOT / "frontend" / "public" / "data" / "accident_points.json"
CRS_METRIC = "EPSG:5186"
# 사고다발지점 ↔ 전용도로 겹침 판정 거리
OVERLAP_DISTANCE_M = 50.0


def load_or_download_cycleways() -> gpd.GeoDataFrame:
    if CACHE_CYCLE.exists():
        print(f"캐시된 자전거도로 로드: {CACHE_CYCLE}")
        return gpd.read_file(CACHE_CYCLE)

    print("서울 자전거 전용도로(OSM) 다운로드 중...")
    gdf = ox.features_from_place(
        "Seoul, South Korea",
        tags={"highway": "cycleway", "cycleway": "track"},
    )
    gdf = gdf[gdf.geometry.type.isin(["LineString", "MultiLineString"])].copy()
    gdf = gdf[~gdf.geometry.is_empty]
    CACHE_CYCLE.parent.mkdir(parents=True, exist_ok=True)
    keep = [c for c in ["geometry", "name", "highway", "cycleway", "width"] if c in gdf.columns]
    gdf[keep].to_file(CACHE_CYCLE, driver="GeoJSON")
    print(f"캐시 저장: {CACHE_CYCLE} ({len(gdf)}개)")
    return gdf[keep]


def main() -> None:
    cycle = load_or_download_cycleways()
    if cycle.crs is None:
        cycle = cycle.set_crs(epsg=4326)
    else:
        cycle = cycle.to_crs(epsg=4326)

    districts = gpd.read_file(DISTRICTS).to_crs(epsg=4326)
    name_col = "name" if "name" in districts.columns else districts.columns[0]

    # 구간별 라인 유지 + 자치구 부여
    cycle = cycle.explode(index_parts=False).reset_index(drop=True)
    joined = gpd.sjoin(
        cycle[["geometry", "name"]].rename(columns={"name": "roadName"}),
        districts[[name_col, "geometry"]].rename(columns={name_col: "sgg"}),
        how="inner",
        predicate="intersects",
    )

    features = []
    for sgg, group in joined.groupby("sgg"):
        merged = linemerge(unary_union(list(group.geometry.values)))
        if merged.is_empty:
            continue
        # MultiLineString / LineString 모두 Feature 하나로
        centroid = merged.centroid
        road_name = next((n for n in group["roadName"] if isinstance(n, str) and n), None)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sgg": sgg,
                    "name": road_name or f"{sgg} 자전거전용도로",
                    "facilityType": "자전거전용도로",
                    "lon": float(centroid.x),
                    "lat": float(centroid.y),
                },
                "geometry": mapping(merged),
            }
        )

    OUT_PATH.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(f"자전거전용도로 라인 {len(features)}개 자치구 저장 -> {OUT_PATH}")

    annotate_accidents_on_bike_road(features)


def annotate_accidents_on_bike_road(bike_features: list[dict]) -> None:
    """사고다발지점에 onBikeRoad(0/1) 속성을 붙인다."""
    if not ACCIDENT_PATH.exists():
        print("accident_points.json 없음 — 겹침 표시 건너뜀")
        return

    roads = unary_union([shape(f["geometry"]) for f in bike_features])
    roads_m = gpd.GeoSeries([roads], crs="EPSG:4326").to_crs(CRS_METRIC).iloc[0]

    acc = json.loads(ACCIDENT_PATH.read_text())
    hits = 0
    by_type: dict[str, int] = {}
    for feat in acc["features"]:
        lon, lat = feat["geometry"]["coordinates"]
        pt = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326").to_crs(CRS_METRIC).iloc[0]
        on = 1 if roads_m.distance(pt) <= OVERLAP_DISTANCE_M else 0
        feat["properties"]["onBikeRoad"] = on
        if on:
            hits += 1
            t = str(feat["properties"].get("accidentType", "?"))
            by_type[t] = by_type.get(t, 0) + 1

    ACCIDENT_PATH.write_text(json.dumps(acc, ensure_ascii=False))
    print(
        f"사고다발지점 {hits}/{len(acc['features'])}곳이 "
        f"자전거전용도로 {OVERLAP_DISTANCE_M:.0f}m 이내 → onBikeRoad 표시"
    )
    print("  유형별:", by_type)


if __name__ == "__main__":
    main()
