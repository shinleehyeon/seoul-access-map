"""
서울 전역 OSM 보행망에서 '확인된 하드배리어'를 표시하는 접근성 그래프를 만든다.

표고점 추정 경사는 사용하지 않는다.
  - highway=steps → barrier code 1
  - wheelchair=no → barrier code 2
  - 그 외 → 0 (미검증)

웹 전송을 위해 노드를 dense index로 재매핑한 compact JSON을 쓴다.
accessible(코드 0)는 "알려진 하드배리어 없음"이지, 휠체어 가능 확정이 아니다.
"""

import json
from pathlib import Path

import osmnx as ox

PLACE = "Seoul, South Korea"
OUT_PATH = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "access_graph.json"

BARRIER_CODE = {
    None: 0,
    "steps": 1,
    "wheelchair_no": 2,
}
CODE_NAME = {v: k for k, v in BARRIER_CODE.items()}


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


def classify_barrier(data: dict) -> str | None:
    highways = {str(h) for h in _as_list(data.get("highway"))}
    if "steps" in highways:
        return "steps"

    wheelchair_vals = {str(v).lower() for v in _as_list(data.get("wheelchair"))}
    if "no" in wheelchair_vals:
        return "wheelchair_no"

    return None


def build_walk_graph():
    print(f"{PLACE} 보행 도로망 다운로드 중 (OSM)...")
    G = ox.graph_from_place(PLACE, network_type="walk", simplify=True)
    print(f"  -> 노드 {G.number_of_nodes()}개, 엣지 {G.number_of_edges()}개")
    return G


def mark_barriers(G):
    print("하드배리어(계단/wheelchair=no) 태깅 중...")
    counts: dict[str, int] = {}
    for _u, _v, _k, data in G.edges(keys=True, data=True):
        barrier = classify_barrier(data)
        data["barrier"] = barrier
        data["accessible"] = barrier is None
        if barrier:
            counts[barrier] = counts.get(barrier, 0) + 1

    total = G.number_of_edges()
    blocked = sum(counts.values())
    print(f"  -> 전체 {total}개 중 하드배리어 {blocked}개 ({blocked / total:.1%})")
    for kind, n in sorted(counts.items()):
        print(f"     {kind}: {n}")
    return G


def export_graph(G):
    """
    Compact schema:
      nodes: [[lon, lat], ...]   # index = node id
      edges: [[u, v, length_m, barrier_code], ...]
    """
    print("compact JSON으로 내보내는 중...")
    osm_ids = list(G.nodes())
    id_map = {osm_id: i for i, osm_id in enumerate(osm_ids)}

    nodes = []
    for osm_id in osm_ids:
        data = G.nodes[osm_id]
        nodes.append([round(float(data["x"]), 5), round(float(data["y"]), 5)])

    edges = []
    barrier_count = 0
    seen = set()
    for u, v, data in G.edges(data=True):
        ui, vi = id_map[u], id_map[v]
        # undirected export: keep one direction to cut size; routing treats as bidirectional
        a, b = (ui, vi) if ui < vi else (vi, ui)
        key = (a, b)
        if key in seen:
            continue
        seen.add(key)
        code = BARRIER_CODE[data.get("barrier")]
        if code:
            barrier_count += 1
        edges.append([a, b, round(float(data.get("length") or 0), 1), code])

    payload = {
        "meta": {
            "place": PLACE,
            "method": "osm_hard_barrier",
            "format": "compact_v1",
            "note": "barrier 0=unverified, 1=steps, 2=wheelchair_no; accessible≠verified OK",
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "barrierCount": barrier_count,
            "barrierCodes": {str(k): v for k, v in CODE_NAME.items()},
        },
        "nodes": nodes,
        "edges": edges,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT_PATH.stat().st_size / 1e6
    print(
        f"완료 -> {OUT_PATH} "
        f"(노드 {len(nodes)}개, 엣지 {len(edges)}개, 장벽 {barrier_count}개, {size_mb:.1f}MB)"
    )


if __name__ == "__main__":
    G = build_walk_graph()
    G = mark_barriers(G)
    export_graph(G)
