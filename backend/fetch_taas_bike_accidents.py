"""Fetch Seoul bicycle accident records (perpetrator + victim) from TAAS.

TAAS session: update SESSION_COOKIE / CSRF_TOKEN from browser Copy as cURL
when auth expires.

searchSimpleCondition:
  33 = 가해차량: 자전거
  34 = 피해차량: 자전거

x_crdnt / y_crdnt are EPSG:5179; converted to WGS84 lon/lat.
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point

TAAS_URL = "https://taas.koroad.or.kr/gis/srh/ash/selectAccidentInfo.do"

SESSION_COOKIE = (
    "SL_GWPT_Show_Hide_tmp=1; "
    "TAASJSESSIONID=thSl3YrEWM63WvzH3osv10SWirZ69CHpfwaimbplE66t6Nj6TY9Vyx7gag3jNBl1.amV1c19kb21haW4vc2VydmVyMQ=="
)
CSRF_TOKEN = "8d4e33c9-edb2-463a-9b98-89cc226a45dd"

YEAR_RANGES = [("2020", "2024"), ("2025", "2025")]
LEGALDONG_CODE_PREFIX = "11%"
ACDNT_GAE_CODE = "01,02,03,04"
# (조건코드, 역할)
CONDITIONS = [("33", "가해"), ("34", "피해")]

CRS_TAAS = "EPSG:5179"
CRS_WGS84 = "EPSG:4326"

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "raw_bike_accident" / "서울_자전거사고_TAAS.csv"

COLUMN_MAP = {
    "acdnt_no": "사고번호",
    "acdnt_year": "사고연도",
    "acdnt_dd_dc": "사고월",
    "dfk_dc": "요일",
    "tmzon_div_1_dc": "주야구분",
    "occrrnc_time_dc": "발생시각",
    "legaldong_name": "법정동명",
    "acdnt_hdc": "사고유형_대분류",
    "acdnt_mdc": "사고유형_중분류",
    "acdnt_dc": "사고유형",
    "lrg_violt_1_dc": "법규위반",
    "wether_sttus_dc": "기상상태",
    "road_stle_dc": "도로형태",
    "road_div": "도로구분코드",
    "road_no": "도로번호",
    "route_nm": "도로명",
    "rdse_sttus_dc": "노면상태",
    "acdnt_gae_dc": "사고내용",
    "dprs_cnt": "사망자수",
    "sep_cnt": "중상자수",
    "slp_cnt": "경상자수",
    "inj_aplcnt_cnt": "부상신고자수",
    "injury_dgree_1_dc": "당사자1_피해정도",
    "acdnt_age_1_dc": "당사자1_연령대",
    "sexdstn_div_1_dc": "당사자1_성별",
    "bdy_injury_part_1_dc": "당사자1_상해부위",
    "wrngdo_vhcle_asort_dc": "가해차종",
    "dmge_vhcle_asort_dc": "피해차종",
    "injury_dgree_2_dc": "당사자2_피해정도",
    "acdnt_age_2_dc": "당사자2_연령대",
    "sexdstn_div_2_dc": "당사자2_성별",
    "bdy_injury_part_2_dc": "당사자2_상해부위",
    "acdnt_pos": "사고위치설명",
    "lat": "위도",
    "lon": "경도",
    "x_crdnt": "원본X좌표_EPSG5179",
    "y_crdnt": "원본Y좌표_EPSG5179",
    "role": "역할",
}


def fetch_records(start_year: str, end_year: str, condition: str) -> list[dict]:
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "X-CSRF-TOKEN": CSRF_TOKEN,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Origin": "https://taas.koroad.or.kr",
        "Referer": "https://taas.koroad.or.kr/gis/mcm/mcl/initMap.do?menuId=GIS_GMP_STS_RSN",
        "Cookie": SESSION_COOKIE,
    }
    payload = {
        "searchType": "00",
        "pageIndex": 1,
        "zoneYn": False,
        "engnCode": "00",
        "startAcdntYear": start_year,
        "endAcdntYear": end_year,
        "legaldongCode": LEGALDONG_CODE_PREFIX,
        "acdntGaeCode": ACDNT_GAE_CODE,
        "searchSimpleCondition": condition,
    }
    resp = requests.post(TAAS_URL, headers=headers, data=json.dumps(payload), timeout=120)
    resp.raise_for_status()
    body = resp.json()
    if body.get("status") == "error":
        raise RuntimeError(body.get("message") or body)
    result = body["resultValue"]
    records = result["accidentInfoList"]
    total = result["paginationInfo"]["totalRecordCount"]
    if len(records) != total:
        raise RuntimeError(
            f"expected {total} records but got {len(records)} - TAAS may have started paginating; "
            "narrow the year range and merge multiple calls instead"
        )
    return records


def to_wgs84(df: pd.DataFrame) -> pd.DataFrame:
    geometry = [Point(x, y) for x, y in zip(df["x_crdnt"], df["y_crdnt"])]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs=CRS_TAAS).to_crs(CRS_WGS84)
    df = df.copy()
    df["lon"] = gdf.geometry.x
    df["lat"] = gdf.geometry.y
    return df


def to_korean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df[list(COLUMN_MAP.keys())].rename(columns=COLUMN_MAP)
    # 자전거 관점 상대차종: 가해 사고→피해차종, 피해 사고→가해차종
    df["상대차종"] = df.apply(
        lambda r: r["피해차종"] if r["역할"] == "가해" else r["가해차종"],
        axis=1,
    )
    return df


def main() -> None:
    records: list[dict] = []
    for condition, role in CONDITIONS:
        for start_year, end_year in YEAR_RANGES:
            year_records = fetch_records(start_year, end_year, condition)
            for r in year_records:
                r["role"] = role
            print(f"{role}({condition}) {start_year}~{end_year}: {len(year_records)}건")
            records.extend(year_records)

    df = pd.DataFrame(records)
    df = df[(df["x_crdnt"] != 0) & (df["y_crdnt"] != 0)]
    df = to_wgs84(df)
    df = to_korean_columns(df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
    print(f"saved {len(df)} records to {OUTPUT_PATH}")
    print(df.groupby(["역할", "사고연도"]).size().unstack(fill_value=0))


if __name__ == "__main__":
    main()
