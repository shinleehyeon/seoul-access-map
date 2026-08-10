"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { ChevronDown } from "lucide-react";
import {
  DEFAULT_TYPES,
  FilterSidebar,
  type FilterState,
} from "@/components/sidebar/FilterSidebar";
import { DetailPanel } from "@/components/panel/DetailPanel";
import type { DistrictStat, Pharmacy } from "@/lib/types";

const SEOUL_DISTRICTS = [
  "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
  "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
  "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구",
  "강동구",
];

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
}: {
  pharmacies?: Pharmacy[];
  districtStats?: DistrictStat[];
  initialId?: string;
}) {
  const DEFAULT_FILTERS: FilterState = {
    types: { ...DEFAULT_TYPES },
    showChildZones: false,
    showElderlyZones: false,
    showBikeRoads: false,
    sgg: "all",
    gapFillStep: 0,
  };
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    try {
      const saved = window.localStorage.getItem("map-filters");
      if (!saved) return DEFAULT_FILTERS;
      return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("map-filters", JSON.stringify(filters));
  }, [filters]);
  const [selected] = useState<Pharmacy | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelSlot(document.getElementById("map-sidebar-panel-slot"));
  }, []);

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
        <FilterSidebar districts={SEOUL_DISTRICTS} filters={filters} onChange={setFilters} />
      )}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <MapView
          pharmacies={pharmacies}
          districtStats={districtStats}
          detailOpen={panelOpen}
          gapFillStep={filters.gapFillStep}
          focusSgg={filters.sgg === "all" ? null : filters.sgg}
          visibleAccidentTypes={filters.types}
          showChildZones={filters.showChildZones}
          showElderlyZones={filters.showElderlyZones}
          showBikeRoads={filters.showBikeRoads}
        />
      </div>

      {panelSlot && createPortal(panel, panelSlot)}

      <DetailPanel
        pharmacy={selected}
        open={panelOpen}
        onOpenChange={(open) => {
          setPanelOpen(open);
        }}
      />
    </div>
  );
}
