import { InterventionChat } from "@/components/insights/InterventionChat";
import { InterventionTable } from "@/components/insights/InterventionTable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
          AI와 대화하며 서울 자전거 사고 패턴에 맞는 개입 방향을 탐색하세요.
        </p>
      </div>

      <div className="flex min-h-[420px] flex-1 flex-col">
        <InterventionChat />
      </div>

      <Accordion type="single" collapsible className="rounded-2xl border px-4">
        <AccordionItem value="interventions" className="border-none">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            개입 방향 참고 표
          </AccordionTrigger>
          <AccordionContent>
            <InterventionTable headline={insights.headline} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
