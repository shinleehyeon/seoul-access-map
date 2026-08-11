"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { BikeAccidentInsights } from "@/lib/types";

type SortKey = "n" | "fatalityPer1000" | "seriousRate" | "truckShare" | "elderlyShare";

export function DistrictInsightTable({
  districts,
}: {
  districts: BikeAccidentInsights["districts"];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("n");
  const rows = useMemo(
    () => [...districts].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 12),
    [districts, sortKey]
  );

  const sorts: Array<{ key: SortKey; label: string }> = [
    { key: "n", label: "건수" },
    { key: "fatalityPer1000", label: "치사율" },
    { key: "seriousRate", label: "심각률" },
    { key: "truckShare", label: "대형차" },
    { key: "elderlyShare", label: "고령" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {sorts.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={sortKey === s.key ? "default" : "outline"}
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setSortKey(s.key)}
          >
            {s.label}순
          </Button>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>자치구</TableHead>
            <TableHead className="text-right">건수</TableHead>
            <TableHead className="text-right">치사율</TableHead>
            <TableHead className="text-right">심각률</TableHead>
            <TableHead className="text-right">대형차%</TableHead>
            <TableHead className="text-right">고령%</TableHead>
            <TableHead className="text-right">교차로%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.sgg}>
              <TableCell className="font-medium">{d.sgg}</TableCell>
              <TableCell className="text-right">{d.n.toLocaleString()}</TableCell>
              <TableCell className="text-right">{d.fatalityPer1000.toFixed(1)}</TableCell>
              <TableCell className="text-right">{d.seriousRate.toFixed(1)}%</TableCell>
              <TableCell className="text-right">{d.truckShare.toFixed(0)}%</TableCell>
              <TableCell className="text-right">{d.elderlyShare.toFixed(0)}%</TableCell>
              <TableCell className="text-right">{d.crossShare.toFixed(0)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
