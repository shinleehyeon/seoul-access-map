"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Info,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgeRiskChart } from "@/components/insights/OpponentAgeCharts";
import { RoadTypeRiskChart, RoadTypeShareChart } from "@/components/insights/RoadTypeCharts";
import {
  BikeRoadCompareChart,
  HourVolumeFatalityChart,
  MonthVolumeChart,
} from "@/components/insights/TimeSeasonCharts";
import { DayHourHeatmap } from "@/components/insights/DayHourHeatmap";
import { BlackspotRankingTable } from "@/components/insights/BlackspotRankingTable";
import { YearCalendarPicker } from "@/components/insights/YearCalendarPicker";
import {
  formatPeriodLabel,
  isFullPeriod as checkFullPeriod,
  parseStoredPeriod,
  resolvePeriodBlackspots,
  resolvePeriodSlice,
  type PeriodRange,
} from "@/lib/bikeInsightPeriod";
import type { BikeAccidentInsights } from "@/lib/types";

const KPI_ACCENTS = ["#e67e22", "#1abc9c", "#2c3e50", "#f1c40f"] as const;
const KPI_COUNT_MS = 720;

function parseKpiPrimary(primary: string) {
  const m = primary.match(/^([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  const decimals = raw.includes(".") ? (raw.split(".")[1]?.length ?? 0) : 0;
  return {
    value: Number(raw),
    decimals,
    suffix: m[2],
    useLocale: m[1].includes(","),
  };
}

function formatKpiPrimary(
  value: number,
  decimals: number,
  useLocale: boolean,
  suffix: string
) {
  const body = useLocale
    ? Math.round(value).toLocaleString("ko-KR")
    : value.toFixed(decimals);
  return `${body}${suffix}`;
}

function TypedKpiNumber({ primary }: { primary: string }) {
  const [display, setDisplay] = useState(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return primary;
    }
    const parsed = parseKpiPrimary(primary);
    if (!parsed || !Number.isFinite(parsed.value)) return primary;
    return formatKpiPrimary(0, parsed.decimals, parsed.useLocale, parsed.suffix);
  });

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const parsed = parseKpiPrimary(primary);
    if (!parsed || !Number.isFinite(parsed.value)) return;

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / KPI_COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(
        t >= 1
          ? primary
          : formatKpiPrimary(
              parsed.value * eased,
              parsed.decimals,
              parsed.useLocale,
              parsed.suffix
            )
      );
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [primary]);

  return (
    <span className="text-[22px] font-bold leading-none tracking-tight text-[#18181b] tabular-nums">
      {display}
    </span>
  );
}

