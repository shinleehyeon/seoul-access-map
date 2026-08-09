"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/kpi/KpiCards";
import { InsightCards } from "@/components/kpi/InsightCards";
import { RankingList } from "@/components/kpi/RankingList";
import { DistrictOverview } from "@/components/kpi/DistrictOverview";
import { GapBarChart } from "@/components/charts/GapBarChart";
import { EveningPerPopChart } from "@/components/charts/EveningPerPopChart";
import { UncoveredPopChart } from "@/components/charts/UncoveredPopChart";
import { WeekendLateChart } from "@/components/charts/WeekendLateChart";
import { EveningShareChart } from "@/components/charts/EveningShareChart";
import type { DistrictStat, Summary } from "@/lib/types";

export function HomeDashboardClient({
  districtStats,
  summary,
}: {
  districtStats: DistrictStat[];
  summary: Summary | null;
}) {
  const weekendVals = districtStats
    .map((d) => d.weekendLatePer10k)
    .filter((v): v is number => v != null);
  const weekendAvg = weekendVals.length
    ? Math.round((weekendVals.reduce((a, b) => a + b, 0) / weekendVals.length) * 10) / 10
    : 0;
  const weekendMin = weekendVals.length ? Math.min(...weekendVals) : 0;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">저녁 약국 공백</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            저녁 21시 생활인구 기준으로, 평일 21시+ 약국이 도보 10분(800m) 안에 없는 인구 비중을
            자치구별로 비교합니다.
          </p>
        </div>
        <Button className="rounded-full" asChild>
          <a href="/map">지도에서 살펴보기</a>
        </Button>
      </div>

      <KpiCards summary={summary} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">다른 각도에서 보기</h2>
          <p className="text-muted-foreground text-xs">
            주말 심야 · 저녁 약국 쏠림 · 생활인구와 주민 수 괴리
          </p>
        </div>
        <InsightCards summary={summary} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base font-medium">주말·공휴일 심야 부족</CardTitle>
                <CardDescription>1만명당 토·일·공휴일 22시+ · 적은 순</CardDescription>
              </div>
              <div className="flex shrink-0 gap-2 rounded-xl border px-3 py-1.5">
                <div>
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">시 평균</p>
                  <p className="text-sm font-semibold">{weekendAvg}</p>
                </div>
                <div className="border-l pl-2">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">최저 구</p>
                  <p className="text-sm font-semibold">{weekendMin}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <WeekendLateChart stats={districtStats} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">공백 인구가 많은 구</CardTitle>
              <CardDescription>도보 10분 밖 생활인구 추정 · 상위 5</CardDescription>
            </CardHeader>
            <CardContent>
              <UncoveredPopChart stats={districtStats} />
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">공백 점수 Top 10</CardTitle>
            <CardDescription>높을수록 저녁 약국 접근이 취약</CardDescription>
          </CardHeader>
          <CardContent>
            <GapBarChart stats={districtStats} />
          </CardContent>
        </Card>
        <RankingList stats={districtStats} limit={5} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">저녁 약국 쏠림</CardTitle>
            <CardDescription>시 전체 저녁 약국 점유율 · 많은 순</CardDescription>
          </CardHeader>
          <CardContent>
            <EveningShareChart stats={districtStats} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">인구 대비 저녁 약국</CardTitle>
            <CardDescription>1만명당 저녁 약국이 적은 순 Top 10</CardDescription>
          </CardHeader>
          <CardContent>
            <EveningPerPopChart stats={districtStats} />
          </CardContent>
        </Card>
      </div>

      <DistrictOverview stats={districtStats} />

      {summary?.method ? (
        <p className="text-muted-foreground pb-4 text-xs leading-relaxed">
          산출: {summary.method}
          {summary.spopDate ? ` · 생활인구 ${summary.spopDate} ${summary.spopHour ?? 21}시` : ""}
        </p>
      ) : null}
    </div>
  );
}
