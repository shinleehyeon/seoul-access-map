"""Fetch individual-level Seoul bicycle accident records (with coordinates) from TAAS.

TAAS (교통사고분석시스템, taas.koroad.or.kr) is session-authenticated: the
TAASJSESSIONID cookie and X-CSRF-TOKEN below are copied from a logged-in
browser's network tab and expire after the session times out. If this script
starts failing with an auth error or empty response, log into TAAS in a
browser, open devtools > Network, re-run the "선택 지역 사고 조회" search,
right-click the selectAccidentInfo.do request > Copy as cURL, and update
SESSION_COOKIE / CSRF_TOKEN below.

x_crdnt / y_crdnt in the API response are EPSG:5179 (GRS80 Unified CS)
projected meters, not lat/lon. This script converts them to WGS84 (EPSG:4326)
using the same geopandas/pyproj stack as the other backend scripts.
"""

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point

TAAS_URL = "https://taas.koroad.or.kr/gis/srh/ash/selectAccidentInfo.do"

SESSION_COOKIE = (
    "SL_GWPT_Show_Hide_tmp=1; "
    "TAASJSESSIONID=F8egkRtXo1O1JFtrWfLoOvxs6xfOnlG3f0IXvolaPete5NScTCyfP09uEja1vl3j.amV1c19kb21haW4vc2VydmVyMQ=="
)
CSRF_TOKEN = "5638a8d3-9e20-4056-ba0a-9e03f84c852e"

START_YEAR = "2020"
END_YEAR = "2024"
LEGALDONG_CODE_PREFIX = "11%"  # 서울특별시
ACDNT_GAE_CODE = "01,02,03,04"  # 사망/중상/경상/부상신고 전체
SEARCH_SIMPLE_CONDITION = "33"  # 가해차량: 자전거 (network capture value)

CRS_TAAS = "EPSG:5179"
CRS_WGS84 = "EPSG:4326"

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "raw_bike_accident" / "서울_자전거사고_TAAS.csv"

# TAAS raw field -> Korean column name. Only fields worth keeping are listed;
# everything else (request-echo fields, all-null fields, and redundant raw
# codes that duplicate a *_dc description column) is dropped in to_wgs84().
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
    "dmge_vhcle_asort_dc": "상대차종",
    "injury_dgree_2_dc": "당사자2_피해정도",
    "acdnt_age_2_dc": "당사자2_연령대",
    "sexdstn_div_2_dc": "당사자2_성별",
    "bdy_injury_part_2_dc": "당사자2_상해부위",
    "acdnt_pos": "사고위치설명",
    "lat": "위도",
    "lon": "경도",
    "x_crdnt": "원본X좌표_EPSG5179",
    "y_crdnt": "원본Y좌표_EPSG5179",
}


def fetch_records() -> list[dict]:
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
        "startAcdntYear": START_YEAR,
        "endAcdntYear": END_YEAR,
        "legaldongCode": LEGALDONG_CODE_PREFIX,
        "acdntGaeCode": ACDNT_GAE_CODE,
        "searchSimpleCondition": SEARCH_SIMPLE_CONDITION,
    }
    resp = requests.post(TAAS_URL, headers=headers, data=json.dumps(payload), timeout=60)
    resp.raise_for_status()
    body = resp.json()
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
    return df


def main() -> None:
    records = fetch_records()
    df = pd.DataFrame(records)
    df = df[(df["x_crdnt"] != 0) & (df["y_crdnt"] != 0)]
    df = to_wgs84(df)
    df = to_korean_columns(df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")
    print(f"saved {len(df)} records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
