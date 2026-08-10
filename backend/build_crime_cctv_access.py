"""
자전거도로/보호구역 인프라 대비 교통사고 위험도 스코어 계산.

세 점수 모두 같은 구조: "자치구 전체 연간 사고 발생 건수(분자) ÷ 관련 인프라 규모(분모)".
자전거는 도로 km, 어린이/노인은 보호구역 개수가 분모다. 예전엔 어린이/노인 분자로
교통사고다발지역표준데이터에서 유형만 필터링한 사고다발지점 개수(서울 전체 18건뿐)를
썼는데, 표본이 너무 적어 왜곡이 심했다. 지금은 자전거처럼 자치구별 연간 실사고 통계
(서울 열린데이터광장 "어린이/노인 교통사고 현황")를 분자로 써서 자전거와 동일한 신뢰도로
맞췄다.

입력 (data/processed/, preprocess_crime_cctv.py 결과물):
  - accident.csv          서울 교통사고 다발지점(최신연도, 125곳) - 좌표/유형/사상자수 (지도 핀용)
  - bike_accident.csv     자치구별 자전거 교통사고 실제 발생 건수(2025, 가해+피해 합산)
  - bike_road.csv         자치구별 자전거도로 총 길이(km, 2025)
  - child_accident.csv    자치구별 보행 어린이 교통사고 실제 발생 건수(2025)
  - elderly_accident.csv  자치구별 보행 노인 교통사고 실제 발생 건수(2025)
  - child_zone.csv        자치구별 어린이보호구역 개수
  - elderly_zone.csv      자치구별 노인장애인보호구역 개수

계산:
  - accidentCount            자치구 내 교통사고 다발지점 수 (지도 핀 개수, 참고용)
  - bikeAccidentPerRoadKm    자전거도로 1km당 자전거 사고 건수
  - childAccidentPerZone     어린이보호구역 100곳당 보행 어린이 사고 건수
  - elderlyAccidentPerZone   노인장애인보호구역 100곳당 보행 노인 사고 건수
  - gapScore(0~100)          기존 하위 호환용, bikeScore와 동일.

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
    child_accident = pd.read_csv(PROCESSED / "child_accident.csv")
    elderly_accident = pd.read_csv(PROCESSED / "elderly_accident.csv")

    accident_by_sgg = accident.groupby("자치구").size()
    bike_by_sgg = bike_accident.set_index("자치구")["bikeAccidentCount"]
    bike_hotspot_by_sgg = accident[accident["사고유형"] == "자전거"].groupby("자치구").size()
    road_by_sgg = bike_road.set_index("자치구")["bikeRoadKm"]
    child_zone_by_sgg = child_zone.groupby("자치구").size()
    elderly_zone_by_sgg = elderly_zone.groupby("자치구").size()
    child_ped_by_sgg = child_accident.set_index("자치구")["childPedAccidentCount"]
    elderly_ped_by_sgg = elderly_accident.set_index("자치구")["elderlyPedAccidentCount"]
    # 지도 핀(사고다발지점) 개수도 참고용으로 같이 보여준다.
    child_hotspot_by_sgg = (
        accident[accident["사고유형"].isin(["보행어린이", "스쿨존어린이"])].groupby("자치구").size()
    )
    elderly_hotspot_by_sgg = accident[accident["사고유형"] == "보행노인"].groupby("자치구").size()

    rows = []
    for sgg, population in POPULATION.items():
        accident_count = int(accident_by_sgg.get(sgg, 0))
        bike_count = int(bike_by_sgg.get(sgg, 0))
        bike_hotspot_count = int(bike_hotspot_by_sgg.get(sgg, 0))
        road_km = float(road_by_sgg.get(sgg, 0.0))
        child_zone_count = int(child_zone_by_sgg.get(sgg, 0))
        elderly_zone_count = int(elderly_zone_by_sgg.get(sgg, 0))
        child_ped_count = int(child_ped_by_sgg.get(sgg, 0))
        elderly_ped_count = int(elderly_ped_by_sgg.get(sgg, 0))
        child_hotspot_count = int(child_hotspot_by_sgg.get(sgg, 0))
        elderly_hotspot_count = int(elderly_hotspot_by_sgg.get(sgg, 0))

        accident_per_10k = round(accident_count / population * 10_000, 2) if population else 0.0
        bike_per_10k = round(bike_count / population * 10_000, 2) if population else 0.0
        bike_per_road_km = round(bike_count / road_km, 2) if road_km else 0.0
        # 보호구역 100곳당 실제 연간 보행 사고 건수 (자전거의 "도로 1km당 사고"와 동일한 철학)
        child_accident_per_zone = (
            round(child_ped_count / child_zone_count * 100, 2) if child_zone_count else 0.0
        )
        elderly_accident_per_zone = (
            round(elderly_ped_count / elderly_zone_count * 100, 2) if elderly_zone_count else 0.0
        )
        # 노인장애인보호구역은 자치구당 2~27곳으로 표본이 너무 작아 "보호구역당 비율"이
        # 0~5250까지 널뛴다. 그래서 점수 계산 기준은 인구 대비 비율로 바꾼다 (보호구역
        # 개수는 참고 정보로만 남겨둔다).
        elderly_accident_per_10k = (
            round(elderly_ped_count / population * 10_000, 2) if population else 0.0
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
                "childAccidentCount": child_ped_count,
                "childHotspotCount": child_hotspot_count,
                "childAccidentPerZone": child_accident_per_zone,
                "elderlyZoneCount": elderly_zone_count,
                "elderlyAccidentCount": elderly_ped_count,
                "elderlyHotspotCount": elderly_hotspot_count,
                "elderlyAccidentPerZone": elderly_accident_per_zone,
                "elderlyAccidentPer10k": elderly_accident_per_10k,
            }
        )

    df = pd.DataFrame(rows)

    def norm(s: pd.Series) -> pd.Series:
        return (s - s.min()) / (s.max() - s.min()) if s.max() > s.min() else s * 0

    accident_n = norm(df["accidentPer10k"])
    bike_road_n = norm(df["bikeAccidentPerRoadKm"])

    # 자전거 점수: 인프라(도로 km) 대비 사고 위험도 60% + 사고다발지점 밀도 40%
    df["bikeScore"] = (bike_road_n * 0.6 + accident_n * 0.4).mul(100).round(1)
    # 어린이 점수: 보호구역 100곳당 실제 연간 사고 건수. 25개 구 관측 범위가 5.4~42.4라
    # 고정 기준선(50)으로 스케일하면 왜곡 없이 자연스럽게 퍼진다.
    CHILD_SCALE_MAX = 50.0
    df["childScore"] = (df["childAccidentPerZone"] / CHILD_SCALE_MAX * 100).clip(upper=100).round(
        1
    )
    # 노인 점수: 보호구역 개수(2~27곳)가 너무 작아 "보호구역당 비율"이 표본 오차로 크게
    # 흔들린다 (0~5250). 대신 인구 대비 비율(1.2~5.0)을 쓴다 - 자전거의 accidentPer10k와
    # 같은 방식.
    ELDERLY_SCALE_MAX = 6.0
    df["elderlyScore"] = (
        (df["elderlyAccidentPer10k"] / ELDERLY_SCALE_MAX * 100).clip(upper=100).round(1)
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