"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SafetyKpiCards } from "@/components/kpi/SafetyKpiCards";
import { SafetyInsightCards } from "@/components/kpi/SafetyInsightCards";
import { SafetyRankingList } from "@/components/kpi/SafetyRankingList";
import { BikeInfraScatterChart } from "@/components/charts/BikeInfraScatterChart";
import { BikePerKmChart } from "@/components/charts/BikePerKmChart";
import { ChildZoneRiskChart } from "@/components/charts/ChildZoneRiskChart";
import { HotspotShareChart } from "@/components/charts/HotspotShareChart";
import { BikeOnRoadRateChart } from "@/components/charts/BikeOnRoadRateChart";
import type { CrimeCctvStat } from "@/lib/types";

export function HomeDashboardClient({ stats }: { stats: CrimeCctvStat[] }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight">교통약자·자전거 안전 공백</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            자전거전용도로·어린이·노인 보호구역과 교통사고 다발지점을 자치구별로 비교합니다. 인프라
            대비 사고가 많은 곳을 먼저 보세요.
          </p>
        </div>
        <Button className="rounded-full" asChild>
          <a href="/map">지도에서 살펴보기</a>
        </Button>
      </div>

      <SafetyKpiCards stats={stats} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">어디에 공백이 큰가</h2>
          <p className="text-muted-foreground text-xs">인프라 대비 사고 밀도가 가장 높은 구</p>
        </div>
        <SafetyInsightCards stats={stats} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="rounded-2xl border shadow-none xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">자전거도로 vs 사고</CardTitle>
            <CardDescription>
              가로축 도로 길이 · 세로축 사고 건수 · 점 크기·색은 위험점수
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BikeInfraScatterChart stats={stats} />
          </CardContent>
        </Card>
        <SafetyRankingList stats={stats} limit={5} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">도로 1km당 자전거 사고</CardTitle>
            <CardDescription>전용도로가 있어도 사고가 몰리는 구 · Top 10</CardDescription>
          </CardHeader>
          <CardContent>
            <BikePerKmChart stats={stats} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">다발지점 유형 비중</CardTitle>
            <CardDescription>시 전체 자전거·어린이·노인 다발지점</CardDescription>
          </CardHeader>
          <CardContent>
            <HotspotShareChart stats={stats} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">어린이보호구역 대비 다발</CardTitle>
          <CardDescription>구역 100곳당 어린이 다발지점 · Top 10</CardDescription>
        </CardHeader>
        <CardContent>
          <ChildZoneRiskChart stats={stats} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">자전거사고, 전용도로 위에서 났나?</CardTitle>
          <CardDescription>
            다발지점 중 전용도로 50m 이내 비율 · 높으면 도로 설계 문제, 낮으면 도로 자체가 없는
            인프라 부재 문제
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BikeOnRoadRateChart stats={stats} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground pb-4 text-xs leading-relaxed">
        산출: 자전거 위험은 도로 1km당 사고·인구 대비 사고·다발지점을 종합 · 어린이·노인은 보호구역
        대비 다발지점 비중 · 온-인프라 비율은 사고 원인이 &ldquo;도로 설계&rdquo;인지 &ldquo;인프라 부재&rdquo;인지
        구분하는 참고 지표입니다 · 지도에서 구역·도로·핀을 함께 확인할 수 있습니다.
      </p>
    </div>
  );
}
