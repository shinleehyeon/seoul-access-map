import { InterventionTable } from "@/components/insights/InterventionTable";
import { getBikeAccidentInsights } from "@/lib/data";

export default async function InterventionPage() {
  const insights = await getBikeAccidentInsights();

  if (!insights) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        자전거 사고 인사이트 데이터를 불러오지 못했습니다.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">해결 방안</h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          서울 자전거 사고 데이터에서 반복적으로 나타나는 패턴을 바탕으로 한 개입 방향 요약입니다.
        </p>
      </div>
      <InterventionTable headline={insights.headline} />
    </div>
  );
}
