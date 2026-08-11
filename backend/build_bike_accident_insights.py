"""TAAS 서울 자전거 가해 사고 → 대시보드용 인사이트 JSON.

입력:
  data/raw_bike_accident/서울_자전거사고_TAAS.csv
  frontend/public/data/accident_points.json  (onBikeRoad 조인용)

출력:
  frontend/public/data/bike_accident_insights.json
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "raw_bike_accident" / "서울_자전거사고_TAAS.csv"
ACCIDENT_POINTS = ROOT / "frontend" / "public" / "data" / "accident_points.json"
OUT_PATH = ROOT / "frontend" / "public" / "data" / "bike_accident_insights.json"

HEAVY = ("화물", "승합", "건설기계")
SEASONS = ["봄", "여름", "가을", "겨울"]


def gi(row: dict, key: str) -> int:
    try:
        return int(row.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def road_group(road: str) -> str:
    s = (road or "").strip()
    if s.startswith("교차로"):
        return "교차로"
    if s.startswith("단일로"):
        return "단일로"
    return "기타"


def gu_of(row: dict) -> str:
    parts = (row.get("법정동명") or "").split()
    return parts[1] if len(parts) >= 2 else "?"


def month_num(value: str) -> int:
    m = re.search(r"(\d+)월", value or "")
    return int(m.group(1)) if m else 0


def season_of(month: int) -> str:
    if month in (12, 1, 2):
        return "겨울"
    if month in (3, 4, 5):
        return "봄"
    if month in (6, 7, 8):
        return "여름"
    return "가을"


def is_dawn(label: str) -> bool:
    raw = (label or "").replace("시", "")
    return raw.lstrip("0") in ("5", "6", "7") or label in ("05시", "06시", "07시")


def rate_rows(rows: list[dict], key_fn, min_n: int = 1) -> list[dict]:
    stats: dict[str, dict] = defaultdict(lambda: {"n": 0, "deaths": 0, "severe": 0})
    for r in rows:
        k = key_fn(r)
        s = stats[k]
        s["n"] += 1
        s["deaths"] += gi(r, "사망자수")
        if r.get("사고내용") in ("사망사고", "중상사고"):
            s["severe"] += 1
    total = len(rows) or 1
    out = []
    for k, s in stats.items():
        if s["n"] < min_n:
            continue
        out.append(
            {
                "key": k,
                "n": s["n"],
                "share": round(s["n"] / total * 100, 1),
                "deaths": s["deaths"],
                "fatalityPer1000": round(s["deaths"] / s["n"] * 1000, 2),
                "seriousRate": round(s["severe"] / s["n"] * 100, 1),
            }
        )
    return out


def build_slice(
    rows: list[dict],
    on_bike: dict[str, int],
    *,
    opponent_min: int,
    age_min: int,
    violation_min: int,
) -> dict:
    n = len(rows)
    total_deaths = sum(gi(r, "사망자수") for r in rows)

    road = sorted(
        rate_rows(rows, lambda r: road_group(r.get("도로형태", "")), 1),
        key=lambda x: -x["n"],
    )
    opponents = sorted(
        rate_rows(rows, lambda r: r.get("상대차종") or "(없음)", opponent_min),
        key=lambda x: -x["fatalityPer1000"],
    )
    ages = sorted(
        rate_rows(rows, lambda r: r.get("당사자1_연령대") or "기타불명", age_min),
        key=lambda x: -x["n"],
    )
    violations = sorted(
        rate_rows(rows, lambda r: r.get("법규위반") or "기타", violation_min),
        key=lambda x: -x["fatalityPer1000"],
    )

    hour_groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        hour_groups[r.get("발생시각") or "?"].append(r)
    hours = []
    for label, sub in sorted(
        hour_groups.items(),
        key=lambda x: int(re.sub(r"\D", "", x[0] or "99") or 99),
    ):
        count = len(sub)
        deaths = sum(gi(r, "사망자수") for r in sub)
        severe = sum(1 for r in sub if r.get("사고내용") in ("사망사고", "중상사고"))
        hours.append(
            {
                "hour": int(re.sub(r"\D", "", label or "0") or 0),
                "label": label,
                "n": count,
                "deaths": deaths,
                "fatalityPer1000": round(deaths / count * 1000, 2) if count else 0,
                "seriousRate": round(severe / count * 100, 1) if count else 0,
            }
        )

    # Fill missing hours 0-23 so line charts stay continuous at district level
    by_hour = {h["hour"]: h for h in hours}
    hours_full = []
    for h in range(24):
        if h in by_hour:
            hours_full.append(by_hour[h])
        else:
            hours_full.append(
                {
                    "hour": h,
                    "label": f"{h:02d}시" if h < 10 else f"{h}시",
                    "n": 0,
                    "deaths": 0,
                    "fatalityPer1000": 0,
                    "seriousRate": 0,
                }
            )

    season_stats = {s: {"n": 0, "deaths": 0, "severe": 0} for s in SEASONS}
    months = {m: 0 for m in range(1, 13)}
    for r in rows:
        mn = month_num(r.get("사고월", ""))
        if 1 <= mn <= 12:
            months[mn] += 1
        s = season_of(mn)
        season_stats[s]["n"] += 1
        season_stats[s]["deaths"] += gi(r, "사망자수")
        if r.get("사고내용") in ("사망사고", "중상사고"):
            season_stats[s]["severe"] += 1
    seasons = []
    for s in SEASONS:
        st = season_stats[s]
        seasons.append(
            {
                "key": s,
                "n": st["n"],
                "share": round(st["n"] / n * 100, 1) if n else 0,
                "deaths": st["deaths"],
                "fatalityPer1000": round(st["deaths"] / st["n"] * 1000, 2) if st["n"] else 0,
                "seriousRate": round(st["severe"] / st["n"] * 100, 1) if st["n"] else 0,
            }
        )
    month_series = [{"month": m, "n": months[m]} for m in range(1, 13)]

    bike_road = {"on": {"n": 0, "deaths": 0, "severe": 0}, "off": {"n": 0, "deaths": 0, "severe": 0}}
    for r in rows:
        flag = on_bike.get(str(r.get("사고번호")), 0)
        bucket = "on" if flag == 1 else "off"
        bike_road[bucket]["n"] += 1
        bike_road[bucket]["deaths"] += gi(r, "사망자수")
        if r.get("사고내용") in ("사망사고", "중상사고"):
            bike_road[bucket]["severe"] += 1
    bike_road_compare = []
    for key, label in [("on", "전용도로 위"), ("off", "전용도로 밖")]:
        st = bike_road[key]
        bike_road_compare.append(
            {
                "key": label,
                "n": st["n"],
                "share": round(st["n"] / n * 100, 1) if n else 0,
                "deaths": st["deaths"],
                "fatalityPer1000": round(st["deaths"] / st["n"] * 1000, 2) if st["n"] else 0,
                "seriousRate": round(st["severe"] / st["n"] * 100, 1) if st["n"] else 0,
            }
        )

    heavy_n = heavy_d = elderly_n = elderly_d = 0
    for r in rows:
        if r.get("상대차종") in HEAVY:
            heavy_n += 1
            heavy_d += gi(r, "사망자수")
        if r.get("당사자1_연령대") == "65세 이상":
            elderly_n += 1
            elderly_d += gi(r, "사망자수")

    dawn = [r for r in rows if is_dawn(r.get("발생시각") or "")]
    dawn_deaths = sum(gi(r, "사망자수") for r in dawn)
    ped = [r for r in rows if r.get("상대차종") == "보행자"]
    bike_bike = [r for r in rows if r.get("상대차종") == "자전거"]
    mid_ped = Counter(r.get("사고유형_중분류") for r in ped)

    return {
        "total": n,
        "deaths": total_deaths,
        "headline": {
            "heavyVehicleAccidentShare": round(heavy_n / n * 100, 1) if n else 0,
            "heavyVehicleDeathShare": round(heavy_d / total_deaths * 100, 1) if total_deaths else 0,
            "elderlyAccidentShare": round(elderly_n / n * 100, 1) if n else 0,
            "elderlyDeathShare": round(elderly_d / total_deaths * 100, 1) if total_deaths else 0,
            "dawnAccidents": len(dawn),
            "dawnDeaths": dawn_deaths,
            "dawnFatalityPer1000": round(dawn_deaths / len(dawn) * 1000, 2) if dawn else 0,
            "bikeBikeSeriousRate": round(
                sum(1 for r in bike_bike if r.get("사고내용") in ("사망사고", "중상사고"))
                / len(bike_bike)
                * 100,
                1,
            )
            if bike_bike
            else 0,
            "pedestrianCount": len(ped),
            "pedestrianSeriousRate": round(
                sum(1 for r in ped if r.get("사고내용") in ("사망사고", "중상사고")) / len(ped) * 100,
                1,
            )
            if ped
            else 0,
            "sidewalkRidingShareOfPed": round(mid_ped.get("보도통행중", 0) / len(ped) * 100, 1)
            if ped
            else 0,
        },
        "roadTypes": road,
        "opponents": opponents,
        "ages": ages,
        "violations": violations,
        "hours": hours_full,
        "seasons": seasons,
        "months": month_series,
        "bikeRoadCompare": bike_road_compare,
    }


def build_districts(rows: list[dict], *, min_n: int = 80) -> list[dict]:
    gu_stats: dict[str, dict] = defaultdict(
        lambda: {
            "n": 0,
            "deaths": 0,
            "severe": 0,
            "ped": 0,
            "bike": 0,
            "truck": 0,
            "cross": 0,
            "old": 0,
        }
    )
    for r in rows:
        g = gu_of(r)
        s = gu_stats[g]
        s["n"] += 1
        s["deaths"] += gi(r, "사망자수")
        if r.get("사고내용") in ("사망사고", "중상사고"):
            s["severe"] += 1
        if r.get("상대차종") == "보행자":
            s["ped"] += 1
        if r.get("상대차종") == "자전거":
            s["bike"] += 1
        if r.get("상대차종") in HEAVY:
            s["truck"] += 1
        if road_group(r.get("도로형태", "")) == "교차로":
            s["cross"] += 1
        if r.get("당사자1_연령대") == "65세 이상":
            s["old"] += 1

    districts = []
    for g, s in gu_stats.items():
        if s["n"] < min_n or g == "?":
            continue
        districts.append(
            {
                "sgg": g,
                "n": s["n"],
                "deaths": s["deaths"],
                "fatalityPer1000": round(s["deaths"] / s["n"] * 1000, 2),
                "seriousRate": round(s["severe"] / s["n"] * 100, 1),
                "pedShare": round(s["ped"] / s["n"] * 100, 1),
                "bikeShare": round(s["bike"] / s["n"] * 100, 1),
                "truckShare": round(s["truck"] / s["n"] * 100, 1),
                "crossShare": round(s["cross"] / s["n"] * 100, 1),
                "elderlyShare": round(s["old"] / s["n"] * 100, 1),
            }
        )
    districts.sort(key=lambda x: -x["n"])
    return districts


def build_sgg_map(
    rows: list[dict],
    on_bike: dict[str, int],
    *,
    min_rows: int,
    opponent_min: int,
    age_min: int,
    violation_min: int,
) -> dict[str, dict]:
    by_sgg_rows: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        g = gu_of(r)
        if g != "?":
            by_sgg_rows[g].append(r)
    out = {}
    for g, sub in sorted(by_sgg_rows.items()):
        if len(sub) < min_rows:
            continue
        out[g] = build_slice(
            sub,
            on_bike,
            opponent_min=opponent_min,
            age_min=age_min,
            violation_min=violation_min,
        )
    return out


def main() -> None:
    with CSV_PATH.open(encoding="utf-8-sig") as f:
        all_rows = list(csv.DictReader(f))

    # 대시보드 기본: 피해 자전거 (법규위반 = 가해 운전자 위반)
    # 역할 컬럼이 없으면 기존 가해-only CSV로 간주
    has_role = bool(all_rows) and "역할" in all_rows[0]
    if has_role:
        rows = [r for r in all_rows if r.get("역할") == "피해"]
        perpetrator_n = sum(1 for r in all_rows if r.get("역할") == "가해")
        victim_n = len(rows)
    else:
        rows = all_rows
        perpetrator_n = len(all_rows)
        victim_n = 0

    # CSV 주석 컬럼을 우선 사용 (accident_points 조인보다 단순·정확)
    on_bike: dict[str, int] = {}
    for r in rows:
        acdnt = r.get("사고번호")
        if not acdnt:
            continue
        try:
            on_bike[str(acdnt)] = int(r.get("자전거도로인접") or 0)
        except (TypeError, ValueError):
            on_bike[str(acdnt)] = 0

    # 구버전 CSV에 컬럼이 없으면 accident_points로 보완
    if not any(on_bike.values()) and ACCIDENT_POINTS.exists():
        points = json.loads(ACCIDENT_POINTS.read_text(encoding="utf-8"))
        for feat in points.get("features", []):
            props = feat.get("properties") or {}
            if props.get("accidentType") != "자전거":
                continue
            acdnt = props.get("acdntNo")
            if acdnt is None:
                continue
            on_bike[str(acdnt)] = 1 if props.get("onBikeRoad") == 1 else 0

    city = build_slice(rows, on_bike, opponent_min=30, age_min=30, violation_min=50)
    by_sgg = build_sgg_map(
        rows, on_bike, min_rows=30, opponent_min=5, age_min=5, violation_min=5
    )

    years = sorted({str(r.get("사고연도") or "") for r in rows if r.get("사고연도")})
    by_year: dict[str, dict] = {}
    for year in years:
        year_rows = [r for r in rows if str(r.get("사고연도")) == year]
        if len(year_rows) < 50:
            continue
        slice_ = build_slice(year_rows, on_bike, opponent_min=15, age_min=15, violation_min=15)
        by_month: dict[str, dict] = {}
        for m in range(1, 13):
            month_rows = [r for r in year_rows if month_num(r.get("사고월", "")) == m]
            if len(month_rows) < 30:
                continue
            by_month[str(m)] = {
                **build_slice(
                    month_rows, on_bike, opponent_min=5, age_min=5, violation_min=5
                ),
                "bySgg": build_sgg_map(
                    month_rows, on_bike, min_rows=5, opponent_min=2, age_min=2, violation_min=2
                ),
                "districts": build_districts(month_rows, min_n=5),
            }
        by_year[year] = {
            **slice_,
            "bySgg": build_sgg_map(
                year_rows, on_bike, min_rows=10, opponent_min=3, age_min=3, violation_min=3
            ),
            "districts": build_districts(year_rows, min_n=20),
            "byMonth": by_month,
        }

    year_keys = list(by_year.keys())
    period_label = (
        f"{year_keys[0]}-{year_keys[-1]}" if year_keys else "unknown"
    )

    payload = {
        "meta": {
            "source": "TAAS 서울 자전거 피해 사고",
            "period": period_label,
            "role": "피해",
            "total": city["total"],
            "deaths": city["deaths"],
            "perpetratorTotal": perpetrator_n,
            "victimTotal": victim_n or city["total"],
            "sggList": sorted(by_sgg.keys()),
            "yearList": year_keys,
        },
        "headline": city["headline"],
        "roadTypes": city["roadTypes"],
        "opponents": city["opponents"],
        "ages": city["ages"],
        "violations": city["violations"],
        "hours": city["hours"],
        "seasons": city["seasons"],
        "months": city["months"],
        "bikeRoadCompare": city["bikeRoadCompare"],
        "districts": build_districts(rows),
        "bySgg": by_sgg,
        "byYear": by_year,
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(
        f"wrote {OUT_PATH} "
        f"(city={city['total']}, deaths={city['deaths']}, "
        f"sgg={len(by_sgg)}, years={list(by_year.keys())})"
    )


if __name__ == "__main__":
    main()
