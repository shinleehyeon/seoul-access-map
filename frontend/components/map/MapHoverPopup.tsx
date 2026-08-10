"use client";

import { useRef, useState } from "react";
import { Popup, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roadviewUrl } from "@/lib/mapConstants";

type ZoneKind = "childZone" | "elderlyZone";

export type HoverTarget =
  | {
      kind: "accident";
      lon: number;
      lat: number;
      name: string;
      accidentType: string;
      accidentCount: number;
      casualties: number;
    }
  | {
      kind: ZoneKind;
      key: string;
      lon: number;
      lat: number;
      name: string;
      facilityType: string;
      cctv: boolean;
      cctvCount: number;
    }
  | {
      kind: "bikeRoad";
      key: string;
      lon: number;
      lat: number;
      name: string;
    };

const ZONE_LABEL: Record<ZoneKind, string> = {
  childZone: "어린이보호구역",
  elderlyZone: "노인장애인보호구역",
};

/** 지도 위 사고핀/보호구역/자전거도로 호버 상태를 관리한다. 마우스가 팝업 위에 있으면 닫히지 않는다. */
export function useMapHover() {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const popupLockRef = useRef(false);

  function clear() {
    if (popupLockRef.current) return;
    setHover(null);
  }

  function onMouseMove(e: MapLayerMouseEvent): "pointer" | "district" | null {
    const accidentFeat = e.features?.find((x) => x.layer.id === "accident-points");
    if (accidentFeat) {
      popupLockRef.current = false;
      const [lon, lat] = (accidentFeat.geometry as GeoJSON.Point).coordinates;
      setHover({
        kind: "accident",
        name: (accidentFeat.properties?.name as string) ?? "",
        accidentType: (accidentFeat.properties?.accidentType as string) ?? "",
        accidentCount: (accidentFeat.properties?.accidentCount as number) ?? 0,
        casualties: (accidentFeat.properties?.casualties as number) ?? 0,
        lon,
        lat,
      });
      return "pointer";
    }

    const zoneFeat = e.features?.find(
      (x) => x.layer.id === "child-zone-fill" || x.layer.id === "elderly-zone-fill"
    );
    if (zoneFeat) {
      const kind: ZoneKind = zoneFeat.layer.id === "child-zone-fill" ? "childZone" : "elderlyZone";
      const name = (zoneFeat.properties?.name as string) ?? "";
      const key = `${kind}:${zoneFeat.properties?.sgg ?? ""}:${name}`;
      setHover((prev) =>
        prev && "key" in prev && prev.key === key
          ? prev
          : {
              kind,
              key,
              name,
              facilityType: (zoneFeat.properties?.facilityType as string) ?? "",
              cctv: Number(zoneFeat.properties?.cctv) === 1,
              cctvCount: Number(zoneFeat.properties?.cctvCount) || 0,
              lon: e.lngLat.lng,
              lat: e.lngLat.lat,
            }
      );
      return "pointer";
    }

    const bikeRoadFeat = e.features?.find((x) => x.layer.id === "bike-road-line");
    if (bikeRoadFeat) {
      const name = (bikeRoadFeat.properties?.name as string) ?? "자전거전용도로";
      const key = `bikeRoad:${bikeRoadFeat.properties?.sgg ?? ""}:${name}`;
      setHover((prev) =>
        prev && "key" in prev && prev.key === key
          ? prev
          : { kind: "bikeRoad", key, name, lon: e.lngLat.lng, lat: e.lngLat.lat }
      );
      return "pointer";
    }

    clear();
    return e.features?.some((x) => x.layer.id === "districts-fill") ? "district" : null;
  }

  function onMouseLeave() {
    if (!popupLockRef.current) setHover(null);
  }

  return { hover, popupLockRef, onMouseMove, onMouseLeave };
}

export function MapHoverPopup({
  hover,
  popupLockRef,
  onClose,
}: {
  hover: HoverTarget;
  popupLockRef: React.MutableRefObject<boolean>;
  onClose: () => void;
}) {
  const lock = () => {
    popupLockRef.current = true;
  };
  const unlock = () => {
    popupLockRef.current = false;
    onClose();
  };

  return (
    <Popup
      longitude={hover.lon}
      latitude={hover.lat}
      anchor="bottom"
      offset={hover.kind === "accident" ? 10 : 8}
      closeButton={false}
      closeOnClick={false}
    >
      <div
        className={`p-2 text-xs ${hover.kind === "bikeRoad" ? "w-[200px]" : "w-[220px]"}`}
        onMouseEnter={lock}
        onMouseLeave={unlock}
      >
        <p className="font-semibold">{hover.name}</p>

        {hover.kind === "accident" && (
          <p className="text-muted-foreground mt-0.5">
            {hover.accidentType} · 사고 {hover.accidentCount}건 · 사상자 {hover.casualties}명
          </p>
        )}

        {(hover.kind === "childZone" || hover.kind === "elderlyZone") && (
          <>
            <p className="text-muted-foreground mt-0.5">
              {ZONE_LABEL[hover.kind]} · {hover.facilityType} · 도로 따라 300m
            </p>
            <p className="text-muted-foreground mt-0.5">
              CCTV {hover.cctv ? `설치 (${hover.cctvCount}대)` : "미설치"}
            </p>
          </>
        )}

        {hover.kind === "bikeRoad" && (
          <p className="text-muted-foreground mt-0.5">OSM 자전거전용도로</p>
        )}

        <Button asChild variant="outline" size="sm" className="mt-2 w-full">
          <a href={roadviewUrl(hover.lat, hover.lon)} target="_blank" rel="noopener noreferrer">
            로드뷰 보기
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </Popup>
  );
}
