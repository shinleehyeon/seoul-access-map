"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  DEFAULT_SEVERITY_FILTER,
  DEFAULT_TYPES,
  DEFAULT_YEAR_RANGE,
  FilterSidebar,
  type FilterState,
} from "@/components/sidebar/FilterSidebar";

const SEOUL_DISTRICTS = [
  "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구",
  "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구",
  "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구",
  "강동구",
].sort((a, b) => a.localeCompare(b, "ko"));

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/30 flex h-full items-center justify-center">
      <span className="text-muted-foreground text-sm">지도를 불러오는 중...</span>
    </div>
  ),
});

const DEFAULT_FILTERS: FilterState = {
  types: { ...DEFAULT_TYPES },
  showChildZones: false,
  showElderlyZones: false,
  showBikeRoads: false,
  sgg: "all",
  choroplethMetric: "none",
  yearRange: DEFAULT_YEAR_RANGE,
  severities: { ...DEFAULT_SEVERITY_FILTER },
};

export function Dashboard() {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    try {
      const saved = window.localStorage.getItem("map-filters");
      if (!saved) return DEFAULT_FILTERS;
      const parsed = JSON.parse(saved) as Partial<FilterState> & { gapFillStep?: number };
      // 예전 위험점수 단계 색칠 키 제거
      const { gapFillStep: _legacy, ...rest } = parsed;
      // 어린이·노인 UI는 숨기므로 저장된 값이 있어도 꺼 둔다 (코드/상태는 유지)
      return {
        ...DEFAULT_FILTERS,
        ...rest,
        types: {
          ...DEFAULT_TYPES,
          ...rest.types,
          elderly: false,
          child: false,
          bike: rest.types?.bike ?? DEFAULT_TYPES.bike,
        },
        showChildZones: false,
        showElderlyZones: false,
      };
    } catch {
      return DEFAULT_FILTERS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem("map-filters", JSON.stringify(filters));
  }, [filters]);

  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelSlot(document.getElementById("map-sidebar-panel-slot"));
  }, []);

  const panel = <FilterSidebar districts={SEOUL_DISTRICTS} filters={filters} onChange={setFilters} />;

  const searchParams = useSearchParams();
  const bsgg = searchParams.get("bsgg");
  const bsggs = searchParams.get("bsggs");
  const broad = searchParams.get("broad");
  const focusBlackspot =
    broad && (bsgg || bsggs)
      ? {
          road: broad,
          sgg: bsgg,
          sggs: bsggs?.split(",").map((s) => s.trim()).filter(Boolean),
        }
      : null;

  return (
    <div className="relative flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <MapView
          choroplethMetric={filters.choroplethMetric}
          focusSgg={filters.sgg === "all" ? null : filters.sgg}
          visibleAccidentTypes={filters.types}
          showChildZones={filters.showChildZones}
          showElderlyZones={filters.showElderlyZones}
          showBikeRoads={filters.showBikeRoads}
          bikeAccidentYearRange={filters.yearRange}
          visibleSeverities={filters.severities}
          focusBlackspot={focusBlackspot}
        />
      </div>

      {panelSlot && createPortal(panel, panelSlot)}
    </div>
  );
}
