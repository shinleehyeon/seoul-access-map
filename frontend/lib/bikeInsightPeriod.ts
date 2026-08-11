import type {
  BikeAccidentInsights,
  BikeBlackspotRow,
  BikeDistrictRow,
  BikeInsightBucket,
  BikeInsightSlice,
  BikeMonthBundle,
  BikeYearBundle,
} from "@/lib/types";

export type YearMonth = { year: number; month: number };

export type PeriodRange =
  | { kind: "all" }
  | { kind: "range"; start: YearMonth; end: YearMonth };

const HEAVY = new Set(["화물", "승합", "건설기계"]);
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function ymKey(ym: YearMonth): number {
  return ym.year * 12 + ym.month;
}

export function normalizeRange(a: YearMonth, b: YearMonth): { start: YearMonth; end: YearMonth } {
  return ymKey(a) <= ymKey(b) ? { start: a, end: b } : { start: b, end: a };
}

export function formatPeriodLabel(period: PeriodRange, yearList: string[]): string {
  if (period.kind === "all") {
    return yearList.length ? `${yearList[0]}–${yearList[yearList.length - 1]}` : "전체 기간";
  }
  const { start, end } = period;
  const same = start.year === end.year && start.month === end.month;
  if (same) return `${start.year}년 ${start.month}월`;
  const fullYears =
    start.month === 1 &&
    end.month === 12 &&
    start.year <= end.year;
  if (fullYears && start.year === end.year) return `${start.year}년`;
  if (fullYears) return `${start.year}–${end.year}`;
  return `${start.year}.${start.month} ~ ${end.year}.${end.month}`;
}

export function parseStoredPeriod(raw: string | null, yearList: string[]): PeriodRange {
  if (!raw) return { kind: "all" };
  try {
    const parsed = JSON.parse(raw) as PeriodRange;
    if (parsed?.kind === "all") return { kind: "all" };
    if (
      parsed?.kind === "range" &&
      Number.isFinite(parsed.start?.year) &&
      Number.isFinite(parsed.start?.month) &&
      Number.isFinite(parsed.end?.year) &&
      Number.isFinite(parsed.end?.month)
    ) {
      const years = new Set(yearList.map(Number));
      if (!years.has(parsed.start.year) || !years.has(parsed.end.year)) {
        return { kind: "all" };
      }
      return {
        kind: "range",
        ...normalizeRange(parsed.start, parsed.end),
      };
    }
  } catch {
    /* ignore legacy */
  }
  return { kind: "all" };
}

function citySlice(insights: BikeAccidentInsights): BikeInsightSlice {
  return {
    total: insights.meta.total,
    deaths: insights.meta.deaths,
    headline: insights.headline,
    roadTypes: insights.roadTypes,
    opponents: insights.opponents,
    ages: insights.ages,
    violations: insights.violations,
    hours: insights.hours,
    dayHour: insights.dayHour,
    seasons: insights.seasons,
    months: insights.months,
    bikeRoadCompare: insights.bikeRoadCompare,
  };
}

function listMonthsInRange(start: YearMonth, end: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  let y = start.year;
  let m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function pickMonthBundle(
  insights: BikeAccidentInsights,
  ym: YearMonth,
  sgg: string
): BikeInsightSlice | null {
  const year = insights.byYear?.[String(ym.year)] as BikeYearBundle | undefined;
  const month = year?.byMonth?.[String(ym.month)] as BikeMonthBundle | undefined;
  if (!month) return null;
  if (sgg === "all") return month;
  return month.bySgg?.[sgg] ?? null;
}

function mergeBuckets(lists: BikeInsightBucket[][]): BikeInsightBucket[] {
  const map = new Map<string, { n: number; deaths: number; severe: number }>();
  for (const list of lists) {
    for (const b of list) {
      const prev = map.get(b.key) ?? { n: 0, deaths: 0, severe: 0 };
      prev.n += b.n;
      prev.deaths += b.deaths;
      prev.severe += (b.seriousRate / 100) * b.n;
      map.set(b.key, prev);
    }
  }
  const total = [...map.values()].reduce((s, v) => s + v.n, 0);
  return [...map.entries()].map(([key, v]) => ({
    key,
    n: v.n,
    share: total ? Math.round((v.n / total) * 1000) / 10 : 0,
    deaths: v.deaths,
    fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
    seriousRate: v.n ? Math.round((v.severe / v.n) * 1000) / 10 : 0,
  }));
}

function mergeHours(
  lists: BikeInsightSlice["hours"][]
): BikeInsightSlice["hours"] {
  const byHour = new Map<number, { n: number; deaths: number; severe: number; label: string }>();
  for (const list of lists) {
    for (const h of list) {
      const prev = byHour.get(h.hour) ?? {
        n: 0,
        deaths: 0,
        severe: 0,
        label: h.label,
      };
      prev.n += h.n;
      prev.deaths += h.deaths;
      prev.severe += (h.seriousRate / 100) * h.n;
      byHour.set(h.hour, prev);
    }
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const v = byHour.get(hour) ?? { n: 0, deaths: 0, severe: 0, label: `${hour}시` };
    return {
      hour,
      label: v.label,
      n: v.n,
      deaths: v.deaths,
      fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
      seriousRate: v.n ? Math.round((v.severe / v.n) * 1000) / 10 : 0,
    };
  });
}

