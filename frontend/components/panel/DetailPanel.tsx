"use client";

import { ExternalLink, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Pharmacy } from "@/lib/types";

const DAY_LABELS: { key: keyof Pharmacy["hours"]; label: string }[] = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
  { key: "holiday", label: "공휴일" },
];

function roadviewUrl(lat: number, lon: number) {
  return `https://map.kakao.com/link/roadview/${lat},${lon}`;
}

function fmtRange(pair: [string | null, string | null]) {
  const [s, e] = pair;
  if (!s && !e) return "휴무/정보없음";
  return `${s ?? "—"} ~ ${e ?? "—"}`;
}

export function DetailPanel({
  pharmacy,
  open,
  onOpenChange,
}: {
  pharmacy: Pharmacy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/55 supports-backdrop-filter:backdrop-blur-sm"
        className="flex max-h-[min(90vh,840px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {pharmacy && (
          <>
            <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pr-12">
              <DialogTitle className="text-xl">{pharmacy.name}</DialogTitle>
              <DialogDescription>{pharmacy.address}</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 pt-4 pb-6">
              <div className="flex flex-wrap gap-2">
                {pharmacy.isEvening && <Badge>저녁 21시+</Badge>}
                {pharmacy.isLateNight && <Badge variant="secondary">심야 22시+</Badge>}
                <Badge variant="outline">{pharmacy.sgg}</Badge>
              </div>

              {pharmacy.tel && (
                <a
                  href={`tel:${pharmacy.tel}`}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
                >
                  <Phone className="size-4" />
                  {pharmacy.tel}
                </a>
              )}

              <Separator />

              <div>
                <div className="mb-2 text-sm font-medium">요일별 영업시간</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {DAY_LABELS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{fmtRange(pharmacy.hours[key])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button asChild className="w-full">
                <a
                  href={roadviewUrl(pharmacy.lat, pharmacy.lon)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  카카오 로드뷰에서 보기
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
