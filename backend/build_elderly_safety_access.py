"""
고령 1인가구 경로당(쉼터) 접근 공백 스코어 계산.

입력 (data/processed/, preprocess_elderly_safety.py 결과물):
  - elderly.csv        행정동별 독거노인 수
  - senior_center.csv  자치구별 경로당 목록 (3,644개, 좌표 없음 - 개수만 사용)
  - district_stats.json에 이미 있는 약국 gapScore/pharmacyCount (build_pharmacy_access.py 산출물)

계산:
  - elderlyPer10k     자치구 인구 1만명당 독거노인 수
  - centerCount        자치구 내 경로당 수
  - centerPer1kElderly 독거노인 1,000명당 경로당 수 (적을수록 취약)
  - pharmacyGapScore   기존 저녁 약국 공백 점수(0~100)
  - gapScore(0~100)    독거노인 밀도(50%) + 경로당 부족(25%) + 약국 부족(25%)을 합친
                        "고령 1인가구 쉼터 접근 공백" 통합 점수. 지도 코로플레스는 이 값 하나로 칠한다.

경로당은 좌표가 없어 지도에 개별 핀으로 찍지 않는다 (자치구 집계로만 스코어에 반영).
지도에는 기존 약국 핀만 남긴다.
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROCESSED = ROOT / "data" / "processed"
OUT_DIR = ROOT / "frontend" / "public" / "data"
STATS_PATH = OUT_DIR / "district_stats.json"

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
    elderly = pd.read_csv(PROCESSED / "elderly.csv")
    senior_center = pd.read_csv(PROCESSED / "senior_center.csv")

    elderly_by_sgg = elderly.groupby("자치구")["독거노인_계"].sum()
    center_by_sgg = senior_center.groupby("자치구").size()

    stats = json.loads(STATS_PATH.read_text())
    by_sgg = {d["sgg"]: d for d in stats}

    rows = []
    for sgg, population in POPULATION.items():
        elderly_count = int(elderly_by_sgg.get(sgg, 0))
        center_count = int(center_by_sgg.get(sgg, 0))

        elderly_per_10k = round(elderly_count / population * 10_000, 2) if population else 0.0
        center_per_1k_elderly = round(center_count / elderly_count * 1000, 2) if elderly_count else 0.0
        # 원래 약국 gapScore를 "약국 부족" 요인으로 사용 (재실행 대비 pharmacyGapScore 우선).
        pharmacy_gap = by_sgg.get(sgg, {}).get("pharmacyGapScore", by_sgg.get(sgg, {}).get("gapScore", 0.0))

        rows.append(
            {
                "sgg": sgg,
                "elderlyCount": elderly_count,
                "elderlyPer10k": elderly_per_10k,
                "centerCount": center_count,
                "centerPer1kElderly": center_per_1k_elderly,
                "pharmacyGapScore": pharmacy_gap,
            }
        )

    df = pd.DataFrame(rows)

    def norm(s: pd.Series) -> pd.Series:
        return (s - s.min()) / (s.max() - s.min()) if s.max() > s.min() else s * 0

    elderly_n = norm(df["elderlyPer10k"])
    center_n = norm(df["centerPer1kElderly"])  # 경로당 밀도: 높을수록 여유
    pharmacy_n = norm(df["pharmacyGapScore"])  # 이미 0~100 스케일의 "약국 공백"

    raw_score = elderly_n * 0.5 + (1 - center_n) * 0.25 + pharmacy_n * 0.25
    df["gapScore"] = (raw_score * 100).round(1)

    print("\n===== 고령 1인가구 쉼터 접근 공백 통합 점수 (상위 8) =====")
    print(df.sort_values("gapScore", ascending=False).head(8).to_string(index=False))

    merged = 0
    for row in df.to_dict("records"):
        target = by_sgg.get(row["sgg"])
        if target is None:
            continue
        target.pop("erCount", None)
        target.pop("erPer10k", None)
        target.update(row)
        merged += 1

    STATS_PATH.write_text(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"\n{merged}개 자치구 병합 완료 -> {STATS_PATH}")


if __name__ == "__main__":
    main()