function mergeDayHour(
  lists: BikeInsightSlice["dayHour"][]
): BikeInsightSlice["dayHour"] {
  const key = (d: string, h: number) => `${d}:${h}`;
  const byCell = new Map<string, { n: number; deaths: number; severe: number }>();
  for (const list of lists) {
    for (const c of list) {
      const k = key(c.day, c.hour);
      const prev = byCell.get(k) ?? { n: 0, deaths: 0, severe: 0 };
      prev.n += c.n;
      prev.deaths += c.deaths;
      prev.severe += (c.seriousRate / 100) * c.n;
      byCell.set(k, prev);
    }
  }
  const out: BikeInsightSlice["dayHour"] = [];
  for (const day of DAYS) {
    for (let hour = 0; hour < 24; hour++) {
      const v = byCell.get(key(day, hour)) ?? { n: 0, deaths: 0, severe: 0 };
      out.push({
        day,
        hour,
        n: v.n,
        deaths: v.deaths,
        fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
        seriousRate: v.n ? Math.round((v.severe / v.n) * 1000) / 10 : 0,
      });
    }
  }
  return out;
}

function mergeMonths(lists: BikeInsightSlice["months"][]): BikeInsightSlice["months"] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const list of lists) {
    for (const row of list) {
      if (row.month >= 1 && row.month <= 12) counts[row.month - 1] += row.n;
    }
  }
  return counts.map((n, i) => ({ month: i + 1, n }));
}

function mergeSlices(slices: BikeInsightSlice[]): BikeInsightSlice | null {
  if (!slices.length) return null;
  if (slices.length === 1) return slices[0];

  const total = slices.reduce((s, x) => s + x.total, 0);
  const deaths = slices.reduce((s, x) => s + x.deaths, 0);
  const roadTypes = mergeBuckets(slices.map((s) => s.roadTypes));
  const opponents = mergeBuckets(slices.map((s) => s.opponents));
  const ages = mergeBuckets(slices.map((s) => s.ages));
  const violations = mergeBuckets(slices.map((s) => s.violations));
  const seasons = mergeBuckets(slices.map((s) => s.seasons));
  const bikeRoadCompare = mergeBuckets(slices.map((s) => s.bikeRoadCompare));
  const hours = mergeHours(slices.map((s) => s.hours));
  const dayHour = mergeDayHour(slices.map((s) => s.dayHour));
  const months = mergeMonths(slices.map((s) => s.months));

  const heavy = opponents.filter((o) => HEAVY.has(o.key));
  const heavyN = heavy.reduce((s, o) => s + o.n, 0);
  const heavyD = heavy.reduce((s, o) => s + o.deaths, 0);
  const elderly = ages.find((a) => a.key === "65세 이상");
  const dawn = hours.filter((h) => h.hour >= 5 && h.hour <= 7);
  const dawnN = dawn.reduce((s, h) => s + h.n, 0);
  const dawnD = dawn.reduce((s, h) => s + h.deaths, 0);
  const ped = opponents.find((o) => o.key === "보행자");
  const bikeBike = opponents.find((o) => o.key === "자전거");

  let pedCount = 0;
  let sidewalkPed = 0;
  for (const s of slices) {
    pedCount += s.headline.pedestrianCount;
    sidewalkPed += (s.headline.sidewalkRidingShareOfPed / 100) * s.headline.pedestrianCount;
  }

  return {
    total,
    deaths,
    headline: {
      heavyVehicleAccidentShare: total ? Math.round((heavyN / total) * 1000) / 10 : 0,
      heavyVehicleDeathShare: deaths ? Math.round((heavyD / deaths) * 1000) / 10 : 0,
      elderlyAccidentShare: total && elderly ? Math.round((elderly.n / total) * 1000) / 10 : 0,
      elderlyDeathShare: deaths && elderly ? Math.round((elderly.deaths / deaths) * 1000) / 10 : 0,
      dawnAccidents: dawnN,
      dawnDeaths: dawnD,
      dawnFatalityPer1000: dawnN ? Math.round((dawnD / dawnN) * 1000 * 100) / 100 : 0,
      bikeBikeSeriousRate: bikeBike?.seriousRate ?? 0,
      pedestrianCount: pedCount || ped?.n || 0,
      pedestrianSeriousRate: ped?.seriousRate ?? 0,
      sidewalkRidingShareOfPed: pedCount ? Math.round((sidewalkPed / pedCount) * 1000) / 10 : 0,
    },
    roadTypes,
    opponents,
    ages,
    violations,
    hours,
    dayHour,
    seasons,
    months,
    bikeRoadCompare,
  };
}

