"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
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
import { AgeRiskChart, OpponentFatalityChart } from "@/components/insights/OpponentAgeCharts";
import { RoadTypeRiskChart, RoadTypeShareChart } from "@/components/insights/RoadTypeCharts";
import {
  BikeRoadCompareChart,
  HourVolumeFatalityChart,
  MonthVolumeChart,
} from "@/components/insights/TimeSeasonCharts";
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

const KPI_TONE: Record<
  KpiTone,
  { bg: string; fg: string; icon: LucideIcon }
> = {
  onTrack: { bg: "bg-[#e8f8ef]", fg: "text-[#1f7a4d]", icon: TrendingUp },
  atRisk: { bg: "bg-[#fdecee]", fg: "text-[#c23b45]", icon: TrendingDown },
  stable: { bg: "bg-[#fff3e6]", fg: "text-[#c26a1a]", icon: Minus },
  review: { bg: "bg-[#eaf2ff]", fg: "text-[#2f6fed]", icon: ShieldAlert },
};

function KpiBadge({ tone, text }: { tone: KpiTone; text: string }) {
  const { bg, fg, icon: Icon } = KPI_TONE[tone];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[12px] font-semibold ${bg} ${fg}`}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2.25} />
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
  href = "/map",
}: {
  label: string;
  badge: string;
  tone: KpiTone;
  primary: string;
  accent: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className="group relative flex items-stretch gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[#d4d4d4]"
    >
      <span className="my-0.5 w-1 shrink-0 rounded-full" style={{ background: accent }} />
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-[13px] font-medium text-[#3f3f46]">{label}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[22px] font-bold leading-none tracking-tight text-[#18181b] tabular-nums">
            {primary}
          </span>
          <KpiBadge tone={tone} text={badge} />
        </div>
      </div>
      <ArrowUpRight
        className="absolute top-3.5 right-3 size-4 text-[#a1a1aa] transition-colors group-hover:text-[#71717a]"
        strokeWidth={1.75}
      />
    </a>
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
    opponents,
    ages,
    violations,
    hours,
    seasons,
    months,
    bikeRoadCompare,
  } = slice;

  const bikeOn = bikeRoadCompare.find((d) => d.key.includes("위"));
  const bikeOff = bikeRoadCompare.find((d) => d.key.includes("밖"));
  const bikeTotal = (bikeOn?.n ?? 0) + (bikeOff?.n ?? 0) || 1;
  const bikeOffShare = bikeOff ? (bikeOff.n / bikeTotal) * 100 : 0;
  const opponentMin = isAll && fullPeriod ? 50 : 5;
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
          badge={
            bikeOffShare >= 50
              ? `주의: ${(bikeOff?.n ?? 0).toLocaleString()}건`
              : `양호: ${(bikeOff?.n ?? 0).toLocaleString()}건`
          }
          primary={`${bikeOffShare.toFixed(1)}%`}
          accent={KPI_ACCENTS[0]}
        />
        <Kpi
          label={isAll ? "전체 사고" : `${sgg} 사고`}
          tone="review"
          badge={`사망: ${slice.deaths}명`}
          primary={`${slice.total.toLocaleString()}건`}
          accent={KPI_ACCENTS[1]}
        />
        <Kpi
          label="대형차 사망 점유"
          tone={
            headline.heavyVehicleDeathShare > headline.heavyVehicleAccidentShare * 2
              ? "atRisk"
              : "stable"
          }
          badge={
            headline.heavyVehicleDeathShare > headline.heavyVehicleAccidentShare * 2
              ? `위험: 사고 ${headline.heavyVehicleAccidentShare}%`
              : `안정: 사고 ${headline.heavyVehicleAccidentShare}%`
          }
          primary={`${headline.heavyVehicleDeathShare}%`}
          accent={KPI_ACCENTS[2]}
        />
        <Kpi
          label="65세+ 사망 점유"
          tone={
            headline.elderlyDeathShare > headline.elderlyAccidentShare
              ? "atRisk"
              : "onTrack"
          }
          badge={
            headline.elderlyDeathShare > headline.elderlyAccidentShare
              ? `위험: 사고 ${headline.elderlyAccidentShare}%`
              : `양호: 사고 ${headline.elderlyAccidentShare}%`
          }
          primary={`${headline.elderlyDeathShare}%`}
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

      <Card className="rounded-2xl border shadow-none">
        <ChartCardHeader
          title="상대차종별 치사율"
          description="화물·승합·건설기계 등 대형차 관련 치명도"
          info={`${scope} · 상대 차종별 치사율입니다. 화물·승합·건설기계 등 대형차와 관련된 치명도를 함께 보세요. 표본이 적은 차종은 제외될 수 있습니다.`}
        />
        <CardContent>
          <OpponentFatalityChart key={`${chartKey}-opp`} data={opponents} minN={opponentMin} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground pb-4 text-xs leading-relaxed">
        치사율 = 사망자수 ÷ 사고건수 × 1,000 · 심각사고율 = (사망사고+중상사고) ÷ 사고건수 ·
        기간·자치구 필터 시 표본이 작아 치사율이 출렁일 수 있습니다.
      </p>
    </div>
  );
}
