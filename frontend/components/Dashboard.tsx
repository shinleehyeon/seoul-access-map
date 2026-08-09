"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import {
  DEFAULT_TYPES,
  FilterSidebar,
  type FilterState,
} from "@/components/sidebar/FilterSidebar";
import { DetailPanel } from "@/components/panel/DetailPanel";
import { isInDistrictBBox } from "@/lib/districtBounds";
import type { DistrictStat, Pharmacy } from "@/lib/types";

function matchesTypeFilter(p: Pharmacy, types: FilterState["types"]) {
  const anySelected = types.evening || types.late || types.normal;
  if (!anySelected) return false; // 전부 해제하면 약국 숨김
  const isNormal = !p.isEvening && !p.isLateNight;
  return (
    (types.evening && p.isEvening) ||
    (types.late && p.isLateNight) ||
    (types.normal && isNormal)
  );
}

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/30 flex h-full items-center justify-center">
      <span className="text-muted-foreground text-sm">지도를 불러오는 중...</span>
    </div>
  ),
});

export function Dashboard({
  pharmacies,
  districtStats,
  initialId,
}: {
  pharmacies: Pharmacy[];
  districtStats: DistrictStat[];
  initialId?: string;
}) {
  const [filters, setFilters] = useState<FilterState>({
    types: { ...DEFAULT_TYPES },
    sgg: "all",
    query: "",
    gapFillStep: 0,
  });
  const [selected, setSelected] = useState<Pharmacy | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelSlot(document.getElementById("map-sidebar-panel-slot"));
  }, []);

  useEffect(() => {
    if (!initialId) return;
    const match = pharmacies.find((p) => p.id === initialId);
    if (match) {
      setSelected(match);
      setPanelOpen(true);
    }
  }, [initialId, pharmacies]);

  const districts = useMemo(
    () => Array.from(new Set(pharmacies.map((p) => p.sgg))).sort(),
    [pharmacies]
  );

  const filtered = useMemo(() => {
    let rows = pharmacies.filter((p) => matchesTypeFilter(p, filters.types));
    if (filters.sgg !== "all") {
      rows = rows.filter(
        (p) => p.sgg === filters.sgg && isInDistrictBBox(p.lon, p.lat, filters.sgg)
      );
    }
    if (filters.query.trim()) {
      const q = filters.query.trim();
      rows = rows.filter((p) => p.name.includes(q) || p.address.includes(q) || p.sgg.includes(q));
    }
    return rows;
  }, [pharmacies, filters]);

  function handleSelect(p: Pharmacy | null) {
    setSelected(p);
    setPanelOpen(p !== null);
  }

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="hover:bg-accent flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors"
      >
        <span className="text-muted-foreground flex-1 text-sm font-medium">필터</span>
        <ChevronDown
          className={`text-muted-foreground size-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
        />
      </button>
      {sidebarOpen && (
        <FilterSidebar districts={districts} filters={filters} onChange={setFilters} />
      )}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <MapView
          pharmacies={filtered}
          districtStats={districtStats}
          selected={selected}
          onSelect={handleSelect}
          detailOpen={panelOpen}
          gapFillStep={filters.gapFillStep}
          focusSgg={filters.sgg === "all" ? null : filters.sgg}
          visibleTypes={filters.types}
          dataKey={`${filters.types.evening}-${filters.types.late}-${filters.types.normal}|${filters.sgg}|${filters.query}|${filtered.length}`}
        />
      </div>

      {panelSlot && createPortal(panel, panelSlot)}

      <DetailPanel
        pharmacy={selected}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