function mergeDistricts(lists: BikeDistrictRow[][]): BikeDistrictRow[] {
  const map = new Map<
    string,
    {
      n: number;
      deaths: number;
      severe: number;
      ped: number;
      bike: number;
      truck: number;
      cross: number;
      old: number;
    }
  >();
  for (const list of lists) {
    for (const d of list) {
      const prev = map.get(d.sgg) ?? {
        n: 0,
        deaths: 0,
        severe: 0,
        ped: 0,
        bike: 0,
        truck: 0,
        cross: 0,
        old: 0,
      };
      prev.n += d.n;
      prev.deaths += d.deaths;
      prev.severe += (d.seriousRate / 100) * d.n;
      prev.ped += (d.pedShare / 100) * d.n;
      prev.bike += (d.bikeShare / 100) * d.n;
      prev.truck += (d.truckShare / 100) * d.n;
      prev.cross += (d.crossShare / 100) * d.n;
      prev.old += (d.elderlyShare / 100) * d.n;
      map.set(d.sgg, prev);
    }
  }
  return [...map.entries()]
    .map(([sgg, v]) => ({
      sgg,
      n: Math.round(v.n),
      deaths: v.deaths,
      fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
      seriousRate: v.n ? Math.round((v.severe / v.n) * 1000) / 10 : 0,
      pedShare: v.n ? Math.round((v.ped / v.n) * 1000) / 10 : 0,
      bikeShare: v.n ? Math.round((v.bike / v.n) * 1000) / 10 : 0,
      truckShare: v.n ? Math.round((v.truck / v.n) * 1000) / 10 : 0,
      crossShare: v.n ? Math.round((v.cross / v.n) * 1000) / 10 : 0,
      elderlyShare: v.n ? Math.round((v.old / v.n) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.n - a.n);
}

function isFullDatasetRange(period: PeriodRange, yearList: string[]): boolean {
  if (period.kind === "all") return true;
  if (!yearList.length) return false;
  const first = Number(yearList[0]);
  const last = Number(yearList[yearList.length - 1]);
  return (
    period.start.year === first &&
    period.start.month === 1 &&
    period.end.year === last &&
    period.end.month === 12
  );
}

export function resolvePeriodSlice(
  insights: BikeAccidentInsights,
  period: PeriodRange,
  sgg: string
): BikeInsightSlice {
  if (period.kind === "all" || isFullDatasetRange(period, insights.meta.yearList ?? [])) {
    if (sgg === "all") return citySlice(insights);
    return insights.bySgg[sgg] ?? citySlice(insights);
  }

  const { start, end } = period;
  const singleMonth =
    start.year === end.year && start.month === end.month;
  const singleFullYear =
    start.year === end.year && start.month === 1 && end.month === 12;

  if (singleFullYear) {
    const yearly = insights.byYear?.[String(start.year)];
    if (yearly) {
      if (sgg === "all") return yearly;
      return yearly.bySgg?.[sgg] ?? yearly;
    }
  }

  if (singleMonth) {
    const one = pickMonthBundle(insights, start, sgg);
    if (one) return one;
  }

  const months = listMonthsInRange(start, end);
  const slices = months
    .map((ym) => pickMonthBundle(insights, ym, sgg))
    .filter((s): s is BikeInsightSlice => Boolean(s));

  return mergeSlices(slices) ?? citySlice(insights);
}

export function resolvePeriodDistricts(
  insights: BikeAccidentInsights,
  period: PeriodRange
): BikeDistrictRow[] {
  if (period.kind === "all" || isFullDatasetRange(period, insights.meta.yearList ?? [])) {
    return insights.districts;
  }
  const { start, end } = period;
  if (start.year === end.year && start.month === 1 && end.month === 12) {
    return insights.byYear?.[String(start.year)]?.districts ?? insights.districts;
  }
  // 연 단위 전체(1~12월) 여러 해 → 연별 districts 합산
  if (start.month === 1 && end.month === 12 && start.year < end.year) {
    const lists: BikeDistrictRow[][] = [];
    for (let y = start.year; y <= end.year; y++) {
      const d = insights.byYear?.[String(y)]?.districts;
      if (d?.length) lists.push(d);
    }
    return lists.length ? mergeDistricts(lists) : insights.districts;
  }
  if (start.year === end.year && start.month === end.month) {
    return (
      insights.byYear?.[String(start.year)]?.byMonth?.[String(start.month)]?.districts ??
      insights.districts
    );
  }
  const lists = listMonthsInRange(start, end)
    .map(
      (ym) =>
        insights.byYear?.[String(ym.year)]?.byMonth?.[String(ym.month)]?.districts
    )
    .filter((d): d is BikeDistrictRow[] => Boolean(d));
  return lists.length ? mergeDistricts(lists) : insights.districts;
}

function mergeBlackspots(lists: BikeBlackspotRow[][], topN = 30): BikeBlackspotRow[] {
  const map = new Map<
    string,
    { sgg: string; road: string; n: number; deaths: number; severe: number }
  >();
  for (const list of lists) {
    for (const b of list) {
      const key = `${b.sgg}|${b.road}`;
      const prev = map.get(key) ?? { sgg: b.sgg, road: b.road, n: 0, deaths: 0, severe: 0 };
      prev.n += b.n;
      prev.deaths += b.deaths;
      prev.severe += (b.seriousRate / 100) * b.n;
      map.set(key, prev);
    }
  }
  return [...map.values()]
    .map((v) => ({
      sgg: v.sgg,
      road: v.road,
      n: v.n,
      deaths: v.deaths,
      fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
      seriousRate: v.n ? Math.round((v.severe / v.n) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.n - a.n || b.fatalityPer1000 - a.fatalityPer1000)
    .slice(0, topN);
}

function pickBlackspots(
  bundle: { blackspots?: BikeBlackspotRow[]; bySgg?: Record<string, BikeInsightSlice> } | null | undefined,
  sgg: string
): BikeBlackspotRow[] {
  if (!bundle) return [];
  if (sgg === "all") return bundle.blackspots ?? [];
  return bundle.bySgg?.[sgg]?.blackspots ?? (bundle.blackspots ?? []).filter((b) => b.sgg === sgg);
}

/** 기간·자치구 필터에 맞는 블랙스팟 */
export function resolvePeriodBlackspots(
  insights: BikeAccidentInsights,
  period: PeriodRange,
  sgg: string
): BikeBlackspotRow[] {
  if (period.kind === "all" || isFullDatasetRange(period, insights.meta.yearList ?? [])) {
    if (sgg === "all") return insights.blackspots;
    return insights.bySgg?.[sgg]?.blackspots ?? insights.blackspots.filter((b) => b.sgg === sgg);
  }

  const { start, end } = period;
  const singleFullYear =
    start.year === end.year && start.month === 1 && end.month === 12;
  const singleMonth = start.year === end.year && start.month === end.month;

  if (singleFullYear) {
    const yearly = insights.byYear?.[String(start.year)];
    const list = pickBlackspots(yearly, sgg);
    return list.length ? list.slice(0, 30) : [];
  }

  if (singleMonth) {
    const month = insights.byYear?.[String(start.year)]?.byMonth?.[String(start.month)];
    return pickBlackspots(month, sgg).slice(0, 30);
  }

  // 여러 달·여러 해 → 월 단위 블랙스팟 합산
  const lists = listMonthsInRange(start, end)
    .map((ym) =>
      pickBlackspots(insights.byYear?.[String(ym.year)]?.byMonth?.[String(ym.month)], sgg)
    )
    .filter((list) => list.length > 0);

  if (lists.length) return mergeBlackspots(lists, 30);

  // 월 번들이 없으면 연 단위로 합산
  if (start.month === 1 && end.month === 12 && start.year < end.year) {
    const yearLists: BikeBlackspotRow[][] = [];
    for (let y = start.year; y <= end.year; y++) {
      const list = pickBlackspots(insights.byYear?.[String(y)], sgg);
      if (list.length) yearLists.push(list);
    }
    if (yearLists.length) return mergeBlackspots(yearLists, 30);
  }

  return sgg === "all"
    ? insights.blackspots
    : insights.blackspots.filter((b) => b.sgg === sgg);
}

export function isFullPeriod(period: PeriodRange, yearList: string[]): boolean {
  return period.kind === "all" || isFullDatasetRange(period, yearList);
}
