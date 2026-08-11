import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BikeAccidentInsights } from "@/lib/types";

export function InterventionTable({
  headline,
}: {
  headline: BikeAccidentInsights["headline"];
}) {
  return (
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
                `보행자 ${headline.pedestrianCount.toLocaleString()}건`,
                "안전한 차도측 자전거 공간",
              ],
              [
                "전용도로 중상",
                `심각률 ${headline.bikeBikeSeriousRate}%`,
                "폭·일방화·속도 관리",
              ],
              [
                "새벽 사망",
                `05–07 치사율 ${headline.dawnFatalityPer1000}`,
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
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          치사율 = 사망자수 ÷ 사고건수 × 1,000 · 심각사고율 = (사망사고+중상사고) ÷ 사고건수 ·
          시 전체·전체 기간 누적 패턴 기준이며, 특정 자치구·기간으로 좁히면 표본이 작아 수치가
          달라질 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}
