"""
범죄 발생 + 교통사고 다발지점 위험도 분석 - 원본 데이터 전처리

원본 파일:
  - data/raw_crime/경찰청 서울특별시경찰청_경찰서별 5대범죄 발생 검거 현황_20241231.csv
    (data.go.kr, 경찰서 단위 - 자치구와 1:1이 아니라 매핑 필요)
  - data/raw_accident/전국교통사고다발지역표준데이터.csv
    (한국도로교통공단, 전국 좌표 단위 - 서울만 필터링, 자전거/보행노인/보행어린이/
    스쿨존어린이 사고다발지점)

경찰서 관할구역은 자치구 경계와 정확히 일치하지 않는다 (예: 종로구는 종로서+혜화서,
중구는 중부서+남대문서, 강남구는 강남서+수서서가 나눠서 담당). 대표 관할 자치구
기준으로 매핑해서 합산한다.

각 데이터셋마다 info() / isnull().sum() / dropna() 등 실제 전처리 과정을
그대로 남겨서, 왜 이 컬럼을 버리고 이 행을 지웠는지 추적 가능하게 한다.

출력: data/processed/{crime,accident}.csv
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_CRIME = (
    ROOT / "data" / "raw_crime" / "경찰청 서울특별시경찰청_경찰서별 5대범죄 발생 검거 현황_20241231.csv"
)
RAW_ACCIDENT = ROOT / "data" / "raw_accident" / "전국교통사고다발지역표준데이터.csv"
RAW_BIKE_ACCIDENT = (
    ROOT / "data" / "raw_bike_accident" / "자전거+교통사고_20260810112345.csv"
)
RAW_BIKE_ROAD = (
    ROOT / "data" / "raw_bike_road" / "자전거도로+현황(2013년+이후)_20260810112408.xlsx"
)
RAW_CHILD_ZONE_DIR = ROOT / "data" / "raw_child_zone"
RAW_ELDERLY_ZONE_DIR = ROOT / "data" / "raw_elderly_zone"
RAW_CHILD_ACCIDENT = (
    ROOT / "data" / "raw_child_accident" / "어린이+교통사고+현황_20260810144356.xlsx"
)
RAW_ELDERLY_ACCIDENT = (
    ROOT / "data" / "raw_elderly_accident" / "노인+교통사고+현황_20260810144410.xlsx"
)
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 경찰서(구분) -> 대표 관할 자치구. 여러 서가 한 자치구를 나눠 맡는 경우 합산된다.
STATION_TO_SGG = {
    "중부": "중구", "남대문": "중구",
    "종로": "종로구", "혜화": "종로구",
    "서대문": "서대문구", "서부": "은평구",
    "용산": "용산구",
    "성북": "성북구", "종암": "성북구",
    "동대문": "동대문구",
    "마포": "마포구",
    "영등포": "영등포구",
    "성동": "성동구",
    "동작": "동작구",
    "광진": "광진구",
    "강북": "강북구",
    "금천": "금천구",
    "중랑": "중랑구",
    "강남": "강남구", "수서": "강남구",
    "관악": "관악구",
    "강서": "강서구",
    "강동": "강동구",
    "구로": "구로구",
    "서초": "서초구", "방배": "서초구",
    "양천": "양천구",
    "송파": "송파구",
    "노원": "노원구",
    "은평": "은평구",
    "도봉": "도봉구",
}


def preprocess_crime() -> pd.DataFrame:
    print("\n===== 경찰서별 5대범죄 발생 검거 현황 =====")

    df = pd.read_csv(RAW_CRIME, encoding="cp949")
    print("[raw] shape:", df.shape)
    df.info()

    print("\nnull 개수:")
    print(df.isnull().sum())

    # "발생" 행만 사용 (검거 건수는 이번 분석 범위 밖).
    before = len(df)
    df = df[df["발생검거"] == "발생"]
    print(f"\n'검거' 행 {before - len(df)}개 제외, 남은 행: {len(df)}")

    df["자치구"] = df["구분"].map(STATION_TO_SGG)

    before = len(df)
    unmatched = df[df["자치구"].isna()]["구분"].unique()
    df = df.dropna(subset=["자치구"])
    print(f"자치구 매핑 실패 {before - len(df)}행 제거 (미매핑 경찰서: {list(unmatched)})")

    crime_by_sgg = df.groupby("자치구")["건수"].sum().reset_index()
    crime_by_sgg.columns = ["자치구", "crimeCount"]

    print("\n[clean] 자치구별 5대범죄 발생 건수:")
    print(crime_by_sgg.sort_values("crimeCount", ascending=False).to_string(index=False))
    return crime_by_sgg


def preprocess_accident() -> pd.DataFrame:
    print("\n===== 전국교통사고다발지역표준데이터 (서울) =====")

    df = pd.read_csv(RAW_ACCIDENT, encoding="cp949")
    print("[raw] shape:", df.shape)
    df.info()

    before = len(df)
    df = df[df["사고다발지역시도시군구"].str.contains("서울", na=False)]
    print(f"\n서울 외 지역 {before - len(df)}행 제외, 남은 행: {len(df)}")

    # 매년 폴리곤 좌표가 반복 등록돼 있어 최신 연도만, 지점(위치코드) 기준으로 중복 제거.
    latest_year = df["사고연도"].max()
    before = len(df)
    df = df[df["사고연도"] == latest_year]
    print(f"최신 연도({latest_year}) 외 {before - len(df)}행 제외, 남은 행: {len(df)}")

    before = len(df)
    df = df.drop_duplicates(subset="위치코드")
    print(f"중복 지점 {before - len(df)}행 제거, 남은 행: {len(df)}")

    keep_cols = [
        "사고다발지역시도시군구", "사고유형구분", "사고지역위치명",
        "사고건수", "사상자수", "위도", "경도",
    ]
    df = df[keep_cols]

    print("\nnull 개수:")
    print(df.isnull().sum())

    before = len(df)
    df = df.dropna(subset=["위도", "경도"])
    print(f"좌표 결측 {before - len(df)}행 제거")

    df["자치구"] = df["사고다발지역시도시군구"].str.extract(r"서울특별시\s+(\S+?구)")
    df = df.drop(columns=["사고다발지역시도시군구"]).rename(
        columns={"사고지역위치명": "위치명", "사고유형구분": "사고유형"}
    )

    df = df.reset_index(drop=True)
    print("\n[clean] head:")
    print(df.head())
    print("\n자치구별 사고다발지점 수:")
    print(df["자치구"].value_counts())
    return df


def preprocess_bike_accident() -> pd.DataFrame:
    print("\n===== 서울시 자전거 교통사고 현황(자치구별, 2025) =====")

    # 3단 헤더(연도 / 가해·피해운전자 구분 / 발생·사망·부상)라서 header=[0, 1, 2]로 읽는다.
    df = pd.read_csv(RAW_BIKE_ACCIDENT, header=[0, 1, 2])
    print("[raw] shape:", df.shape)
    df.info()

    df.columns = [
        "자치구별1", "자치구",
        "가해_발생", "가해_사망", "가해_부상",
        "피해_발생", "가해_사망2", "피해_부상",
    ]
    df = df[["자치구", "가해_발생", "피해_발생"]]

    # 첫 행(인덱스 0)은 "소계"(서울시 전체 합계)라 자치구 단위 분석에서 제외.
    df = df[df["자치구"] != "소계"]

    print("\nnull 개수:")
    print(df.isnull().sum())

    for col in ["가해_발생", "피해_발생"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["가해_발생", "피해_발생"])
    print(f"\n결측치 {before - len(df)}행 제거, 남은 행: {len(df)}")

    # 가해운전자(사고를 낸 쪽) + 피해운전자(당한 쪽) 발생건수를 합쳐 "자전거 관련 사고 총량"으로 본다.
    df["bikeAccidentCount"] = (df["가해_발생"] + df["피해_발생"]).astype(int)
    df = df[["자치구", "bikeAccidentCount"]].reset_index(drop=True)

    print("\n[clean] 자치구별 자전거 사고 발생 건수:")
    print(df.sort_values("bikeAccidentCount", ascending=False).to_string(index=False))
    return df


def preprocess_child_accident() -> pd.DataFrame:
    print("\n===== 서울시 어린이 교통사고 현황(자치구별, 2025) =====")

    # 3단 헤더(연도 / 어린이·보행어린이 구분 / 발생·사망·부상)라서 header=[0, 1, 2]로 읽는다.
    df = pd.read_excel(RAW_CHILD_ACCIDENT, header=[0, 1, 2])
    print("[raw] shape:", df.shape)
    df.info()

    # 실제 컬럼: 자치구별(1,2) + [어린이 교통사고 / 어린이보호구역내 어린이 교통사고 /
    # 보행 어린이 교통사고] × [발생건수/사망자수/부상자수] = 2 + 9 = 11.
    df.columns = [
        "자치구별1", "자치구",
        "전체_발생", "전체_사망", "전체_부상",
        "보호구역내_발생", "보호구역내_사망", "보호구역내_부상",
        "보행_발생", "보행_사망", "보행_부상",
    ]
    df = df[["자치구", "전체_발생", "보행_발생"]]

    # 첫 행(인덱스 0)은 "소계"(서울시 전체 합계)라 자치구 단위 분석에서 제외.
    df = df[df["자치구"] != "소계"]

    print("\nnull 개수:")
    print(df.isnull().sum())

    for col in ["전체_발생", "보행_발생"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["전체_발생", "보행_발생"])
    print(f"\n결측치 {before - len(df)}행 제거, 남은 행: {len(df)}")

    df = df.rename(columns={"전체_발생": "childAccidentTotal", "보행_발생": "childPedAccidentCount"})
    df["childAccidentTotal"] = df["childAccidentTotal"].astype(int)
    df["childPedAccidentCount"] = df["childPedAccidentCount"].astype(int)
    df = df.reset_index(drop=True)

    print("\n[clean] 자치구별 어린이 보행 교통사고 발생 건수:")
    print(df.sort_values("childPedAccidentCount", ascending=False).to_string(index=False))
    return df


def preprocess_elderly_accident() -> pd.DataFrame:
    print("\n===== 서울시 노인 교통사고 현황(자치구별, 2025) =====")

    # 3단 헤더(연도 / 노인·노인운전자·노인보행 구분 / 발생·사망·부상)라서 header=[0, 1, 2]로 읽는다.
    df = pd.read_excel(RAW_ELDERLY_ACCIDENT, header=[0, 1, 2])
    print("[raw] shape:", df.shape)
    df.info()

    df.columns = [
        "자치구별1", "자치구",
        "전체_발생", "전체_사망", "전체_부상",
        "운전자_발생", "운전자_사망", "운전자_부상",
        "보행_발생", "보행_사망", "보행_부상",
    ]
    df = df[["자치구", "전체_발생", "보행_발생"]]

    # 첫 행(인덱스 0)은 "소계"(서울시 전체 합계)라 자치구 단위 분석에서 제외.
    df = df[df["자치구"] != "소계"]

    print("\nnull 개수:")
    print(df.isnull().sum())

    for col in ["전체_발생", "보행_발생"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["전체_발생", "보행_발생"])
    print(f"\n결측치 {before - len(df)}행 제거, 남은 행: {len(df)}")

    df = df.rename(
        columns={"전체_발생": "elderlyAccidentTotal", "보행_발생": "elderlyPedAccidentCount"}
    )
    df["elderlyAccidentTotal"] = df["elderlyAccidentTotal"].astype(int)
    df["elderlyPedAccidentCount"] = df["elderlyPedAccidentCount"].astype(int)
    df = df.reset_index(drop=True)

    print("\n[clean] 자치구별 노인 보행 교통사고 발생 건수:")
    print(df.sort_values("elderlyPedAccidentCount", ascending=False).to_string(index=False))
    return df


def preprocess_bike_road() -> pd.DataFrame:
    print("\n===== 서울시 자전거도로 현황(자치구별, 2025) =====")

    # 헤더 4단(지역별/연도/노선구분/단위)이라 header 없이 읽고 직접 슬라이싱한다.
    df = pd.read_excel(RAW_BIKE_ROAD, sheet_name="데이터", header=None)
    print("[raw] shape:", df.shape)

    # 6~30행이 "도로변" 자치구 25개, 2열=자치구명, 4열=전체 길이(km) 소계.
    sub = df.iloc[6:31, [2, 4]].copy()
    sub.columns = ["자치구", "bikeRoadKm"]

    print("\nnull 개수:")
    print(sub.isnull().sum())

    sub["bikeRoadKm"] = pd.to_numeric(sub["bikeRoadKm"], errors="coerce")
    before = len(sub)
    sub = sub.dropna(subset=["자치구", "bikeRoadKm"])
    print(f"결측치 {before - len(sub)}행 제거, 남은 행: {len(sub)}")

    sub = sub.reset_index(drop=True)
    print("\n[clean] 자치구별 자전거도로 길이(km):")
    print(sub.sort_values("bikeRoadKm", ascending=False).to_string(index=False))
    return sub


def preprocess_child_zone() -> pd.DataFrame:
    print("\n===== 서울시 어린이보호구역(자치구별 25개 파일 병합) =====")

    files = sorted(RAW_CHILD_ZONE_DIR.glob("서울특별시_*_어린이보호구역*.csv"))
    print(f"파일 {len(files)}개 발견")

    frames = []
    for f in files:
        sgg = f.name.split("_")[1]
        df = pd.read_csv(f, encoding="utf-8")
        df["자치구"] = sgg
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    print("[raw] 병합 후 shape:", df.shape)
    df.info()

    keep_cols = [
        "자치구",
        "시설종류",
        "대상시설명",
        "위도",
        "경도",
        "CCTV설치여부",
        "CCTV설치대수",
        "보호구역도로폭",
    ]
    df = df[keep_cols].rename(columns={"대상시설명": "시설명"})

    print("\nnull 개수:")
    print(df.isnull().sum())

    for col in ["위도", "경도", "보호구역도로폭"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["위도", "경도"])
    print(f"\n좌표 결측 {before - len(df)}행 제거")
    # 도로폭 결측은 중앙값으로 채움 (도로 버퍼용)
    median_w = float(df["보호구역도로폭"].median()) if df["보호구역도로폭"].notna().any() else 8.0
    df["보호구역도로폭"] = df["보호구역도로폭"].fillna(median_w)

    df = df.reset_index(drop=True)
    print("\n[clean] head:")
    print(df.head())
    print("\n자치구별 어린이보호구역 수:")
    print(df["자치구"].value_counts())
    return df


def _parse_road_width(value) -> float | None:
    """'8', '5~7', '9.6~14.6' 형태를 평균 폭(m)으로 파싱."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip().replace(" ", "")
    if not text or text.lower() in {"nan", "none", "-"}:
        return None
    text = text.replace("～", "~").replace("-", "~")
    try:
        if "~" in text:
            left, right = text.split("~", 1)
            a, b = float(left), float(right)
            return (a + b) / 2.0
        return float(text)
    except ValueError:
        return None


