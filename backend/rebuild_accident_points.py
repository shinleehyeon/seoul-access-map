"""accident_points.json의 자전거/어린이 사고 핀을 TAAS 개별사고 데이터로 교체한다.

기존에는 "사고다발지점"(자치구별 집계 핀)을 썼는데, 이제 TAAS에서 받은 개별 사고
데이터(위치 포함)가 있으므로 그걸로 대체한다. 노인 보행자 사고 핀(11개)만 집계 형태로 유지.

입력: data/raw_bike_accident/서울_자전거사고_TAAS.csv
      data/raw_child_accident/서울_어린이보행자사고_TAAS.csv
      frontend/public/data/accident_points.json (기존 - 노인 핀만 남김)
출력: frontend/public/data/accident_points.json (갱신)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
BIKE_CSV = ROOT / "data" / "raw_bike_accident" / "서울_자전거사고_TAAS.csv"
CHILD_CSV = ROOT / "data" / "raw_child_accident" / "서울_어린이보행자사고_TAAS.csv"
ACCIDENT_JSON = ROOT / "frontend" / "public" / "data" / "accident_points.json"


def sgg_of(legaldong_name: str) -> str:
    return str(legaldong_name).replace("서울특별시 ", "").split()[0]


def detail_of(row: pd.Series) -> dict:
    """모달 '자세히 보기'에서 보여줄 부가 컬럼."""
    detail = {
        "사고월": row["사고월"],
        "요일": row["요일"],
        "주야구분": row["주야구분"],
        "발생시각": row["발생시각"],
        "법정동명": row["법정동명"],
        "사고유형_대분류": row["사고유형_대분류"],
        "사고유형_중분류": row["사고유형_중분류"],
        "사고유형": row["사고유형"],
        "법규위반": row["법규위반"],
        "기상상태": row["기상상태"],
        "도로형태": row["도로형태"],
    }
    if "역할" in row.index and pd.notna(row.get("역할")):
        detail["역할"] = row["역할"]
    if "가해차종" in row.index and pd.notna(row.get("가해차종")):
        detail["가해차종"] = row["가해차종"]
    if "피해차종" in row.index and pd.notna(row.get("피해차종")):
        detail["피해차종"] = row["피해차종"]
    if "상대차종" in row.index and pd.notna(row.get("상대차종")):
        detail["상대차종"] = row["상대차종"]
    return detail


def build_bike_features(df: pd.DataFrame) -> list[dict]:
    features = []
    for _, row in df.iterrows():
        location = row["도로명"] if isinstance(row["도로명"], str) else row["법정동명"]
        casualties = int(row["사망자수"]) + int(row["중상자수"]) + int(row["경상자수"]) + int(
            row["부상신고자수"]
        )
        role = str(row["역할"]) if "역할" in row.index and pd.notna(row.get("역할")) else "가해"
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sgg": sgg_of(row["법정동명"]),
                    "name": f"{row['법정동명']} {location}".strip(),
                    "accidentType": "자전거",
                    "bikeRole": role,
                    "accidentCount": 1,
                    "casualties": casualties,
                    "onBikeRoad": int(row["자전거도로인접"]),
                    "acdntNo": str(row["사고번호"]),
                    "acdntYear": int(row["사고연도"]),
                    "severity": row["사고내용"],
                    "detail": detail_of(row),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["경도"]), float(row["위도"])],
                },
            }
        )
    return features


def build_child_features(df: pd.DataFrame) -> list[dict]:
    features = []
    for _, row in df.iterrows():
        location = row["도로명"] if isinstance(row["도로명"], str) else row["법정동명"]
        casualties = int(row["사망자수"]) + int(row["중상자수"]) + int(row["경상자수"]) + int(
            row["부상신고자수"]
        )
        in_zone = bool(row["어린이보호구역내"])
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sgg": sgg_of(row["법정동명"]),
                    "name": f"{row['법정동명']} {location}".strip(),
                    # 기존 프론트 필터(ACCIDENT_FILTER_KEY_BY_TYPE)가 두 값 다 "child"로 매핑함
                    "accidentType": "스쿨존어린이" if in_zone else "보행어린이",
                    "accidentCount": 1,
                    "casualties": casualties,
                    "inChildZone": int(in_zone),
                    "acdntNo": str(row["사고번호"]),
                    "acdntYear": int(row["사고연도"]),
                    "severity": row["사고내용"],
                    "detail": detail_of(row),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["경도"]), float(row["위도"])],
                },
            }
        )
    return features


def main() -> None:
    existing = json.loads(ACCIDENT_JSON.read_text())
    kept = [
        f
        for f in existing["features"]
        if f["properties"].get("accidentType") not in ("자전거", "보행어린이", "스쿨존어린이")
    ]

    bike_df = pd.read_csv(BIKE_CSV)
    if "역할" in bike_df.columns:
        bike_df = bike_df[bike_df["역할"] == "피해"].copy()
    child_df = pd.read_csv(CHILD_CSV)

    bike_features = build_bike_features(bike_df)
    child_features = build_child_features(child_df)

    merged = {"type": "FeatureCollection", "features": kept + bike_features + child_features}
    ACCIDENT_JSON.write_text(json.dumps(merged, ensure_ascii=False))
    print(
        f"자전거 사고 핀 {len(bike_features)}개, 어린이 보행자 사고 핀 {len(child_features)}개로 교체, "
        f"기존 노인 핀 {len(kept)}개 유지 -> 총 {len(merged['features'])}개"
    )


if __name__ == "__main__":
    main()
