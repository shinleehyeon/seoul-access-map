"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BikeBlackspotRow } from "@/lib/types";
import { districtLogoSrc } from "@/lib/districtLogo";

const PAGE_SIZE = 5;

type RiskLevel = "high" | "mid" | "low";

export type AggregatedBlackspot = {
  road: string;
  sggs: string[];
  n: number;
  deaths: number;
  fatalityPer1000: number;
  seriousRate: number;
};

function riskOf(b: AggregatedBlackspot): RiskLevel {
  if (b.deaths > 0 || b.fatalityPer1000 >= 15 || b.seriousRate >= 45) return "high";
  if (b.fatalityPer1000 >= 5 || b.seriousRate >= 35) return "mid";
  return "low";
}

const RISK_LABEL: Record<RiskLevel, string> = {
  high: "위험",
  mid: "주의",
  low: "보통",
};

const RISK_CLASS: Record<RiskLevel, string> = {
  high: "border-transparent bg-[#f87171]/15 text-[#dc2626]",
  mid: "border-transparent bg-[#fbbf24]/20 text-[#b45309]",
  low: "border-transparent bg-[#4ade80]/20 text-[#15803d]",
};

export function aggregateByRoad(blackspots: BikeBlackspotRow[]): AggregatedBlackspot[] {
  const map = new Map<
    string,
    { sggs: { sgg: string; n: number }[]; n: number; deaths: number; severeWeighted: number }
  >();

  for (const b of blackspots) {
    const cur = map.get(b.road) ?? { sggs: [], n: 0, deaths: 0, severeWeighted: 0 };
    cur.sggs.push({ sgg: b.sgg, n: b.n });
    cur.n += b.n;
    cur.deaths += b.deaths;
    cur.severeWeighted += (b.seriousRate / 100) * b.n;
    map.set(b.road, cur);
  }

  return [...map.entries()]
    .map(([road, v]) => {
      const sggs = [...v.sggs].sort((a, b) => b.n - a.n).map((x) => x.sgg);
      return {
        road,
        sggs,
        n: v.n,
        deaths: v.deaths,
        fatalityPer1000: v.n ? Math.round((v.deaths / v.n) * 1000 * 100) / 100 : 0,
        seriousRate: v.n ? Math.round((v.severeWeighted / v.n) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.n - a.n || b.fatalityPer1000 - a.fatalityPer1000);
}

function DistrictAvatarStack({ sggs }: { sggs: string[] }) {
  const [raised, setRaised] = useState<string | null>(null);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="isolate flex items-center">
        {sggs.map((sgg, i) => (
          <Tooltip key={sgg}>
            <TooltipTrigger asChild>
              <span
                className="relative inline-flex size-7 shrink-0 cursor-default items-center justify-center rounded-full border-2 border-[#d4d4d8] bg-white ring-2 ring-white"
                style={{
                  marginLeft: i === 0 ? 0 : -7,
                  zIndex: raised === sgg ? 50 : sggs.length - i,
                }}
                onMouseEnter={() => setRaised(sgg)}
                onMouseLeave={() => setRaised(null)}
                onFocus={() => setRaised(sgg)}
                onBlur={() => setRaised(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={districtLogoSrc(sgg)}
                  alt={sgg}
                  width={28}
                  height={28}
                  className="size-7 rounded-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) {
                      fallback.classList.remove("hidden");
                      fallback.classList.add("flex");
                    }
                  }}
                />
                <span className="bg-muted text-muted-foreground hidden size-7 items-center justify-center rounded-full text-[10px] font-semibold">
                  {sgg.slice(0, 1)}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="px-2 py-1 text-xs">
              {sgg}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

export function BlackspotRankingTable({ blackspots }: { blackspots: BikeBlackspotRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const aggregated = useMemo(() => aggregateByRoad(blackspots), [blackspots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return aggregated;
    return aggregated.filter(
      (b) =>
        b.road.toLowerCase().includes(q) ||
        b.sggs.some((s) => s.toLowerCase().includes(q))
    );
  }, [aggregated, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (blackspots.length === 0) {
    return <p className="text-muted-foreground text-sm">표시할 블랙스팟이 없습니다.</p>;
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      <div className="relative max-w-[220px] shrink-0">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="도로·자치구 검색…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto rounded-xl border">
        <Table className="table-fixed text-base">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-9 px-2 text-center text-sm">#</TableHead>
              <TableHead className="w-[28%] px-2 text-sm">도로</TableHead>
              <TableHead className="w-[22%] px-2 text-sm">자치구</TableHead>
              <TableHead className="w-14 px-2 text-right text-sm">건수</TableHead>
              <TableHead className="w-16 px-2 text-sm">위험</TableHead>
              <TableHead className="w-[24%] px-2 text-sm" title="(사망사고+중상사고) ÷ 사고건수">
                심각사고율
              </TableHead>
              <TableHead className="w-10 px-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-20 text-center text-sm">
                  검색 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((b, i) => {
                const rank = safePage * PAGE_SIZE + i + 1;
                const risk = riskOf(b);
                const pct = Math.min(100, Math.max(0, Math.round(b.seriousRate)));
                const mapHref =
                  b.sggs.length > 1
                    ? `/map?broad=${encodeURIComponent(b.road)}&bsggs=${encodeURIComponent(b.sggs.join(","))}`
                    : `/map?bsgg=${encodeURIComponent(b.sggs[0])}&broad=${encodeURIComponent(b.road)}`;

                return (
                  <TableRow key={b.road}>
                    <TableCell className="text-muted-foreground px-2 text-center text-sm tabular-nums">
                      {rank}
                    </TableCell>
                    <TableCell className="truncate px-2 text-[15px] font-semibold" title={b.road}>
                      {b.road}
                    </TableCell>
                    <TableCell className="overflow-visible px-2">
                      <div className="flex min-w-0 items-center gap-2 overflow-visible">
                        <DistrictAvatarStack sggs={b.sggs} />
                        <span className="text-muted-foreground truncate text-sm">
                          {b.sggs.length > 1 ? `${b.sggs.length}개 구` : b.sggs[0]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-right text-base font-semibold tabular-nums">
                      {b.n.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-2">
                      <Badge className={`h-6 px-2 text-xs ${RISK_CLASS[risk]}`}>
                        {RISK_LABEL[risk]}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 max-w-[88px] flex-1" />
                        <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-1">
                      <Button asChild size="icon-sm" variant="ghost" className="size-8">
                        <Link
                          href={mapHref}
                          aria-label={`${b.road} 지도에서 보기`}
                          title={`치사율 ${b.fatalityPer1000.toFixed(1)}`}
                        >
                          <MapPin className="size-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {filtered.length.toLocaleString()}개 도로 · {safePage * PAGE_SIZE + 1}–
          {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} 표시
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="다음 페이지"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
