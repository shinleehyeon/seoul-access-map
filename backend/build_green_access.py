"""
서울 주요 공원 + 자치구 폴리곤으로 '도보 10분(800m) 녹지 도달권'을 계산한다.

출력 (frontend/public/data/):
  - parks.json          공원 포인트
  - district_stats.json 자치구별 취약 지수
  - coverage_samples.json 격자 샘플(선택 시각화용, 간략)

가설: 공원 '개수'보다, 도보권 밖 인구·면적 비중이 실제 체감 격차를 더 잘 설명한다.
"""

from __future__ import annotations

import json
import math
import os
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "frontend" / "public" / "data"
DISTRICTS_PATH = OUT_DIR / "seoul_districts.json"

# 서울시 주민등록인구 (2024년 말 근사치, 단위: 명) — 구별 정규화용
# 출처: 서울 열린데이터/행정안전부 주민등록 통계 계열 (전처리 가중치)
POPULATION = {
    "종로구": 140241,
    "중구": 121312,
    "용산구": 208249,
    "성동구": 279289,
    "광진구": 336882,
    "동대문구": 336644,
    "중랑구": 383211,
    "성북구": 425230,
    "강북구": 288113,
    "도봉구": 306432,
    "노원구": 498213,
    "은평구": 462815,
    "서대문구": 306442,
    "마포구": 364532,
    "양천구": 431528,
    "강서구": 563598,
    "구로구": 392241,
    "금천구": 227366,
    "영등포구": 375133,
    "동작구": 380596,
    "관악구": 485518,
    "서초구": 407864,
    "강남구": 550826,
    "송파구": 658871,
    "강동구": 459970,
}

WALK_M = 800  # ≈ 도보 10분
GRID_STEP = 0.0045  # ≈ 500m
SEOUL_API_KEY = os.environ.get("SEOUL_API_KEY", "")


