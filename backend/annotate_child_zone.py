"""서울_어린이보행자사고_TAAS.csv의 '어린이보호구역내' 컬럼을 지도에 실제로 그려지는
child_zone_points.json 폴리곤 기준 point-in-polygon으로 재계산한다.

TAAS 자체 판정(searchSimpleCondition=41)을 그대로 썼더니, 지도에 그려진 보호구역
폴리곤(OSM 도로망 따라 300m 버퍼 근사치) 밖에 찍힌 빨간 핀이 실제로는 폴리곤 안에
겹쳐 보이는 등 두 소스가 어긋나는 문제가 있었다. 지도에 보이는 폴리곤과 핀 색이
항상 일치하도록, 자전거 인프라 인접 판정(annotate_taas_bike_infra.py)과 동일한
방식으로 우리가 그리는 폴리곤 자체를 기준으로 재분류한다.

입력: frontend/public/data/child_zone_points.json (보호구역 폴리곤)
      data/raw_child_accident/서울_어린이보행자사고_TAAS.csv
출력: 같은 CSV의 '어린이보호구역내' 컬럼 덮어쓰기
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
ZONE_PATH = ROOT / "frontend" / "public" / "data" / "child_zone_points.json"
ACCIDENT_CSV = ROOT / "data" / "raw_child_accident" / "서울_어린이보행자사고_TAAS.csv"


def main() -> None:
    zone_features = json.loads(ZONE_PATH.read_text())["features"]
    zones = unary_union([shape(f["geometry"]) for f in zone_features])

    df = pd.read_csv(ACCIDENT_CSV)
    points = gpd.GeoSeries(
        [Point(lon, lat) for lon, lat in zip(df["경도"], df["위도"])], crs="EPSG:4326"
    )

    before = int(df["어린이보호구역내"].sum())
    df["어린이보호구역내"] = points.within(zones).astype(int)
    after = int(df["어린이보호구역내"].sum())

    df.to_csv(ACCIDENT_CSV, index=False, encoding="utf-8-sig")

    total = len(df)
    print(f"TAAS 자체 판정 기준: {before}건 ({before / total:.1%})")
    print(f"폴리곤 point-in-polygon 재계산: {after}건 ({after / total:.1%})")


if __name__ == "__main__":
    main()