function ChartCardHeader({
  title,
  info,
  description,
  className = "pb-2",
}: {
  title: string;
  info: string;
  /** 중요 그래프만 — 제목 아래 한 줄 */
  description?: string;
  className?: string;
}) {
  return (
    <CardHeader
      className={`flex flex-row items-start justify-between gap-3 space-y-0 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm leading-snug">{description}</p>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label={`${title} 설명`}
          >
            <Info className="size-4" strokeWidth={2} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3 text-sm leading-relaxed">
          {info}
        </PopoverContent>
      </Popover>
    </CardHeader>
  );
}

type KpiTone = "onTrack" | "atRisk" | "stable" | "review";

const KPI_TONE: Record<KpiTone, LucideIcon> = {
  onTrack: TrendingDown,
  atRisk: TrendingUp,
  stable: Minus,
  review: ShieldAlert,
};

function KpiBadge({ tone, text }: { tone: KpiTone; text: string }) {
  const Icon = KPI_TONE[tone];
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-1.5 py-0.5 text-[12px] font-semibold text-[#3f3f46]">
      <Icon className="size-3.5 shrink-0 text-[#525252]" strokeWidth={2.25} />
      <span className="truncate">{text}</span>
    </span>
  );
}

function Kpi({
  label,
  badge,
  tone,
  primary,
  accent,
}: {
  label: string;
  badge: string;
  tone: KpiTone;
  primary: string;
  accent: string;
}) {
  return (
    <div className="relative flex items-stretch gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className="my-0.5 w-1 shrink-0 rounded-full" style={{ background: accent }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#3f3f46]">{label}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <TypedKpiNumber key={primary} primary={primary} />
          <KpiBadge tone={tone} text={badge} />
        </div>
      </div>
    </div>
  );
}

const PERIOD_KEY = "home-period-filter";
const SGG_KEY = "home-sgg-filter";
const ALL_PERIOD: PeriodRange = { kind: "all" };
const filterListeners = new Set<() => void>();
let cachedPeriodRaw: string | null | undefined;
let cachedPeriodYearKey = "";
let cachedPeriod: PeriodRange = ALL_PERIOD;
let legacyKeysCleared = false;

function emitFilterChange() {
  filterListeners.forEach((l) => l());
}

function subscribeFilters(onStoreChange: () => void) {
  filterListeners.add(onStoreChange);
  return () => {
    filterListeners.delete(onStoreChange);
  };
}

function clearLegacyKeys() {
  if (legacyKeysCleared || typeof window === "undefined") return;
  legacyKeysCleared = true;
  try {
    window.localStorage.removeItem("home-year-filter");
    window.localStorage.removeItem("home-month-filter");
  } catch {
    /* ignore */
  }
}

function readSgg(): string {
  if (typeof window === "undefined") return "all";
  clearLegacyKeys();
  return window.localStorage.getItem(SGG_KEY) ?? "all";
}

function readPeriod(yearList: string[]): PeriodRange {
  if (typeof window === "undefined") return ALL_PERIOD;
  clearLegacyKeys();
  const raw = window.localStorage.getItem(PERIOD_KEY);
  const yearKey = yearList.join(",");
  if (raw === cachedPeriodRaw && yearKey === cachedPeriodYearKey) return cachedPeriod;
  cachedPeriodRaw = raw;
  cachedPeriodYearKey = yearKey;
  cachedPeriod = parseStoredPeriod(raw, yearList);
  return cachedPeriod;
}

function writeSgg(next: string) {
  window.localStorage.setItem(SGG_KEY, next);
  emitFilterChange();
}

function writePeriod(next: PeriodRange) {
  const raw = JSON.stringify(next);
  window.localStorage.setItem(PERIOD_KEY, raw);
  cachedPeriodRaw = raw;
  cachedPeriod = next;
  emitFilterChange();
}

export function HomeDashboardClient({
  insights,
}: {
  insights: BikeAccidentInsights | null;
}) {
  const yearListKey = (insights?.meta.yearList ?? []).join(",");
  const getPeriodSnapshot = useCallback(
    () => readPeriod(yearListKey ? yearListKey.split(",") : []),
    [yearListKey]
  );
  const sgg = useSyncExternalStore(subscribeFilters, readSgg, () => "all");
  const period = useSyncExternalStore(subscribeFilters, getPeriodSnapshot, () => ALL_PERIOD);

  if (!insights) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        자전거 사고 인사이트 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  const yearList = insights.meta.yearList ?? Object.keys(insights.byYear ?? {});
  const isAll = sgg === "all";
  const fullPeriod = checkFullPeriod(period, yearList);
  const slice = resolvePeriodSlice(insights, period, sgg);
  const scope = isAll ? "서울 전체" : sgg;
  const periodLabel = formatPeriodLabel(period, yearList);
  const {
    headline,
    roadTypes,
    ages,
    violations,
    hours,
    dayHour,
    seasons,
    months,
    bikeRoadCompare,
  } = slice;

  const bikeOn = bikeRoadCompare.find((d) => d.key.includes("위"));
  const bikeOff = bikeRoadCompare.find((d) => d.key.includes("밖"));
  const bikeTotal = (bikeOn?.n ?? 0) + (bikeOff?.n ?? 0) || 1;
  const bikeOffShare = bikeOff ? (bikeOff.n / bikeTotal) * 100 : 0;
  const bikeOffFatalityRatio =
    bikeOn && bikeOff && bikeOn.fatalityPer1000 > 0
      ? bikeOff.fatalityPer1000 / bikeOn.fatalityPer1000
      : null;
  const overallFatality =
    slice.total > 0 ? (slice.deaths / slice.total) * 1000 : 0;
  const dawnFatality = headline.dawnFatalityPer1000;
  const dawnVsOverall =
    overallFatality > 0 ? dawnFatality / overallFatality : null;
  const violationNote = isAll && fullPeriod ? "표본 n≥50" : "표본 n≥5";
  const chartKey = `${periodLabel}-${scope}-${slice.total}`;
  const blackspots = resolvePeriodBlackspots(insights, period, sgg);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 pb-1">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">서울 자전거 피해 사고 인사이트</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearCalendarPicker years={yearList} value={period} onChange={writePeriod} />
          <Select value={sgg} onValueChange={writeSgg}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 구</SelectItem>
              {(insights.meta.sggList ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="전용도로 밖 비중"
          tone={bikeOffShare >= 50 ? "atRisk" : "onTrack"}
          badge={`위 ${(100 - bikeOffShare).toFixed(1)}%`}
          primary={`${bikeOffShare.toFixed(1)}%`}
          accent={KPI_ACCENTS[0]}
        />
        <Kpi
          label={isAll ? "전체 사고" : `${sgg} 사고`}
          tone="review"
          badge={`사망 ${slice.deaths.toLocaleString()}명`}
          primary={`${slice.total.toLocaleString()}건`}
          accent={KPI_ACCENTS[1]}
        />
        <Kpi
          label="밖 치사율 (위 대비)"
          tone={
            bikeOffFatalityRatio != null && bikeOffFatalityRatio >= 2
              ? "atRisk"
              : bikeOffFatalityRatio != null && bikeOffFatalityRatio >= 1.3
                ? "review"
                : "stable"
          }
          badge={
            bikeOn && bikeOff
              ? `위 ${bikeOn.fatalityPer1000} · 밖 ${bikeOff.fatalityPer1000}`
              : "비교 불가"
          }
          primary={
            bikeOffFatalityRatio != null
              ? `${bikeOffFatalityRatio.toFixed(1)}배`
              : "—"
          }
          accent={KPI_ACCENTS[2]}
        />
        <Kpi
          label="새벽 치사율 (05–07)"
          tone={
            dawnVsOverall != null && dawnVsOverall >= 2
              ? "atRisk"
              : dawnVsOverall != null && dawnVsOverall >= 1.3
                ? "review"
                : "stable"
          }
          badge={
            dawnVsOverall != null
              ? `전체 ${overallFatality.toFixed(1)} · ${dawnVsOverall.toFixed(1)}배`
              : `사고 ${headline.dawnAccidents}건`
          }
          primary={`${dawnFatality.toFixed(1)}/천`}
          accent={KPI_ACCENTS[3]}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-10">
        <Card className="flex h-full flex-col rounded-2xl border shadow-none xl:col-span-3">
          <ChartCardHeader
            className="shrink-0 pb-2"
            title="도로형태 건수 비중"
            description="단일로·교차로 중 사고가 어디에 몰리는지"
            info={`${scope} · 단일로와 교차로 사고 건수 구성 비중입니다. 어느 도로형태에서 사고가 더 많이 나는지 한눈에 볼 수 있습니다.`}
          />
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <RoadTypeShareChart key={`${chartKey}-share`} data={roadTypes} />
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col rounded-2xl border shadow-none xl:col-span-7">
          <ChartCardHeader
            className="shrink-0 pb-2"
            title="반복사고 지점 (블랙스팟)"
            description="선택한 기간·자치구 기준 · 심각률로 위험도 비교"
            info={`${periodLabel} · ${scope}. 구는 사고 좌표(도로 구간)가 속한 자치구로 잡고, 같은 도로명은 구를 합산합니다. 여러 구에 걸치면 로고를 겹쳐 표시하며, 핀으로 지도로 이동합니다. 심각률은 (사망+중상)÷건수입니다.`}
          />
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <BlackspotRankingTable key={`${chartKey}-bs`} blackspots={blackspots} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="전용도로 위 vs 밖"
            description="전용도로 50m 안팎의 건수·치사율 차이"
            info={`${scope} · 전용도로 50m 인접 기준으로 ‘위/밖’을 나눕니다. 건수·사망·치사율·심각률을 함께 비교해 인프라 안팎의 위험 차이를 봅니다.`}
          />
          <CardContent>
            <BikeRoadCompareChart key={`${chartKey}-bike`} data={bikeRoadCompare} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="연령대 사고 비중 vs 치사율"
            description="건수는 적어도 치명도가 높은 연령대를 찾습니다"
            info={`${scope} · 가해 운전자(당사자1) 연령 기준입니다. 사고 비중과 치사율(/1000건)을 함께 보면 건수는 적어도 치명도가 높은 연령대를 찾을 수 있습니다.`}
          />
          <CardContent>
            <AgeRiskChart key={`${chartKey}-age`} data={ages} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="도로형태 치사율 · 심각률"
            info={`${scope} · 치사율은 사망÷건수×1,000, 심각률은 (사망사고+중상사고)÷건수입니다. 건수 비중과 별개로 ‘얼마나 치명적인지’를 봅니다.`}
          />
          <CardContent>
            <RoadTypeRiskChart key={`${chartKey}-risk`} data={roadTypes} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="시간대별 사고 건수 · 치사율"
            description="새벽 등 표본이 적은 시간은 치사율 해석에 주의"
            info={`${scope} · 시간대별 건수와 치사율을 함께 표시합니다. 표본이 적은 시간대는 치사율이 크게 출렁일 수 있으니 해석에 주의하세요.`}
          />
          <CardContent>
            <HourVolumeFatalityChart key={`${chartKey}-hour`} hours={hours} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border shadow-none">
        <ChartCardHeader
          title="요일 × 시간 히트맵"
          description="언제 사고가 몰리는지 · 건수/심각건수 전환"
          info={`${scope} · 요일과 시간대 교차 분포입니다. 출퇴근·주말 패턴을 볼 때 씁니다. 심각건수는 사망·중상 사고 건수입니다.`}
        />
        <CardContent>
          <DayHourHeatmap key={`${chartKey}-dh`} data={dayHour} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="월별 사고 건수"
            info={`${scope} · 월별 사고 발생 건수입니다. 계절·휴가철 등 시기별 패턴을 확인할 때 씁니다.`}
          />
          <CardContent>
            <MonthVolumeChart key={`${chartKey}-month`} months={months} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="계절별 치사율 · 심각률"
            info={`${scope} · 봄·여름·가을·겨울별 건수, 치사율(/1000), 심각률을 표로 비교합니다.`}
          />
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>계절</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                  <TableHead className="text-right">치사율</TableHead>
                  <TableHead className="text-right">심각률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasons.map((s) => (
                  <TableRow key={s.key}>
                    <TableCell className="font-medium">{s.key}</TableCell>
                    <TableCell className="text-right">{s.n.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{s.fatalityPer1000.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{s.seriousRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <ChartCardHeader
            title="법규위반별 치사율"
            info={`${scope} · 가해 운전자 법규위반별 건수·비중·치사율입니다. ${violationNote}만 표시하며, 치사율 높은 순으로 상위 항목을 보여 줍니다.`}
          />
          <CardContent>
            {violations.length === 0 ? (
              <p className="text-muted-foreground text-sm">표시할 법규위반 표본이 부족합니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>법규위반</TableHead>
                    <TableHead className="text-right">건수</TableHead>
                    <TableHead className="text-right">비중</TableHead>
                    <TableHead className="text-right">치사율</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...violations]
                    .sort((a, b) => b.fatalityPer1000 - a.fatalityPer1000)
                    .slice(0, 7)
                    .map((v) => (
                      <TableRow key={v.key}>
                        <TableCell className="font-medium">{v.key}</TableCell>
                        <TableCell className="text-right">{v.n.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{v.share}%</TableCell>
                        <TableCell className="text-right">{v.fatalityPer1000.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
