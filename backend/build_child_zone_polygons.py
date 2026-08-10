"""
어린이/노인장애인보호구역을 OSM 도로망을 따라 연결한 폴리곤으로 만든다.

방법:
  1) 서울 drive 도로망을 받아 캐시
  2) 각 보호구역 중심점에서 가장 가까운 도로 노드를 찾음
  3) 그 노드에서 네트워크 거리 <= 300m 인 도로 구간만 추출 (도로 따라 연결)
  4) 해당 구간을 보호구역도로폭/2 로 버퍼 → 폴리곤

입력: data/processed/child_zone.csv, elderly_zone.csv (보호구역도로폭 포함)
출력: frontend/public/data/child_zone_points.json, elderly_zone_points.json
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd
from shapely.geometry import mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
CACHE_GRAPH = PROCESSED / "seoul_drive_graph.graphml"
OUT_PATH = ROOT / "frontend" / "public" / "data" / "child_zone_points.json"

# 도로교통법상 어린이보호구역 일반 지정 범위
NETWORK_RADIUS_M = 300
# 도로폭 이상치/결측 가드
DEFAULT_ROAD_WIDTH_M = 8.0
MIN_HALF_WIDTH_M = 2.5
MAX_HALF_WIDTH_M = 20.0
SIMPLIFY_TOL_M = 2.0
CRS_METRIC = "EPSG:5186"  # 중부원점(서울)


def load_or_download_graph():
    if CACHE_GRAPH.exists():
        print(f"캐시된 도로망 로드: {CACHE_GRAPH}")
        return ox.load_graphml(CACHE_GRAPH)

    print("서울 drive 도로망 다운로드 중 (최초 1회, 수 분 소요)...")
    G = ox.graph_from_place("Seoul, South Korea", network_type="drive", simplify=True)
    CACHE_GRAPH.parent.mkdir(parents=True, exist_ok=True)
    ox.save_graphml(G, CACHE_GRAPH)
    print(f"도로망 캐시 저장: {CACHE_GRAPH} (nodes={G.number_of_nodes()}, edges={G.number_of_edges()})")
    return G


def half_width_m(road_width) -> float:
    try:
        w = float(road_width)
    except (TypeError, ValueError):
        w = DEFAULT_ROAD_WIDTH_M
    if not math.isfinite(w) or w <= 0:
        w = DEFAULT_ROAD_WIDTH_M
    return max(MIN_HALF_WIDTH_M, min(w / 2.0, MAX_HALF_WIDTH_M))


def zone_polygon_from_network(G_proj, node_id: int, half_w: float):
    """네트워크 거리 내 도로를 버퍼해 폴리곤 생성 (투영 좌표계)."""
    try:
        sub = nx.ego_graph(G_proj, node_id, radius=NETWORK_RADIUS_M, distance="length")
    except Exception:
        return None
    if sub.number_of_edges() == 0:
        return None

    _, edges = ox.graph_to_gdfs(sub, nodes=True, edges=True, node_geometry=True, fill_edge_geometry=True)
    if edges.empty:
        return None

    buffered = edges.geometry.buffer(half_w, cap_style="round", join_style="round")
    poly = unary_union(list(buffered.values))
    if poly.is_empty:
        return None
    return poly.simplify(SIMPLIFY_TOL_M, preserve_topology=True)


def zone_polygon_near_edges(edges_gdf: gpd.GeoDataFrame, x: float, y: float, half_w: float):
    """네트워크 연결 실패 시: 반경 내 도로를 유클리드로 잡아 도로 따라 버퍼 (폴백)."""
    from shapely.geometry import Point

    pt = Point(x, y)
    search = pt.buffer(NETWORK_RADIUS_M)
    hits = edges_gdf.iloc[list(edges_gdf.sindex.intersection(search.bounds))]
    near = hits[hits.intersects(search)]
    if near.empty:
        # 그래도 없으면 최근접 도로 1개만
        dists = edges_gdf.distance(pt)
        near = edges_gdf.iloc[[int(dists.to_numpy().argmin())]]
    clipped = near.geometry.intersection(search)
    clipped = clipped[~clipped.is_empty]
    if clipped.empty:
        return None
    buffered = clipped.buffer(half_w, cap_style="round", join_style="round")
    poly = unary_union(list(buffered.values))
    if poly.is_empty:
        return None
    return poly.simplify(SIMPLIFY_TOL_M, preserve_topology=True)


def build_zone_polygons(
    csv_path: Path,
    out_path: Path,
    label: str,
    G_proj,
    edges_gdf: gpd.GeoDataFrame,
) -> None:
    df = pd.read_csv(csv_path)
    if "보호구역도로폭" not in df.columns:
        raise SystemExit(
            f"{csv_path.name}에 보호구역도로폭이 없습니다. "
            "preprocess_crime_cctv.py를 다시 실행하세요."
        )

    pts = gpd.GeoSeries(
        gpd.points_from_xy(df["경도"].astype(float), df["위도"].astype(float)),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    print(f"[{label}] 최근접 도로 노드 매칭...")
    nearest = ox.distance.nearest_nodes(G_proj, X=pts.x.tolist(), Y=pts.y.tolist())

    features = []
    failed = 0
    fallback = 0
    rows = df.to_dict("records")
    for i, row in enumerate(rows):
        node_id = int(nearest[i])
        half_w = half_width_m(row.get("보호구역도로폭"))
        poly_m = zone_polygon_from_network(G_proj, node_id, half_w)
        if poly_m is None:
            poly_m = zone_polygon_near_edges(edges_gdf, float(pts.x.iloc[i]), float(pts.y.iloc[i]), half_w)
            if poly_m is not None:
                fallback += 1
        if poly_m is None:
            failed += 1
            continue

        gs = gpd.GeoSeries([poly_m], crs=CRS_METRIC).to_crs(epsg=4326)
        geom = gs.iloc[0]
        if geom.is_empty:
            failed += 1
            continue

        cctv_count = row.get("CCTV설치대수")
        if pd.isna(cctv_count):
            cctv_count = 0

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sgg": row["자치구"],
                    "name": row["시설명"],
                    "facilityType": str(row["시설종류"]),
                    "cctv": 1 if row.get("CCTV설치여부") == "Y" else 0,
                    "cctvCount": int(cctv_count),
                    "lon": float(row["경도"]),
                    "lat": float(row["위도"]),
                    "roadWidthM": float(row.get("보호구역도로폭") or DEFAULT_ROAD_WIDTH_M),
                    "networkRadiusM": NETWORK_RADIUS_M,
                },
                "geometry": mapping(geom),
            }
        )
        if (i + 1) % 100 == 0:
            print(f"  [{label}] {i + 1}/{len(rows)} 완료 (폴백 {fallback}, 실패 {failed})")

    out_path.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(
        f"\n{label} 도로연결 폴리곤 {len(features)}개 저장 "
        f"(폴백 {fallback}, 실패 {failed}) -> {out_path}"
    )


def main() -> None:
    G = load_or_download_graph()
    print("도로망 투영 중...")
    G_proj = ox.project_graph(G, to_crs=CRS_METRIC)
    print("엣지 GeoDataFrame 준비...")
    edges_gdf = ox.graph_to_gdfs(G_proj, nodes=False, edges=True, fill_edge_geometry=True)

    build_zone_polygons(
        PROCESSED / "child_zone.csv",
        OUT_PATH,
        "어린이보호구역",
        G_proj,
        edges_gdf,
    )
    build_zone_polygons(
        PROCESSED / "elderly_zone.csv",
        ROOT / "frontend" / "public" / "data" / "elderly_zone_points.json",
        "노인장애인보호구역",
        G_proj,
        edges_gdf,
    )


if __name__ == "__main__":
    main()