def load_api_key() -> str:
    if SEOUL_API_KEY:
        return SEOUL_API_KEY
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("SEOUL_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("SEOUL_API_KEY missing (.env)")


def fetch_parks(key: str) -> list[dict]:
    url = f"http://openapi.seoul.go.kr:8088/{key}/json/SearchParkInfoService/1/200/"
    print(f"공원 API 호출: SearchParkInfoService")
    with urllib.request.urlopen(url, timeout=60) as res:
        payload = json.loads(res.read().decode("utf-8"))
    rows = payload.get("SearchParkInfoService", {}).get("row", [])
    print(f"  -> {len(rows)}건")
    return rows


def parse_area_m2(raw: str | None) -> float | None:
    if not raw:
        return None
    # 첫 번째 ㎡ 수치만 사용 (뒤에 임야/세부 면적이 중복 기재되는 경우가 많음)
    m = re.search(r"([\d,.]+)\s*㎡", raw.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def normalize_sgg(rgn: str | None, addr: str | None) -> str | None:
    text = f"{rgn or ''} {addr or ''}"
    for sgg in POPULATION:
        if sgg in text:
            return sgg
    return None


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_districts():
    geo = json.loads(DISTRICTS_PATH.read_text(encoding="utf-8"))
    districts = []
    for feat in geo["features"]:
        name = feat["properties"]["name"]
        geom = shape(feat["geometry"])
        districts.append({"sgg": name, "geom": geom, "prepared": prep(geom)})
    return districts


def build_parks(rows: list[dict]) -> list[dict]:
    parks = []
    for r in rows:
        try:
            lon = float(r["XCRD"])
            lat = float(r["YCRD"])
        except (TypeError, ValueError, KeyError):
            continue
        if not (126.7 < lon < 127.3 and 37.4 < lat < 37.8):
            continue
        sgg = normalize_sgg(r.get("RGN"), r.get("PARK_ADDR"))
        if sgg is None:
            continue
        parks.append(
            {
                "id": f"park-{r.get('SN')}",
                "name": r.get("PARK_NM") or "공원",
                "lon": lon,
                "lat": lat,
                "sgg": sgg,
                "areaM2": parse_area_m2(r.get("AREA")),
                "address": r.get("PARK_ADDR") or None,
                "outline": (r.get("PARK_OTLN") or "")[:280] or None,
                "image": r.get("IMG") or None,
            }
        )
    print(f"유효 공원 {len(parks)}개 (서울 자치구 매칭)")
    return parks


def sample_and_score(parks: list[dict], districts: list[dict]):
    print("격자 샘플링 + 최근접 공원 거리 계산...")
    minx = min(d["geom"].bounds[0] for d in districts)
    miny = min(d["geom"].bounds[1] for d in districts)
    maxx = max(d["geom"].bounds[2] for d in districts)
    maxy = max(d["geom"].bounds[3] for d in districts)

    # per-district accumulators
    stats = {
        d["sgg"]: {
            "sgg": d["sgg"],
            "sampleCount": 0,
            "uncoveredCount": 0,
            "distSum": 0.0,
        }
        for d in districts
    }

    samples_out = []  # lightweight for optional map layer
    y = miny
    while y <= maxy:
        x = minx
        while x <= maxx:
            pt = Point(x, y)
            sgg = None
            for d in districts:
                if d["prepared"].contains(pt):
                    sgg = d["sgg"]
                    break
            if sgg:
                nearest = min(haversine_m(x, y, p["lon"], p["lat"]) for p in parks)
                uncovered = nearest > WALK_M
                stats[sgg]["sampleCount"] += 1
                stats[sgg]["uncoveredCount"] += int(uncovered)
                stats[sgg]["distSum"] += nearest
                # keep every 3rd uncovered + sparse covered for viz size
                if uncovered or (stats[sgg]["sampleCount"] % 5 == 0):
                    samples_out.append(
                        {
                            "lon": round(x, 5),
                            "lat": round(y, 5),
                            "sgg": sgg,
                            "nearestM": round(nearest),
                            "uncovered": uncovered,
                        }
                    )
            x += GRID_STEP
        y += GRID_STEP

    # park aggregates
    park_by_sgg: dict[str, list] = defaultdict(list)
    for p in parks:
        park_by_sgg[p["sgg"]].append(p)

    district_stats = []
    for sgg, pop in POPULATION.items():
        st = stats.get(sgg, {"sampleCount": 0, "uncoveredCount": 0, "distSum": 0.0})
        n = st["sampleCount"] or 1
        uncovered_share = st["uncoveredCount"] / n
        mean_nearest = st["distSum"] / n
        park_list = park_by_sgg.get(sgg, [])
        area_m2 = sum(p["areaM2"] or 0 for p in park_list)
        park_count = len(park_list)
        parks_per_10k = park_count / pop * 10000 if pop else 0
        # 취약 점수: 도달 실패 비중 70% + 평균거리 정규화 30%
        dist_norm = min(mean_nearest / 1500.0, 1.0)
        vulnerability = round(100 * (0.7 * uncovered_share + 0.3 * dist_norm), 1)
        district_stats.append(
            {
                "sgg": sgg,
                "population": pop,
                "parkCount": park_count,
                "areaM2": round(area_m2),
                "parksPer10k": round(parks_per_10k, 2),
                "meanNearestM": round(mean_nearest),
                "uncoveredShare": round(uncovered_share, 4),
                "vulnerabilityScore": vulnerability,
                "sampleCount": st["sampleCount"],
            }
        )

    district_stats.sort(key=lambda d: d["sgg"])
    print(f"  -> 샘플 포인트(저장) {len(samples_out)}개, 자치구 {len(district_stats)}곳")
    return district_stats, samples_out


def main():
    key = load_api_key()
    rows = fetch_parks(key)
    parks = build_parks(rows)
    if not parks:
        raise SystemExit("No parks parsed")

    districts = load_districts()
    district_stats, samples = sample_and_score(parks, districts)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "parks.json").write_text(json.dumps(parks, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT_DIR / "district_stats.json").write_text(
        json.dumps(district_stats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT_DIR / "coverage_samples.json").write_text(
        json.dumps(
            {"walkMeters": WALK_M, "points": samples},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    worst = max(district_stats, key=lambda d: d["vulnerabilityScore"])
    best = min(district_stats, key=lambda d: d["vulnerabilityScore"])
    print(
        f"완료: 공원 {len(parks)} / 최취약 {worst['sgg']}({worst['vulnerabilityScore']}) "
        f"/ 최양호 {best['sgg']}({best['vulnerabilityScore']})"
    )


if __name__ == "__main__":
    main()
