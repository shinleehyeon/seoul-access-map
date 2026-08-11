"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DistrictInsightTable } from "@/components/insights/DistrictInsightTable";
import { YearCalendarPicker } from "@/components/insights/YearCalendarPicker";
import {
  formatPeriodLabel,
  isFullPeriod as checkFullPeriod,
  parseStoredPeriod,
  resolvePeriodDistricts,
  resolvePeriodSlice,
  type PeriodRange,
} from "@/lib/bikeInsightPeriod";
import type { BikeAccidentInsights } from "@/lib/types";

function Kpi({
  label,
  value,
  unit,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <Card className="rounded-2xl border p-4 shadow-none">
      <p className="text-muted-foreground text-xs font-medium tracking-wide">{label}</p>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight md:text-3xl">{value}</span>
        {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{caption}</p>
    </Card>
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
  const districts = resolvePeriodDistricts(insights, period);
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

  const single = roadTypes.find((r) => r.key === "단일로");
  const cross = roadTypes.find((r) => r.key === "교차로");
  const opponentMin = isAll && fullPeriod ? 50 : 5;
  const violationNote = isAll && fullPeriod ? "표본 n≥50" : "표본 n≥5";

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">서울 자전거 피해 사고 인사이트</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {insights.meta.source} · {periodLabel} · {scope}{" "}
            {slice.total.toLocaleString()}건 · 사망 {slice.deaths}명.
            기간(시작~끝)·자치구를 고르면 도로·시간·법규·전용도로 지표를 좁혀 볼 수 있습니다.
          </p>
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={isAll ? "전체 사고" : `${sgg} 사고`}
          value={slice.total.toLocaleString()}
          unit="건"
          caption={fullPeriod ? `${periodLabel} 누적` : periodLabel}
        />
        <Kpi
          label="교차로 치사율"
          value={cross ? cross.fatalityPer1000.toFixed(1) : "—"}
          unit="/1000"
          caption={`단일로 ${single?.fatalityPer1000.toFixed(1) ?? "—"}`}
        />
        <Kpi
          label="대형차 사망 점유"
          value={`${headline.heavyVehicleDeathShare}`}
          unit="%"
          caption={`사고 비중 ${headline.heavyVehicleAccidentShare}%`}
        />
        <Kpi
          label="65세+ 사망 점유"
          value={`${headline.elderlyDeathShare}`}
          unit="%"
          caption={`사고 비중 ${headline.elderlyAccidentShare}%`}
        />
        <Kpi
          label="05–07시 치사율"
          value={headline.dawnFatalityPer1000.toFixed(1)}
          unit="/1000"
          caption={`사망 ${headline.dawnDeaths}명 / ${headline.dawnAccidents}건`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">도로형태 건수 비중</CardTitle>
            <CardDescription>{scope} · 단일로 vs 교차로 구성</CardDescription>
          </CardHeader>
          <CardContent>
            <RoadTypeShareChart data={roadTypes} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">도로형태 치사율 · 심각률</CardTitle>
            <CardDescription>{scope} · 치사율(/1000건)과 사망+중상 비율(%)</CardDescription>
          </CardHeader>
          <CardContent>
            <RoadTypeRiskChart data={roadTypes} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">상대차종별 치사율</CardTitle>
            <CardDescription>{scope} · 화물·승합·건설기계 비중을 함께 보세요</CardDescription>
          </CardHeader>
          <CardContent>
            <OpponentFatalityChart data={opponents} minN={opponentMin} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">연령대 사고 비중 vs 치사율</CardTitle>
            <CardDescription>{scope} · 가해 운전자(당사자1) 연령 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <AgeRiskChart data={ages} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">시간대별 사고 건수 · 치사율</CardTitle>
            <CardDescription>{scope} · 표본이 적은 시간은 치사율 해석에 주의</CardDescription>
          </CardHeader>
          <CardContent>
            <HourVolumeFatalityChart hours={hours} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">월별 사고 건수</CardTitle>
            <CardDescription>{scope}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthVolumeChart months={months} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">계절별 치사율 · 심각률</CardTitle>
            <CardDescription>{scope}</CardDescription>
          </CardHeader>
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
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">전용도로 위 vs 밖</CardTitle>
            <CardDescription>{scope} · 전용도로 50m 인접 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <BikeRoadCompareChart data={bikeRoadCompare} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">법규위반별 치사율</CardTitle>
            <CardDescription>
              {scope} · 가해 운전자 위반 기준 · {violationNote}
            </CardDescription>
          </CardHeader>
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

      {isAll ? (
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">자치구 — 다발과 치명은 다른 지도</CardTitle>
            <CardDescription>
              {periodLabel} · 시 전체 비교용. 정렬을 바꿔 보세요. 건수 1위와 치사율 1위는 보통
              다릅니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistrictInsightTable districts={districts} />
          </CardContent>
        </Card>
      ) : null}

      {isAll && fullPeriod ? (
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">개입 방향</CardTitle>
            <CardDescription>시 전체·전 기간 패턴 기준 처방 요약</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>문제</TableHead>
                  <TableHead>신호</TableHead>
                  <TableHead>개입</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["대형차 사망", "사고 10% → 사망 44%", "물류·공사 동선 분리, 우회전 안전"],
                  ["고령 사망", "사고 20% → 사망 54%", "생활권 교차로·저속화"],
                  ["교차로 치명", "치사율 9.11 vs 단일 5.28", "신호·회전 속도·횡단보도내 우선"],
                  ["단일로 다발", "건수 49% · 심각률 28.5%", "자전거도로 분리·노면 표시"],
                  [
                    "보도 충돌",
                    `보행자 ${insights.headline.pedestrianCount.toLocaleString()}건`,
                    "안전한 차도측 자전거 공간",
                  ],
                  [
                    "전용도로 중상",
                    `심각률 ${insights.headline.bikeBikeSeriousRate}%`,
                    "폭·일방화·속도 관리",
                  ],
                  [
                    "새벽 사망",
                    `05–07 치사율 ${insights.headline.dawnFatalityPer1000}`,
                    "새벽 화물축 조명·분리",
                  ],
                  ["중앙선침범", "치사율 14.6", "단일로 중앙분리·과속 억제"],
                ].map(([problem, signal, action]) => (
                  <TableRow key={problem}>
                    <TableCell className="font-medium">{problem}</TableCell>
                    <TableCell className="text-muted-foreground">{signal}</TableCell>
                    <TableCell>{action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-muted-foreground pb-4 text-xs leading-relaxed">
        치사율 = 사망자수 ÷ 사고건수 × 1,000 · 심각사고율 = (사망사고+중상사고) ÷ 사고건수 ·
        기간·자치구 필터 시 표본이 작아 치사율이 출렁일 수 있습니다 · 자치구 비교 표는 전체 구
        보기에서, 개입 방향은 전체 기간·전체 구에서만 표시됩니다.
      </p>
    </div>
  );
}
