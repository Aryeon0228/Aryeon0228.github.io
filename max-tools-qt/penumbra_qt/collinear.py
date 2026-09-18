"""Safe, main-thread Editable Poly cleanup ported from RemoveCollinearVerts.ms.

Pure planning can be tested without Max. Runtime validation still requires
3ds Max 2026; this module neither imports Qt nor pumps GUI events.
"""

from contextlib import contextmanager
import math
import threading


def _point(value):
    point = ((float(value.x), float(value.y), float(value.z)) if hasattr(value, "x")
             else tuple(float(component) for component in value))
    if len(point) != 3 or not all(math.isfinite(v) for v in point):
        raise ValueError("메시에 유효하지 않은 월드 좌표가 있습니다.")
    return point


def _threshold(value):
    value = float(value)
    if not math.isfinite(value) or value <= 0:
        raise ValueError("허용 거리는 유한한 양수여야 합니다. 단위는 월드 단위입니다.")
    return value


def _inside_segment_distance(pivot, first, second):
    segment = tuple(b - a for a, b in zip(first, second))
    segment_sq = sum(value * value for value in segment)
    if segment_sq <= 0:
        return None
    fraction = sum((v - a) * delta for v, a, delta in zip(pivot, first, segment)) / segment_sq
    if not 0.0 < fraction < 1.0:
        return None
    return math.sqrt(sum((v - (a + delta * fraction)) ** 2
                         for v, a, delta in zip(pivot, first, segment)))


def find_collinear_vertices(positions, edges, faces, threshold=0.001):
    """Plan removals using live topology and ONE-based integer-keyed mappings.

    Positions must already be in world space. Dead vertices/edges/faces must
    be omitted by the adapter. The increasing-index greedy face budget is
    the same as the native tool: every affected face retains at least 3 verts.
    """
    threshold = _threshold(threshold)
    positions = {index: _point(point) for index, point in positions.items()}
    adjacent = {index: [] for index in positions}
    incident_faces = {index: set() for index in positions}
    for edge in edges.values():
        if len(edge) != 2 or any(index not in positions for index in edge):
            raise ValueError("메시의 활성 에지 연결 정보가 유효하지 않습니다.")
        a, b = edge
        adjacent[a].append(b)
        adjacent[b].append(a)
    remaining = {}
    for face_id, vertices in faces.items():
        if any(index not in positions for index in vertices):
            raise ValueError("메시의 활성 면 연결 정보가 유효하지 않습니다.")
        # Repeated corners do not count as distinct surviving vertices.
        remaining[face_id] = len(set(vertices))
        for index in vertices:
            incident_faces[index].add(face_id)
    result = []
    for index in sorted(positions):
        neighbors = adjacent[index]
        if len(neighbors) != 2 or neighbors[0] == neighbors[1] or index in neighbors:
            continue
        distance = _inside_segment_distance(positions[index], positions[neighbors[0]],
                                            positions[neighbors[1]])
        if distance is None or not distance < threshold:
            continue
        used_faces = incident_faces[index]
        if not used_faces or any(remaining[face] <= 3 for face in used_faces):
            continue
        result.append(index)
        for face in used_faces:
            remaining[face] -= 1
    return result


@contextmanager
def _undoable(pymxs_module, label):
    failure = None
    with pymxs_module.undo(True, label):
        try:
            yield
        except BaseException as exc:
            failure = exc
            raise
    # pymxs.undo rolls back and suppresses the exception; do not report success.
    if failure is not None:
        raise failure


