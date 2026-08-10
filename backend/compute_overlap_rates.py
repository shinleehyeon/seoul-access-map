"""
사고다발지점이 실제로 인프라(전용도로/보호구역) 위에서 발생했는지 자치구별 비율로 계산한다.

같은 위험 점수라도 원인이 다르다:
  - 인프라 위/근처에서 사고가 몰림 → 도로·구역 설계 문제 (신호, 노면표시, 교차로 구조)
  - 인프라가 아예 없는 곳에서 사고가 몰림 → 인프라 부재 문제 (전용도로·보호구역 신설 필요)
이 스크립트는 이 둘을 구분하는 "온-인프라 비율(%)"을 계산해 crime_cctv_stats.json에 덧붙인다.

전제: build_bike_road_polygons.py가 accident_points.json에 onBikeRoad(0/1)를 이미 붙여놨고,
      build_child_zone_polygons.py가 child_zone_points.json / elderly_zone_points.json
      (자치구 태그가 붙은 보호구역 버퍼 폴리곤)을 만들어놨다는 걸 전제로, 이 스크립트를
      그 두 스크립트 다음에 실행한다.

출력: crime_cctv_stats.json 갱신 (bikeOnRoadRate/childInZoneRate/elderlyInZoneRate 추가)
"""

from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "frontend" / "public" / "data"
STATS_PATH = DATA_DIR / "crime_cctv_stats.json"
ACCIDENT_PATH = DATA_DIR / "accident_points.json"
CHILD_ZONE_PATH = DATA_DIR / "child_zone_points.json"
ELDERLY_ZONE_PATH = DATA_DIR / "elderly_zone_points.json"


def bike_on_road_rate_by_sgg() -> dict[str, float]:
    acc = json.loads(ACCIDENT_PATH.read_text())
    total: dict[str, int] = {}
    on_road: dict[str, int] = {}
    for f in acc["features"]:
        p = f["properties"]
        if p.get("accidentType") != "자전거":
            continue
        sgg = p.get("sgg")
        if not sgg:
            continue
        total[sgg] = total.get(sgg, 0) + 1
        if p.get("onBikeRoad"):
            on_road[sgg] = on_road.get(sgg, 0) + 1
    return {
        sgg: round(on_road.get(sgg, 0) / cnt * 100, 1) for sgg, cnt in total.items() if cnt > 0
    }


def in_zone_rate_by_sgg(
    zone_path: Path, accident_types: set[str]
) -> tuple[dict[str, float], dict[str, int]]:
    """자치구별 (동일 자치구 보호구역 폴리곤 합집합 안에서 발생한 사고 비율, 표본 수)."""
    zones = json.loads(zone_path.read_text())
    zones_by_sgg: dict[str, list] = {}
    for f in zones["features"]:
        sgg = f["properties"].get("sgg")
        if not sgg:
            continue
        zones_by_sgg.setdefault(sgg, []).append(shape(f["geometry"]))

    union_by_sgg = {sgg: unary_union(polys) for sgg, polys in zones_by_sgg.items()}

    acc = json.loads(ACCIDENT_PATH.read_text())
    total: dict[str, int] = {}
    inside: dict[str, int] = {}
    for f in acc["features"]:
        p = f["properties"]
        if p.get("accidentType") not in accident_types:
            continue
        sgg = p.get("sgg")
        if not sgg:
            continue
        total[sgg] = total.get(sgg, 0) + 1
        union = union_by_sgg.get(sgg)
        if union is None:
            continue
        lon, lat = f["geometry"]["coordinates"]
        if union.contains(Point(lon, lat)):
            inside[sgg] = inside.get(sgg, 0) + 1

    rate = {
        sgg: round(inside.get(sgg, 0) / cnt * 100, 1) for sgg, cnt in total.items() if cnt > 0
    }
    return rate, total


def main() -> None:
    if not ACCIDENT_PATH.exists():
        print("accident_points.json 없음 — 계산 건너뜀")
        return

    bike_rate = bike_on_road_rate_by_sgg()
    print("\n===== 자전거사고 온-전용도로 비율(%) =====")
    for sgg, r in sorted(bike_rate.items(), key=lambda kv: -kv[1]):
        print(f"  {sgg}: {r}%")

    child_rate, child_total = ({}, {})
    if CHILD_ZONE_PATH.exists():
        child_rate, child_total = in_zone_rate_by_sgg(
            CHILD_ZONE_PATH, {"보행어린이", "스쿨존어린이"}
        )
        print("\n===== 어린이사고 온-보호구역 비율(%, 표본 있는 구만) =====")
        for sgg, r in sorted(child_rate.items(), key=lambda kv: -kv[1]):
            print(f"  {sgg}: {r}% (n={child_total[sgg]})")
    else:
        print("child_zone_points.json 없음 — 어린이 비율 건너뜀")

    elderly_rate, elderly_total = ({}, {})
    if ELDERLY_ZONE_PATH.exists():
        elderly_rate, elderly_total = in_zone_rate_by_sgg(ELDERLY_ZONE_PATH, {"보행노인"})
        print("\n===== 노인사고 온-보호구역 비율(%, 표본 있는 구만) =====")
        for sgg, r in sorted(elderly_rate.items(), key=lambda kv: -kv[1]):
            print(f"  {sgg}: {r}% (n={elderly_total[sgg]})")
    else:
        print("elderly_zone_points.json 없음 — 노인 비율 건너뜀")

    stats = json.loads(STATS_PATH.read_text())
    for row in stats:
        sgg = row["sgg"]
        row["bikeOnRoadRate"] = bike_rate.get(sgg)
        row["bikeOnRoadSample"] = sum(
            1
            for f in json.loads(ACCIDENT_PATH.read_text())["features"]
            if f["properties"].get("accidentType") == "자전거" and f["properties"].get("sgg") == sgg
        )
        row["childInZoneRate"] = child_rate.get(sgg)
        row["childInZoneSample"] = child_total.get(sgg, 0)
        row["elderlyInZoneRate"] = elderly_rate.get(sgg)
        row["elderlyInZoneSample"] = elderly_total.get(sgg, 0)

    STATS_PATH.write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"\n{STATS_PATH} 에 온-인프라 비율 병합 완료")


if __name__ == "__main__":
    main()
