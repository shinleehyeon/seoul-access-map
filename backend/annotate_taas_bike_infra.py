"""서울_자전거사고_TAAS.csv의 개별 사고에 자전거전용도로 인접 여부를 붙인다.

build_bike_road_polygons.py의 annotate_accidents_on_bike_road()와 동일한
50m 판정 로직(EPSG:5186 미터 좌표계)을 재사용하되, 대상을 기존
accident_points.json(사고다발지점 125개 집계 핀)이 아니라 TAAS 개별 사고
8,456건으로 바꾼 버전이다.

입력: frontend/public/data/bike_road_polygons.json (자전거전용도로 라인)
      data/raw_bike_accident/서울_자전거사고_TAAS.csv (개별 사고, 위도/경도 포함)
출력: 같은 CSV에 '자전거도로인접' (0/1) 컬럼 추가
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
ROAD_PATH = ROOT / "frontend" / "public" / "data" / "bike_road_polygons.json"
ACCIDENT_CSV = ROOT / "data" / "raw_bike_accident" / "서울_자전거사고_TAAS.csv"
CRS_METRIC = "EPSG:5186"
OVERLAP_DISTANCE_M = 50.0


def main() -> None:
    road_features = json.loads(ROAD_PATH.read_text())["features"]
    roads = unary_union([shape(f["geometry"]) for f in road_features])
    roads_m = gpd.GeoSeries([roads], crs="EPSG:4326").to_crs(CRS_METRIC).iloc[0]

    df = pd.read_csv(ACCIDENT_CSV)
    points = gpd.GeoSeries(
        [Point(lon, lat) for lon, lat in zip(df["경도"], df["위도"])], crs="EPSG:4326"
    ).to_crs(CRS_METRIC)

    df["자전거도로인접"] = (points.distance(roads_m) <= OVERLAP_DISTANCE_M).astype(int)

    df.to_csv(ACCIDENT_CSV, index=False, encoding="utf-8-sig")

    hits = int(df["자전거도로인접"].sum())
    total = len(df)
    print(f"{hits}/{total}건 ({hits / total:.1%})이 자전거전용도로 {OVERLAP_DISTANCE_M:.0f}m 이내")
    print(df.groupby("법정동명")["자전거도로인접"].mean().sort_values(ascending=False).head(10))


if __name__ == "__main__":
    main()
