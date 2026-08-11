"""서울시 어린이 보행자 사고(TAAS 개별사고)를 받아 보호구역 내/외 여부까지 붙인다.

TAAS "보행 어린이 사고"(searchSimpleCondition=44, 전체)와
"어린이보호구역내 어린이 보행자 사고"(searchSimpleCondition=41, 부분집합)를 각각 받아서,
41에 있는 사고번호(acdnt_no)를 44 데이터에 표시하는 방식으로 인/아웃 구역을 나눈다.
(TAAS 자체 판정을 그대로 쓰는 게 반경 버퍼로 근사하는 것보다 정확함 — 41 결과는
44 결과의 완전한 부분집합임을 확인했음.)

세션 인증은 fetch_taas_bike_accidents.py와 동일한 방식 — SESSION_COOKIE/CSRF_TOKEN이
만료되면 브라우저에서 재로그인 후 selectAccidentInfo.do 요청을 다시 Copy as cURL 해서
아래 값을 교체해야 한다.

입력: TAAS API (searchSimpleCondition 44, 41)
출력: data/raw_child_accident/서울_어린이보행자사고_TAAS.csv
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
    "TAASJSESSIONID=F8egkRtXo1O1JFtrWfLoOvxs6xfOnlG3f0IXvolaPete5NScTCyfP09uEja1vl3j.amV1c19kb21haW4vc2VydmVyMQ=="
)
CSRF_TOKEN = "5638a8d3-9e20-4056-ba0a-9e03f84c852e"

START_YEAR = "2020"
END_YEAR = "2024"
LEGALDONG_CODE_PREFIX = "11%"  # 서울특별시
ACDNT_GAE_CODE = "01,02,03,04"  # 사망/중상/경상/부상신고 전체
COND_ALL_CHILD_PEDESTRIAN = "44"  # 보행 어린이 사고 (전체)
COND_ZONE_CHILD_PEDESTRIAN = "41"  # 어린이보호구역내 어린이 보행자 사고 (부분집합)

CRS_TAAS = "EPSG:5179"
CRS_WGS84 = "EPSG:4326"

OUTPUT_PATH = (
    Path(__file__).parent.parent / "data" / "raw_child_accident" / "서울_어린이보행자사고_TAAS.csv"
)

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
    "wrngdo_vhcle_asort_dc": "가해차종",
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


def fetch_records(search_simple_condition: str) -> list[dict]:
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
        "searchSimpleCondition": search_simple_condition,
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


def main() -> None:
    all_records = fetch_records(COND_ALL_CHILD_PEDESTRIAN)
    zone_records = fetch_records(COND_ZONE_CHILD_PEDESTRIAN)
    zone_ids = {r["acdnt_no"] for r in zone_records}
    if not zone_ids.issubset({r["acdnt_no"] for r in all_records}):
        raise RuntimeError(
            "어린이보호구역내 사고(41) 중 전체 보행 어린이 사고(44)에 없는 건이 있음 - "
            "TAAS 분류 기준이 바뀌었을 수 있으니 확인 필요"
        )

    df = pd.DataFrame(all_records)
    df = df[(df["x_crdnt"] != 0) & (df["y_crdnt"] != 0)]
    df["어린이보호구역내"] = df["acdnt_no"].isin(zone_ids).astype(int)
    df = to_wgs84(df)
    keep_cols = list(COLUMN_MAP.keys()) + ["어린이보호구역내"]
    df = df[keep_cols].rename(columns=COLUMN_MAP)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False, encoding="utf-8-sig")

    in_zone = int(df["어린이보호구역내"].sum())
    total = len(df)
    print(f"saved {total} records to {OUTPUT_PATH}")
    print(f"보호구역 내: {in_zone}건 ({in_zone / total:.1%}) / 보호구역 밖: {total - in_zone}건")


if __name__ == "__main__":
    main()
