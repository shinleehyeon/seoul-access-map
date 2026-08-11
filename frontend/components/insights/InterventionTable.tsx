import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BikeAccidentInsights } from "@/lib/types";

export function InterventionTable({
  headline,
}: {
  headline: BikeAccidentInsights["headline"];
}) {
  return (
    <div>
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
            [
              "대형차 사망",
              `사고 ${headline.heavyVehicleAccidentShare}% → 사망 ${headline.heavyVehicleDeathShare}%`,
              "물류·공사 동선 분리, 우회전 안전",
            ],
            [
              "고령 사망",
              `사고 ${headline.elderlyAccidentShare}% → 사망 ${headline.elderlyDeathShare}%`,
              "생활권 교차로·저속화",
            ],
            ["교차로 치명", "치사율 높음 vs 단일로", "신호·회전 속도·횡단보도내 우선"],
            ["단일로 다발", "건수·심각률 높음", "자전거도로 분리·노면 표시"],
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
            ["중앙선침범", "고치사 위반", "단일로 중앙분리·과속 억제"],
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
        시 전체·전체 기간 누적 패턴 기준이며, AI 답변의 근거 요약으로도 쓰입니다. 특정
        자치구·기간으로 좁히면 수치가 달라질 수 있습니다.
      </p>
    </div>
  );
}
