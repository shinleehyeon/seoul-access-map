"""
서울 약국 운영시간 + 행정동 생활인구로 '저녁 약국 도보 공백'을 계산한다.

데이터:
  - TbPharmacyOperateInfo (약국 운영정보)
  - SPOP_LOCAL_RESD_DONG (행정동 생활인구, 저녁 21시)
  - 행정동 경계 + OSM 건물 폴리곤 (HangJeongDong geojson, 건물 밀집 지점을 대표 좌표로 사용)

정의:
  - evening: 평일(월~금) 마감 >= 21:00
  - lateNight: 마감 >= 22:00
  - 공백: 행정동 대표 좌표(건물 밀집부 무게중심) → 최근접 저녁약국 거리 > 800m
  - 구 점수: 생활인구 가중 공백 비중 (빈 산/공원 격자에 깎이지 않음)

출력: pharmacies.json, district_stats.json, summary.json, coverage_samples.json
"""

from __future__ import annotations

import json
import math
import os
import urllib.request
from collections import defaultdict
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "frontend" / "public" / "data"
DISTRICTS_PATH = OUT_DIR / "seoul_districts.json"

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

WALK_M = 800
EVENING_CLOSE = 2100
LATE_CLOSE = 2200
PAGE = 1000
# 생활인구 기준일·시각 (저녁 약국 수요 시각)
SPOP_DATE = "20260731"
SPOP_HOUR = "21"
DONG_GEO_URL = (
    "https://raw.githubusercontent.com/vuski/admdongkor/master/"
    "ver20230701/HangJeongDong_ver20230701.geojson"
)
CACHE_DIR = ROOT / "cache"


