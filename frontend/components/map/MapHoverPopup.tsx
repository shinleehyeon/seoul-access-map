"use client";

import { useRef, useState } from "react";
import { Popup, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import { ExternalLink, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roadviewUrl } from "@/lib/mapConstants";

type ZoneKind = "childZone" | "elderlyZone";

/** TAAS 원본 부가 컬럼 — '자세히 보기' 모달에서만 사용 */
export type AccidentDetail = {
  사고월: string;
  요일: string;
  주야구분: string;
  발생시각: string;
  법정동명: string;
  사고유형_대분류: string;
  사고유형_중분류: string;
  사고유형: string;
  법규위반: string;
  기상상태: string;
  도로형태: string;
};

export type HoverTarget =
  | {
      kind: "accident";
      lon: number;
      lat: number;
      name: string;
      accidentType: string;
      accidentCount: number;
      casualties: number;
      detail: AccidentDetail | null;
    }
  | {
      kind: ZoneKind;
      key: string;
      lon: number;
      lat: number;
      name: string;
      facilityType: string;
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

export type AccidentDetailData = {
  name: string;
  accidentType: string;
  casualties: number;
  detail: AccidentDetail;
};

/**
 * 지도 위 사고핀/보호구역/자전거도로 호버 상태를 관리한다. 마우스가 팝업 위에 있으면 닫히지 않는다.
 *
 * '자세히 보기' 모달은 별도의 detailAccident 상태로 관리한다 — hover는 마우스가
 * 마커에서 살짝만 벗어나도 null이 되어 MapHoverPopup 자체가 언마운트되므로,
 * 그 안에 모달 상태를 두면 클릭 도중 모달이 열리기도 전에 사라져버린다.
 */
export function useMapHover() {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [detailAccident, setDetailAccident] = useState<AccidentDetailData | null>(null);
  const popupLockRef = useRef(false);

  function clear() {
    if (popupLockRef.current) return;
    setHover(null);
  }

  function onMouseMove(e: MapLayerMouseEvent): "pointer" | "district" | null {
    const accidentFeat = e.features?.find(
      (x) => x.layer.id === "accident-points" || x.layer.id === "bike-unclustered-point"
    );
    if (accidentFeat) {
      popupLockRef.current = false;
      const [lon, lat] = (accidentFeat.geometry as GeoJSON.Point).coordinates;
      const rawDetail = accidentFeat.properties?.detail;
      const detail =
        typeof rawDetail === "string"
          ? (JSON.parse(rawDetail) as AccidentDetail)
          : ((rawDetail as AccidentDetail | undefined) ?? null);
      setHover({
        kind: "accident",
        name: (accidentFeat.properties?.name as string) ?? "",
        accidentType: (accidentFeat.properties?.accidentType as string) ?? "",
        accidentCount: (accidentFeat.properties?.accidentCount as number) ?? 0,
        casualties: (accidentFeat.properties?.casualties as number) ?? 0,
        detail,
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
    if (e.features?.some((x) => x.layer.id === "bike-cluster-circles")) return "pointer";
    return e.features?.some((x) => x.layer.id === "districts-fill") ? "district" : null;
  }

  function onMouseLeave() {
    if (!popupLockRef.current) setHover(null);
  }

  return {
    hover,
    popupLockRef,
    onMouseMove,
    onMouseLeave,
    detailAccident,
    openDetail: setDetailAccident,
    closeDetail: () => setDetailAccident(null),
  };
}

export function MapHoverPopup({
  hover,
  popupLockRef,
  onClose,
  onOpenDetail,
}: {
  hover: HoverTarget;
  popupLockRef: React.MutableRefObject<boolean>;
  onClose: () => void;
  onOpenDetail: (data: AccidentDetailData) => void;
}) {
  const lock = () => {
    popupLockRef.current = true;
  };
  const unlock = () => {
    popupLockRef.current = false;
    onClose();
  };
  const detail = hover.kind === "accident" ? hover.detail : null;

  return (
    <>
      <Popup
        longitude={hover.lon}
        latitude={hover.lat}
        anchor="bottom"
        offset={hover.kind === "accident" ? 10 : hover.kind === "bikeRoad" ? -10 : 8}
        maxWidth={hover.kind === "accident" ? "300px" : "240px"}
        closeButton={false}
        closeOnClick={false}
      >
        <div
          className={`p-2 text-xs ${
            hover.kind === "bikeRoad" ? "w-[200px]" : hover.kind === "accident" ? "w-[280px]" : "w-[220px]"
          }`}
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
            <p className="text-muted-foreground mt-0.5">
              {ZONE_LABEL[hover.kind]} · {hover.facilityType} · 도로 따라 300m
            </p>
          )}

          {hover.kind === "bikeRoad" && (
            <p className="text-muted-foreground mt-0.5">OSM 자전거전용도로</p>
          )}

          <div className="mt-2 flex gap-1.5">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={roadviewUrl(hover.lat, hover.lon)} target="_blank" rel="noopener noreferrer">
                로드뷰 보기
                <ExternalLink className="size-3.5" />
              </a>
            </Button>

            {hover.kind === "accident" && detail && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onOpenDetail({
                    name: hover.name,
                    accidentType: hover.accidentType,
                    casualties: hover.casualties,
                    detail,
                  });
                }}
              >
                자세히 보기
                <ListTree className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </Popup>
    </>
  );
}

/**
 * '자세히 보기' 모달. hover 상태와 무관하게 detailAccident 값으로만 열림/닫힘을 제어한다
 * (지도 위 어디에 렌더해도 동작하도록 MapView에서 hover 팝업과 별개로 렌더링).
 */
export function AccidentDetailDialog({
  detailAccident,
  onClose,
}: {
  detailAccident: AccidentDetailData | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={detailAccident != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-lg" overlayClassName="bg-black/50">
        {detailAccident && (
          <>
            <DialogHeader>
              <DialogTitle>{detailAccident.name}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground -mt-2 text-sm">
              {detailAccident.accidentType} · 사상자 {detailAccident.casualties}명
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {(
                [
                  ["사고월", detailAccident.detail.사고월],
                  ["요일", detailAccident.detail.요일],
                  ["주야구분", detailAccident.detail.주야구분],
                  ["발생시각", detailAccident.detail.발생시각],
                  ["법정동", detailAccident.detail.법정동명],
                  ["도로형태", detailAccident.detail.도로형태],
                  ["사고유형(대)", detailAccident.detail.사고유형_대분류],
                  ["사고유형(중)", detailAccident.detail.사고유형_중분류],
                  ["사고유형", detailAccident.detail.사고유형],
                  ["법규위반", detailAccident.detail.법규위반],
                  ["기상상태", detailAccident.detail.기상상태],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
