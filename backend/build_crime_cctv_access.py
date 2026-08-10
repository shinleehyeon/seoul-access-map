"""
자전거도로 인프라 대비 교통사고 위험도 스코어 계산.

입력 (data/processed/, preprocess_crime_cctv.py 결과물):
  - accident.csv        서울 교통사고 다발지점(최신연도, 125곳) - 좌표/유형/사상자수 (지도 핀용)
  - bike_accident.csv   자치구별 자전거 교통사고 실제 발생 건수(2025, 가해+피해 합산)
  - bike_road.csv       자치구별 자전거도로 총 길이(km, 2025)

핵심 지표는 bikeAccidentPerRoadKm = 자전거사고 건수 / 자전거도로 km.
같은 사고 건수라도 도로가 짧은 자치구일수록 "인프라 대비 위험도"가 높다고 본다
(도로가 적은데 사고가 몰리는 곳 = 자전거도로 확충이 시급한 곳).

계산:
  - accidentCount            자치구 내 교통사고 다발지점 수 (지도 핀 개수, 참고용)
  - bikeAccidentPer10k       인구 1만명당 자전거 사고 발생 건수
  - bikeAccidentPerRoadKm    자전거도로 1km당 자전거 사고 건수 (인프라 대비 위험도)
  - gapScore(0~100)          인프라 대비 자전거사고 위험도 60% + 사고다발지점 밀도 40%를 합친 점수.

기존 district_stats.json(약국 분석 유산)은 대시보드 차트들이 여전히 참조하고 있어
건드리지 않는다. 대신 crime_cctv_stats.json으로 내보내고, 지도는 이 새 파일 기준으로
코로플레스를 칠하고, 사고다발지점은 accident_points.json으로 핀을 찍는다.
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
OUT_DIR = ROOT / "frontend" / "public" / "data"
STATS_PATH = OUT_DIR / "crime_cctv_stats.json"

POPULATION = {
    "종로구": 140241, "중구": 121312, "용산구": 208249, "성동구": 279289,
    "광진구": 336882, "동대문구": 336644, "중랑구": 383211, "성북구": 425230,
    "강북구": 288113, "도봉구": 306432, "노원구": 498213, "은평구": 462815,
    "서대문구": 306442, "마포구": 364532, "양천구": 431528, "강서구": 563598,
    "구로구": 392241, "금천구": 227366, "영등포구": 375133, "동작구": 380596,
    "관악구": 485518, "서초구": 407864, "강남구": 550826, "송파구": 658871,
    "강동구": 459970,
}


def main() -> None:
    accident = pd.read_csv(PROCESSED / "accident.csv")
    bike_accident = pd.read_csv(PROCESSED / "bike_accident.csv")
    bike_road = pd.read_csv(PROCESSED / "bike_road.csv")
    child_zone = pd.read_csv(PROCESSED / "child_zone.csv")
    elderly_zone = pd.read_csv(PROCESSED / "elderly_zone.csv")

    accident_by_sgg = accident.groupby("자치구").size()
    bike_by_sgg = bike_accident.set_index("자치구")["bikeAccidentCount"]
    bike_hotspot_by_sgg = accident[accident["사고유형"] == "자전거"].groupby("자치구").size()
    road_by_sgg = bike_road.set_index("자치구")["bikeRoadKm"]
    child_accident_by_sgg = (
        accident[accident["사고유형"].isin(["보행어린이", "스쿨존어린이"])].groupby("자치구").size()
    )
    child_zone_by_sgg = child_zone.groupby("자치구").size()
    elderly_accident_by_sgg = accident[accident["사고유형"] == "보행노인"].groupby("자치구").size()
    elderly_zone_by_sgg = elderly_zone.groupby("자치구").size()

    rows = []
    for sgg, population in POPULATION.items():
        accident_count = int(accident_by_sgg.get(sgg, 0))
        bike_count = int(bike_by_sgg.get(sgg, 0))
        bike_hotspot_count = int(bike_hotspot_by_sgg.get(sgg, 0))
        road_km = float(road_by_sgg.get(sgg, 0.0))
        child_accident_count = int(child_accident_by_sgg.get(sgg, 0))
        child_zone_count = int(child_zone_by_sgg.get(sgg, 0))
        elderly_accident_count = int(elderly_accident_by_sgg.get(sgg, 0))
        elderly_zone_count = int(elderly_zone_by_sgg.get(sgg, 0))

        accident_per_10k = round(accident_count / population * 10_000, 2) if population else 0.0
        bike_per_10k = round(bike_count / population * 10_000, 2) if population else 0.0
        bike_per_road_km = round(bike_count / road_km, 2) if road_km else 0.0
        # 보호구역이 있는데도 사고가 나는 비율 (보호구역 100개당 사고건수)
        child_accident_per_zone = (
            round(child_accident_count / child_zone_count * 100, 2) if child_zone_count else 0.0
        )
        elderly_accident_per_zone = (
            round(elderly_accident_count / elderly_zone_count * 100, 2)
            if elderly_zone_count
            else 0.0
        )

        rows.append(
            {
                "sgg": sgg,
                "population": population,
                "accidentCount": accident_count,
                "accidentPer10k": accident_per_10k,
                "bikeAccidentCount": bike_count,
                "bikeHotspotCount": bike_hotspot_count,
                "bikeAccidentPer10k": bike_per_10k,
                "bikeRoadKm": road_km,
                "bikeAccidentPerRoadKm": bike_per_road_km,
                "childZoneCount": child_zone_count,
                "childAccidentCount": child_accident_count,
                "childAccidentPerZone": child_accident_per_zone,
                "elderlyZoneCount": elderly_zone_count,
                "elderlyAccidentCount": elderly_accident_count,
                "elderlyAccidentPerZone": elderly_accident_per_zone,
            }
        )

    df = pd.DataFrame(rows)

    def norm(s: pd.Series) -> pd.Series:
        return (s - s.min()) / (s.max() - s.min()) if s.max() > s.min() else s * 0

    accident_n = norm(df["accidentPer10k"])
    bike_road_n = norm(df["bikeAccidentPerRoadKm"])

    # 자전거 점수: 인프라(도로 km) 대비 사고 위험도 60% + 사고다발지점 밀도 40%
    df["bikeScore"] = (bike_road_n * 0.6 + accident_n * 0.4).mul(100).round(1)
    # 어린이/노인 사고는 표본이 너무 적어 25개 구끼리 min-max 정규화하면 "2건 vs 0건" 차이만으로
    # 100점이 나오는 등 왜곡이 심하다. 그래서 관측된 최댓값이 아니라 고정 기준선을 100점으로 두고
    # 절대 비율로 스케일한다. 두 지표는 보호구역 개수 규모 자체가 달라(어린이 41~115곳,
    # 노인 2~27곳) 기준선도 따로 잡는다 - 노인 쪽은 분모가 작아 비율이 자연히 훨씬 크게 나온다.
    CHILD_SCALE_MAX = 10.0  # 보호구역 100곳당 사고 10건 = 매우 심각
    ELDERLY_SCALE_MAX = 100.0  # 보호구역 100곳당 사고 100건 = 매우 심각
    df["childScore"] = (df["childAccidentPerZone"] / CHILD_SCALE_MAX * 100).clip(upper=100).round(
        1
    )
    df["elderlyScore"] = (
        (df["elderlyAccidentPerZone"] / ELDERLY_SCALE_MAX * 100).clip(upper=100).round(1)
    )
    # 기존 gapScore는 자전거 점수와 동일하게 유지 (하위 호환용).
    df["gapScore"] = df["bikeScore"]

    print("\n===== 자전거 점수 (상위 8) =====")
    print(df.sort_values("bikeScore", ascending=False).head(8).to_string(index=False))
    print("\n===== 어린이 점수 (상위 8) =====")
    print(df.sort_values("childScore", ascending=False).head(8).to_string(index=False))
    print("\n===== 노인 점수 (상위 8) =====")
    print(df.sort_values("elderlyScore", ascending=False).head(8).to_string(index=False))

    stats = df.to_dict("records")
    stats.sort(key=lambda d: -d["gapScore"])

    STATS_PATH.write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"\n{len(stats)}개 자치구 저장 완료 -> {STATS_PATH}")

    write_accident_points(accident)
    # 보호구역 폴리곤은 도로망 연결이 필요하므로 build_child_zone_polygons.py 에서 생성
    # 전용도로 겹침 표시는 bike_road_polygons 가 있으면 다시 붙인다
    try:
        import sys

        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from build_bike_road_polygons import annotate_accidents_on_bike_road

        bike_path = OUT_DIR / "bike_road_polygons.json"
        if bike_path.exists():
            bike = json.loads(bike_path.read_text())
            annotate_accidents_on_bike_road(bike.get("features", []))
    except Exception as e:
        print(f"onBikeRoad 표시 건너뜀: {e}")


def write_accident_points(accident: pd.DataFrame) -> None:
    geo = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "sgg": row["자치구"],
                    "name": row["위치명"],
                    "accidentType": row["사고유형"],
                    "accidentCount": row["사고건수"],
                    "casualties": row["사상자수"],
                },
                "geometry": {"type": "Point", "coordinates": [row["경도"], row["위도"]]},
            }
            for row in accident.to_dict("records")
        ],
    }
    (OUT_DIR / "accident_points.json").write_text(json.dumps(geo, ensure_ascii=False))
    print(f"교통사고 다발지점 {len(accident)}개 저장 완료")


if __name__ == "__main__":
    main()