def load_api_key() -> str:
    env = os.environ.get("SEOUL_API_KEY")
    if env:
        return env
    for path in (ROOT / ".env", ROOT / "frontend" / ".env.local"):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            if line.startswith("SEOUL_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("SEOUL_API_KEY missing")


def parse_hhmm(raw: object) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s in {"-", "null", "None"}:
        return None
    try:
        v = int(s)
    except ValueError:
        return None
    if v <= 0 or v > 2400:
        return None
    return v


def fmt_hhmm(v: int | None) -> str | None:
    if v is None:
        return None
    return f"{v // 100:02d}:{v % 100:02d}"


def normalize_sgg(addr: str | None) -> str | None:
    text = addr or ""
    for sgg in POPULATION:
        if sgg in text:
            return sgg
    return None


def close_hhmm_from_pair(pair: object) -> int | None:
    if not isinstance(pair, (list, tuple)) or len(pair) < 2:
        return None
    raw = pair[1]
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or ":" not in s:
        return None
    try:
        h, m = s.split(":", 1)
        return int(h) * 100 + int(m)
    except ValueError:
        return None


def is_weekend_late(p: dict) -> bool:
    """토·일·공휴일 중 마감 >= 22:00"""
    hours = p.get("hours") or {}
    for key in ("sat", "sun", "holiday"):
        c = close_hhmm_from_pair(hours.get(key))
        if c is not None and c >= LATE_CLOSE:
            return True
    return False


def enrich_district_metrics(district_stats: list[dict], pharmacies: list[dict]) -> tuple[list[dict], dict]:
    """주말 심야 · 저녁 쏠림 · 생활인구 괴리 지표."""
    by_sgg: dict[str, list] = defaultdict(list)
    for p in pharmacies:
        by_sgg[p["sgg"]].append(p)

    total_evening = sum(1 for p in pharmacies if p["isEvening"])
    total_weekend = sum(1 for p in pharmacies if is_weekend_late(p))

    out = []
    for d in district_stats:
        rows = by_sgg.get(d["sgg"], [])
        weekend = sum(1 for p in rows if is_weekend_late(p))
        eve_only = sum(1 for p in rows if p["isEvening"] and not p["isLateNight"])
        late_only = sum(1 for p in rows if p["isLateNight"] and not p["isEvening"])
        both = sum(1 for p in rows if p["isEvening"] and p["isLateNight"])
        pop = d["population"] or 1
        live = d.get("eveningLivingPop") or 0
        eve_n = d["eveningCount"]
        out.append(
            {
                **d,
                "weekendLateCount": weekend,
                "weekendLatePer10k": round(weekend / pop * 10000, 2),
                "eveningOnlyCount": eve_only,
                "lateOnlyCount": late_only,
                "bothLateEveningCount": both,
                "livingPopRatio": round(live / pop, 2) if pop else 0,
                "eveningShare": round(eve_n / total_evening, 4) if total_evening else 0,
            }
        )

    ranked_eve = sorted(out, key=lambda x: -x["eveningCount"])
    top3 = ranked_eve[:3]
    top3_share = (
        sum(d["eveningCount"] for d in top3) / total_evening if total_evening else 0.0
    )
    hi_live = max(out, key=lambda x: x["livingPopRatio"])
    low_wk = min(out, key=lambda x: x["weekendLatePer10k"])
    extra = {
        "weekendLateCount": total_weekend,
        "eveningTop3Share": round(top3_share, 4),
        "eveningTop3": [
            {
                "sgg": d["sgg"],
                "eveningCount": d["eveningCount"],
                "share": d["eveningShare"],
            }
            for d in top3
        ],
        "highestLivingRatio": {
            "sgg": hi_live["sgg"],
            "ratio": hi_live["livingPopRatio"],
            "eveningLivingPop": hi_live["eveningLivingPop"],
            "population": hi_live["population"],
            "eveningCount": hi_live["eveningCount"],
        },
        "lowestWeekendLate": {
            "sgg": low_wk["sgg"],
            "weekendLatePer10k": low_wk["weekendLatePer10k"],
            "weekendLateCount": low_wk["weekendLateCount"],
        },
    }
    return out, extra


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def fetch_all(key: str) -> list[dict]:
    rows: list[dict] = []
    start = 1
    total = None
    while True:
        end = start + PAGE - 1
        url = f"http://openapi.seoul.go.kr:8088/{key}/json/TbPharmacyOperateInfo/{start}/{end}/"
        print(f"API {start}-{end}")
        with urllib.request.urlopen(url, timeout=90) as res:
            payload = json.loads(res.read().decode("utf-8"))
        block = payload.get("TbPharmacyOperateInfo") or {}
        if total is None:
            total = int(block.get("list_total_count") or 0)
            print(f"  total={total}")
        batch = block.get("row") or []
        if not batch:
            break
        rows.extend(batch)
        if end >= total:
            break
        start = end + 1
    print(f"수집 {len(rows)}건")
    return rows


def load_seoul_boundary() -> "shapely.geometry.base.BaseGeometry":
    """자치구 경계 합집합(약간 버퍼) — 파주 등 서울 밖으로 잘못 지오코딩된 좌표를 걸러낸다."""
    geo = json.loads(DISTRICTS_PATH.read_text(encoding="utf-8"))
    polys = [shape(f["geometry"]) for f in geo["features"]]
    return unary_union(polys).buffer(0.01)  # ~1km 여유


def build_pharmacies(rows: list[dict]) -> list[dict]:
    boundary = load_seoul_boundary()
    out = []
    skipped_outside = 0
    for r in rows:
        try:
            lon = float(r["WGS84LON"])
            lat = float(r["WGS84LAT"])
        except (TypeError, ValueError, KeyError):
            continue
        if not (126.7 < lon < 127.3 and 37.4 < lat < 37.8):
            continue
        addr = r.get("DUTYADDR") or ""
        sgg = normalize_sgg(addr)
        if sgg is None:
            continue
        # 주소는 서울이라도 좌표가 실제로는 서울 밖(예: 파주)인 잘못된 지오코딩 데이터 제외
        if not boundary.contains(Point(lon, lat)):
            skipped_outside += 1
            continue

        weekday_closes = [parse_hhmm(r.get(f"DUTYTIME{i}C")) for i in range(1, 6)]
        all_closes = [parse_hhmm(r.get(f"DUTYTIME{i}C")) for i in range(1, 9)]
        weekday_valid = [c for c in weekday_closes if c is not None]
        all_valid = [c for c in all_closes if c is not None]
        max_weekday = max(weekday_valid) if weekday_valid else None
        max_any = max(all_valid) if all_valid else None
        is_evening = bool(max_weekday and max_weekday >= EVENING_CLOSE)
        is_late = bool(max_any and max_any >= LATE_CLOSE)

        hours = {
            "mon": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME1S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME1C")))],
            "tue": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME2S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME2C")))],
            "wed": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME3S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME3C")))],
            "thu": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME4S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME4C")))],
            "fri": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME5S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME5C")))],
            "sat": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME6S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME6C")))],
            "sun": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME7S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME7C")))],
            "holiday": [fmt_hhmm(parse_hhmm(r.get("DUTYTIME8S"))), fmt_hhmm(parse_hhmm(r.get("DUTYTIME8C")))],
        }

        out.append(
            {
                "id": r.get("HPID") or f"{lon},{lat}",
                "name": r.get("DUTYNAME") or "약국",
                "address": addr,
                "tel": r.get("DUTYTEL1") or None,
                "lon": lon,
                "lat": lat,
                "sgg": sgg,
                "isEvening": is_evening,
                "isLateNight": is_late,
                "maxWeekdayClose": max_weekday,
                "maxClose": max_any,
                "hours": hours,
            }
        )
    print(
        f"유효 약국 {len(out)} / 저녁(≥21시) {sum(1 for p in out if p['isEvening'])} "
        f"/ 심야(≥22시) {sum(1 for p in out if p['isLateNight'])} "
        f"/ 서울 밖 좌표 제외 {skipped_outside}"
    )
    return out


def representative_dong_point(geom) -> tuple[float, float]:
    """행정동 폴리곤 안에서 실제 건물이 있는 곳(주거지)의 대표 좌표를 고른다.

    산/공원처럼 건물이 없는 곳으로 centroid가 치우치는 문제(예: 삼청동·평창동)를 피하려고,
    OSM 건물 폴리곤을 동 경계로 잘라 그 무게중심을 쓴다. 건물이 안 잡히면(=먼 산간부 등)
    representative_point()로 최소한 폴리곤 내부의 점을 보장한다.
    """
    import osmnx as ox

    try:
        buildings = ox.features_from_polygon(geom, tags={"building": True})
    except Exception as exc:  # Overpass 타임아웃/빈 결과 등
        print(f"  건물 조회 실패({exc}) → representative_point 사용")
        return geom.representative_point().x, geom.representative_point().y

    if buildings is None or buildings.empty:
        rp = geom.representative_point()
        return rp.x, rp.y

    clipped = buildings.geometry.intersection(geom)
    clipped = clipped[~clipped.is_empty]
    if clipped.empty:
        rp = geom.representative_point()
        return rp.x, rp.y

    hub = unary_union(clipped.values).centroid
    if not geom.contains(hub):
        hub = geom.representative_point()
    return hub.x, hub.y


def load_seoul_dong_centroids() -> list[dict]:
    """행정동 대표 좌표. 전국 geojson에서 서울만 추출해, 건물 밀집 위치 기준으로 캐시."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "seoul_dong_points.json"
    if cache_path.exists():
        data = json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"행정동 대표 좌표 캐시 {len(data)}개")
        return data

    print("행정동 GeoJSON 다운로드...")
    with urllib.request.urlopen(DONG_GEO_URL, timeout=120) as res:
        geo = json.loads(res.read().decode("utf-8"))

    dongs = []
    for feat in geo["features"]:
        p = feat["properties"]
        if p.get("sidonm") != "서울특별시" and not str(p.get("sido", "")).startswith("11"):
            continue
        geom = shape(feat["geometry"])
        code8 = str(p.get("adm_cd2", ""))[:8]  # matches SPOP ADSTRD_CODE_SE
        if len(code8) < 8:
            continue
        name = p.get("adm_nm") or p.get("temp") or code8
        print(f"  건물 기반 대표 좌표 계산: {name}")
        lon, lat = representative_dong_point(geom)
        dongs.append(
            {
                "code": code8,
                "name": name,
                "sgg": p.get("sggnm"),
                "lon": lon,
                "lat": lat,
            }
        )
    cache_path.write_text(json.dumps(dongs, ensure_ascii=False), encoding="utf-8")
    print(f"행정동 대표 좌표 {len(dongs)}개 저장")
    return dongs


def fetch_evening_living_pop(key: str) -> dict[str, float]:
    """행정동코드 → 저녁 21시 생활인구."""
    rows: list[dict] = []
    start = 1
    total = None
    while True:
        end = start + PAGE - 1
        url = (
            f"http://openapi.seoul.go.kr:8088/{key}/json/"
            f"SPOP_LOCAL_RESD_DONG/{start}/{end}/{SPOP_DATE}/{SPOP_HOUR}/"
        )
        print(f"생활인구 API {start}-{end} ({SPOP_DATE} {SPOP_HOUR}시)")
        with urllib.request.urlopen(url, timeout=90) as res:
            payload = json.loads(res.read().decode("utf-8"))
        block = payload.get("SPOP_LOCAL_RESD_DONG") or {}
        if total is None:
            total = int(block.get("list_total_count") or 0)
            print(f"  total={total}")
        batch = block.get("row") or []
        if not batch:
            break
        rows.extend(batch)
        if end >= total:
            break
        start = end + 1

    pop: dict[str, float] = {}
    for r in rows:
        code = str(r.get("ADSTRD_CODE_SE") or "").strip()
        try:
            v = float(r.get("TOT_LVPOP_CO") or 0)
        except (TypeError, ValueError):
            v = 0.0
        if code:
            pop[code] = v
    print(f"생활인구 동 {len(pop)}개")
    return pop


def score_by_living_pop(
    evening: list[dict],
    dongs: list[dict],
    living_pop: dict[str, float],
    all_by_sgg: dict[str, list],
):
    """인구 가중 공백: 사람이 있는 동만 기준으로 저녁약국 접근을 평가."""
    print("행정동 생활인구 가중 + 저녁 약국 최근접 거리...")
    if not evening:
        raise SystemExit("evening pharmacies empty")

    # sgg -> accumulators
    stats: dict[str, dict] = defaultdict(
        lambda: {
            "pop": 0.0,
            "uncovered_pop": 0.0,
            "dist_wsum": 0.0,
            "dong_count": 0,
        }
    )
    samples_out = []
    matched = 0

    for d in dongs:
        code = d["code"]
        sgg = d["sgg"]
        if sgg not in POPULATION:
            continue
        pop = living_pop.get(code)
        if pop is None or pop <= 0:
            continue
        matched += 1
        nearest = min(haversine_m(d["lon"], d["lat"], p["lon"], p["lat"]) for p in evening)
        uncovered = nearest > WALK_M
        st = stats[sgg]
        st["pop"] += pop
        st["uncovered_pop"] += pop if uncovered else 0.0
        st["dist_wsum"] += nearest * pop
        st["dong_count"] += 1
        samples_out.append(
            {
                "lon": round(d["lon"], 5),
                "lat": round(d["lat"], 5),
                "sgg": sgg,
                "name": d["name"],
                "pop": round(pop),
                "nearestM": round(nearest),
                "uncovered": uncovered,
            }
        )

    print(f"생활인구 매칭 동 {matched}개")

    district_stats = []
    for sgg, registry_pop in POPULATION.items():
        st = stats.get(sgg)
        pharms = all_by_sgg.get(sgg, [])
        evening_n = sum(1 for p in pharms if p["isEvening"])
        late_n = sum(1 for p in pharms if p["isLateNight"])
        total_n = len(pharms)
        evening_per_10k = evening_n / registry_pop * 10000 if registry_pop else 0

        if not st or st["pop"] <= 0:
            uncovered_share = 0.0
            mean_nearest = 0.0
            live_pop = 0.0
            est_uncovered = 0
            dong_count = 0
        else:
            live_pop = st["pop"]
            uncovered_share = st["uncovered_pop"] / live_pop
            mean_nearest = st["dist_wsum"] / live_pop
            est_uncovered = int(round(st["uncovered_pop"]))
            dong_count = st["dong_count"]

        dist_norm = min(mean_nearest / 1500.0, 1.0)
        gap_score = round(100 * (0.75 * uncovered_share + 0.25 * dist_norm), 1)
        district_stats.append(
            {
                "sgg": sgg,
                "population": registry_pop,
                "eveningLivingPop": int(round(live_pop)),
                "pharmacyCount": total_n,
                "eveningCount": evening_n,
                "lateNightCount": late_n,
                "eveningPer10k": round(evening_per_10k, 2),
                "meanNearestM": round(mean_nearest),
                "uncoveredShare": round(uncovered_share, 4),
                "estUncoveredPop": est_uncovered,
                "gapScore": gap_score,
                "sampleCount": dong_count,
            }
        )

    district_stats.sort(key=lambda d: -d["gapScore"])
    print(f"공백 동 샘플 {sum(1 for s in samples_out if s['uncovered'])} / 자치구 {len(district_stats)}")
    return district_stats, samples_out


def main():
    key = load_api_key()
    rows = fetch_all(key)
    pharmacies = build_pharmacies(rows)
    if not pharmacies:
        raise SystemExit("No pharmacies")

    evening = [p for p in pharmacies if p["isEvening"]]
    by_sgg: dict[str, list] = defaultdict(list)
    for p in pharmacies:
        by_sgg[p["sgg"]].append(p)

    dongs = load_seoul_dong_centroids()
    living_pop = fetch_evening_living_pop(key)
    district_stats, samples = score_by_living_pop(evening, dongs, living_pop, by_sgg)
    district_stats, extra = enrich_district_metrics(district_stats, pharmacies)

    summary = {
        "pharmacyCount": len(pharmacies),
        "eveningCount": len(evening),
        "lateNightCount": sum(1 for p in pharmacies if p["isLateNight"]),
        "walkMeters": WALK_M,
        "eveningCloseThreshold": EVENING_CLOSE,
        "lateCloseThreshold": LATE_CLOSE,
        "method": "행정동 건물 밀집부 대표 좌표 + 저녁 21시 생활인구 가중 (빈 산/비거주 격자 제외)",
        "spopDate": SPOP_DATE,
        "spopHour": int(SPOP_HOUR),
        "worst": {
            "sgg": district_stats[0]["sgg"],
            "gapScore": district_stats[0]["gapScore"],
            "uncoveredShare": district_stats[0]["uncoveredShare"],
            "estUncoveredPop": district_stats[0]["estUncoveredPop"],
        },
        "best": {
            "sgg": district_stats[-1]["sgg"],
            "gapScore": district_stats[-1]["gapScore"],
            "uncoveredShare": district_stats[-1]["uncoveredShare"],
            "estUncoveredPop": district_stats[-1]["estUncoveredPop"],
        },
        "avgUncoveredShare": round(
            sum(d["uncoveredShare"] for d in district_stats) / len(district_stats), 4
        ),
        **extra,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "pharmacies.json").write_text(
        json.dumps(pharmacies, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT_DIR / "district_stats.json").write_text(
        json.dumps(district_stats, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT_DIR / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "coverage_samples.json").write_text(
        json.dumps({"walkMeters": WALK_M, "points": samples}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(
        f"완료: 약국 {summary['pharmacyCount']} / 저녁 {summary['eveningCount']} / "
        f"최공백 {summary['worst']['sgg']}({summary['worst']['gapScore']})"
    )


if __name__ == "__main__":
    main()