class Backend:
    def __init__(self, runtime=None, pymxs_module=None):
        self._rt = runtime
        self._pymxs = pymxs_module

    def _runtime(self):
        if self._rt is None:
            self._rt = self._module().runtime
        return self._rt

    def _module(self):
        if self._pymxs is None:
            import pymxs
            self._pymxs = pymxs
        return self._pymxs

    def _targets(self, selected):
        rt = self._runtime()
        targets, seen = [], []
        for node in selected:
            if not rt.isValidNode(node) or not rt.isKindOf(node, rt.Editable_Poly):
                continue
            base = node.baseObject
            # pymxs wrappers need equality, not Python identity comparisons.
            if base in seen:
                continue
            seen.append(base)
            if len(node.modifiers):
                continue
            dependents = list(rt.refs.dependentNodes(base))
            if any(dependent not in selected or len(dependent.modifiers)
                   for dependent in dependents):
                continue
            targets.append(node)
        return targets

    def status(self):
        selected = []
        try:
            selected = list(self._runtime().selection)
            targets = self._targets(selected)
            preview_ready = len(selected) == 1 and len(targets) == 1
            return {"selected": len(selected), "eligible": len(targets), "ready": bool(targets),
                    "detail": (f"적용 가능한 기본 오브젝트 {len(targets)}개 · 수정자 없음 · 공유 인스턴스 전체 선택 필요"),
                    "preview_ready": preview_ready,
                    "preview_detail": ("미리보기는 후보 정점만 선택합니다." if preview_ready
                                       else "미리보기는 적용 가능한 Editable Poly 1개를 선택해야 합니다.")}
        except Exception as exc:
            return {"selected": len(selected), "eligible": 0, "ready": False,
                    "detail": f"선택 항목을 읽을 수 없습니다: {exc}", "preview_ready": False,
                    "preview_detail": "미리보기를 사용할 수 없습니다."}

    def _plan(self, node, threshold):
        rt = self._runtime()
        poly = rt.polyop
        base = node.baseObject
        transform = node.objectTransform
        # Local base-object positions * objectTransform include scaling,
        # parent transforms and object offsets, regardless of active coordsys.
        positions = {i: _point(poly.getVert(base, i) * transform)
                     for i in range(1, int(poly.getNumVerts(base)) + 1)
                     if not poly.isVertDead(base, i)}
        edges = {i: tuple(int(v) for v in poly.getEdgeVerts(base, i))
                 for i in range(1, int(poly.getNumEdges(base)) + 1)
                 if not poly.isEdgeDead(base, i)}
        faces = {i: tuple(int(v) for v in poly.getFaceVerts(base, i))
                 for i in range(1, int(poly.getNumFaces(base)) + 1)
                 if not poly.isFaceDead(base, i)}
        return find_collinear_vertices(positions, edges, faces, threshold)

    def _live_count(self, node):
        poly = self._runtime().polyop
        return int(poly.getNumVerts(node)) - int(poly.getDeadVerts(node).numberSet)

    def run(self, options=None, emit=None):
        if threading.current_thread() is not threading.main_thread():
            raise RuntimeError("장면 도구는 3ds Max 메인 스레드에서 실행해야 합니다.")
        options = options or {}
        threshold = _threshold(options.get("threshold", 0.001))
        preview = bool(options.get("preview", False))
        rt = self._runtime()
        selected = list(rt.selection)
        targets = self._targets(selected)
        if not targets:
            raise ValueError("수정자가 없는 Editable Poly와 지오메트리를 공유하는 모든 인스턴스를 선택하세요.")
        if preview and (len(selected) != 1 or len(targets) != 1):
            raise ValueError("미리보기는 적용 가능한 Editable Poly 1개를 선택해야 합니다.")
        plans = []
        # Complete ALL topology reads before any selection or geometry writes.
        for index, node in enumerate(targets, 1):
            if emit:
                emit(f"검사 {index}/{len(targets)}: {node.name}")
            plans.append(self._plan(node, threshold))
        # A progress callback must never allow an unsafe target to slip through.
        current = list(rt.selection)
        current_targets = self._targets(current)
        if current != selected or current_targets != targets:
            raise RuntimeError("선택 또는 적용 조건이 변경되었습니다. 다시 실행하세요.")
        label = "Preview Collinear Verts" if preview else "Remove Collinear Verts"
        removed, details = 0, []
        with _undoable(self._module(), label):
            for node, vertices in zip(targets, plans):
                if preview:
                    rt.polyop.setVertSelection(node, rt.BitArray(*vertices))
                    details.append(f"{node.name}: 후보 정점 {len(vertices)}개 선택")
                elif vertices:
                    before = self._live_count(node)
                    rt.polyop.setVertSelection(node, rt.BitArray(*vertices))
                    # Remove preserves faces; deleteVerts would delete them.
                    # Explicit level ignores whichever subobject mode is active.
                    if not node.EditablePoly.Remove(selLevel=rt.Name("Vertex")):
                        raise RuntimeError(f"{node.name}: 정점 제거 실패. 배치 변경을 되돌립니다.")
                    count = before - self._live_count(node)
                    removed += count
                    details.append(f"{node.name}: 정점 {count}개 제거")
                else:
                    details.append(f"{node.name}: 제거할 정점 없음")
        if preview:
            # UI navigation is separate from the undoable selection change.
            try:
                rt.modPanel.setCurrentObject(targets[0].baseObject, node=targets[0], ui=True)
                rt.subObjectLevel = 1
            except Exception as exc:
                details.append(f"정점을 선택했습니다. Modify / Vertex에서 확인하세요. ({exc})")
        rt.redrawViews()
        details.append(f"허용 거리: {threshold:g} 월드 단위 · 기본 오브젝트 {len(targets)}개 처리")
        summary = (f"후보 정점 {len(plans[0])}개 선택 · 제거하지 않음" if preview
                   else f"일직선상 정점 {removed}개 제거")
        return {"summary": summary, "details": details}
