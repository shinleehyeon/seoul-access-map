"""
고령 1인가구 경로당(쉼터) 접근 공백 분석 - 원본 데이터 전처리

원본 파일:
  - data/raw_elderly/독거노인+현황(연령별_동별)_20260810091507.csv
    (서울 열린데이터광장, 3단 헤더, 동별 독거노인 수)
  - data/raw_senior_center/(서울시경로당)현황3644(25.6월말 기준).xlsx
    (대한노인회 서울시연합회, 자치구별 경로당 목록 - 좌표 없이 주소만 제공)

경로당 파일에는 위경도가 없어 지도에 개별 핀으로 찍기엔 3,644개나 되어
너무 산만해진다. 대신 자치구별 "독거노인 대비 경로당 수"를 스코어 계산에만
반영하고, 지도에는 개별 위치를 표시하지 않는다.

각 데이터셋마다 info() / isnull().sum() / dropna() 등 실제 전처리 과정을
그대로 남겨서, 왜 이 컬럼을 버리고 이 행을 지웠는지 추적 가능하게 한다.

출력: data/processed/{elderly,senior_center}.csv
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_ELDERLY = ROOT / "data" / "raw_elderly" / "독거노인+현황(연령별_동별)_20260810091507.csv"
RAW_SENIOR_CENTER = (
    ROOT / "data" / "raw_senior_center" / "(서울시경로당)현황3644(25.6월말 기준).xlsx"
)
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def preprocess_elderly() -> pd.DataFrame:
    print("\n===== 독거노인 현황(연령별/동별) =====")

    # 3단 헤더(동별(1)/동별(2)/동별(3), 연도, 항목)라서 header=[0, 1, 2]로 읽는다.
    df = pd.read_csv(RAW_ELDERLY, header=[0, 1, 2])
    print("[raw] shape:", df.shape)
    df.info()

    # 첫 행은 실제 데이터가 아니라 컬럼 설명(계/65~79세/80세 이상) 반복이라 제거.
    df = df.iloc[1:].reset_index(drop=True)

    df.columns = ["시도", "자치구", "행정동", "독거노인_계", "독거노인_65_79", "독거노인_80이상"] + [
        f"col_{i}" for i in range(6, len(df.columns))
    ]
    df = df[["시도", "자치구", "행정동", "독거노인_계", "독거노인_65_79", "독거노인_80이상"]]

    print("\n[trimmed] null 개수:")
    print(df.isnull().sum())

    # "소계" 행(자치구/서울시 합계 row)은 행정동 단위 분석에 필요 없으므로 제거.
    df = df[df["행정동"] != "소계"]
    df = df[df["자치구"] != "소계"]

    for col in ["독거노인_계", "독거노인_65_79", "독거노인_80이상"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["독거노인_계"])
    print(f"\n결측치(독거노인_계 NaN) {before - len(df)}행 제거, 남은 행: {len(df)}")

    df = df.reset_index(drop=True)
    print("\n[clean] head:")
    print(df.head())
    return df


def preprocess_senior_center() -> pd.DataFrame:
    print("\n===== 서울시 경로당 현황 =====")

    # 실제 표는 4행부터 시작 (앞 3행은 제목/안내 문구).
    df = pd.read_excel(RAW_SENIOR_CENTER, sheet_name="2. 경로당", header=3)
    print("[raw] shape:", df.shape)
    df.info()

    # 5행째(인덱스 0)는 "3644" 총계 안내줄이라 실제 데이터가 아니다.
    df = df.iloc[2:].reset_index(drop=True)

    keep_cols = ["시군구명", "시설종류", "시설명(경로당명)", "주소(도로명)"]
    df = df[keep_cols].rename(
        columns={"시군구명": "자치구", "시설명(경로당명)": "시설명", "주소(도로명)": "주소"}
    )

    print("\nnull 개수:")
    print(df.isnull().sum())

    before = len(df)
    df = df.dropna(subset=["자치구", "시설명"])
    print(f"\n자치구/시설명 결측 {before - len(df)}행 제거")

    before = len(df)
    df = df.drop_duplicates(subset=["자치구", "시설명", "주소"])
    print(f"중복 경로당 {before - len(df)}행 제거, 남은 행: {len(df)}")

    df = df.reset_index(drop=True)
    print("\n[clean] head:")
    print(df.head())
    print("\n자치구별 개수:")
    print(df["자치구"].value_counts())
    return df


def main() -> None:
    elderly = preprocess_elderly()
    senior_center = preprocess_senior_center()

    elderly.to_csv(OUT_DIR / "elderly.csv", index=False, encoding="utf-8-sig")
    senior_center.to_csv(OUT_DIR / "senior_center.csv", index=False, encoding="utf-8-sig")

    print("\n===== 저장 완료 =====")
    print(f"elderly:       {len(elderly)}행 -> {OUT_DIR / 'elderly.csv'}")
    print(f"senior_center: {len(senior_center)}행 -> {OUT_DIR / 'senior_center.csv'}")


if __name__ == "__main__":
    main()