def preprocess_elderly_zone() -> pd.DataFrame:
    print("\n===== 서울시 노인장애인보호구역(자치구별 24개 파일 병합, 도봉구 없음) =====")

    files = sorted(RAW_ELDERLY_ZONE_DIR.glob("서울특별시_*_노인장애인보호구역.csv"))
    print(f"파일 {len(files)}개 발견")

    frames = []
    for f in files:
        sgg = f.name.split("_")[1]
        df = pd.read_csv(f, encoding="utf-8")
        df["자치구"] = sgg
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    print("[raw] 병합 후 shape:", df.shape)
    df.info()

    keep_cols = [
        "자치구",
        "장소유형코드",
        "대상시설명",
        "위도",
        "경도",
        "CCTV설치여부",
        "CCTV설치대수",
        "보호구역도로폭",
    ]
    df = df[keep_cols].rename(columns={"대상시설명": "시설명", "장소유형코드": "시설종류"})

    print("\nnull 개수:")
    print(df.isnull().sum())

    for col in ["위도", "경도"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["보호구역도로폭"] = df["보호구역도로폭"].map(_parse_road_width)

    before = len(df)
    df = df.dropna(subset=["위도", "경도"])
    print(f"\n좌표 결측 {before - len(df)}행 제거")
    median_w = float(df["보호구역도로폭"].median()) if df["보호구역도로폭"].notna().any() else 8.0
    df["보호구역도로폭"] = df["보호구역도로폭"].fillna(median_w)

    df = df.reset_index(drop=True)
    print("\n[clean] head:")
    print(df.head())
    print("\n자치구별 노인장애인보호구역 수:")
    print(df["자치구"].value_counts())
    return df


def main() -> None:
    crime = preprocess_crime()
    accident = preprocess_accident()
    bike_accident = preprocess_bike_accident()
    bike_road = preprocess_bike_road()
    child_zone = preprocess_child_zone()
    elderly_zone = preprocess_elderly_zone()
    child_accident = preprocess_child_accident()
    elderly_accident = preprocess_elderly_accident()

    crime.to_csv(OUT_DIR / "crime.csv", index=False, encoding="utf-8-sig")
    accident.to_csv(OUT_DIR / "accident.csv", index=False, encoding="utf-8-sig")
    bike_accident.to_csv(OUT_DIR / "bike_accident.csv", index=False, encoding="utf-8-sig")
    bike_road.to_csv(OUT_DIR / "bike_road.csv", index=False, encoding="utf-8-sig")
    child_zone.to_csv(OUT_DIR / "child_zone.csv", index=False, encoding="utf-8-sig")
    elderly_zone.to_csv(OUT_DIR / "elderly_zone.csv", index=False, encoding="utf-8-sig")
    child_accident.to_csv(OUT_DIR / "child_accident.csv", index=False, encoding="utf-8-sig")
    elderly_accident.to_csv(OUT_DIR / "elderly_accident.csv", index=False, encoding="utf-8-sig")

    print("\n===== 저장 완료 =====")
    print(f"crime:            {len(crime)}행 -> {OUT_DIR / 'crime.csv'}")
    print(f"accident:         {len(accident)}행 -> {OUT_DIR / 'accident.csv'}")
    print(f"bike_accident:    {len(bike_accident)}행 -> {OUT_DIR / 'bike_accident.csv'}")
    print(f"bike_road:        {len(bike_road)}행 -> {OUT_DIR / 'bike_road.csv'}")
    print(f"child_zone:       {len(child_zone)}행 -> {OUT_DIR / 'child_zone.csv'}")
    print(f"elderly_zone:     {len(elderly_zone)}행 -> {OUT_DIR / 'elderly_zone.csv'}")
    print(f"child_accident:   {len(child_accident)}행 -> {OUT_DIR / 'child_accident.csv'}")
    print(f"elderly_accident: {len(elderly_accident)}행 -> {OUT_DIR / 'elderly_accident.csv'}")


if __name__ == "__main__":
    main()
