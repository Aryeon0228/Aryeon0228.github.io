"""Outline-normal baking for Max 2026; no Qt or eager pymxs dependency.

The shader contract from NormalSmoothing.ms is deliberately unchanged: a
static mesh snapshot, Max map channel 8, and (local normal + 1) / 2. Geometry
vertices are never welded and source nodes/stacks are never modified.
"""

from contextlib import contextmanager
import math
import threading


MAP_CHANNEL = 8


def _point(value):
    if hasattr(value, "x"):
        result = (float(value.x), float(value.y), float(value.z))
    else:
        result = tuple(float(component) for component in value)
    if len(result) != 3 or not all(math.isfinite(v) for v in result):
        raise ValueError("메시에 유효하지 않은 좌표가 있습니다.")
    return result


def _sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def _angle(pivot, a, b):
    first, second = _sub(a, pivot), _sub(b, pivot)
    divisor = math.sqrt(_dot(first, first) * _dot(second, second))
    if not divisor:
        return 0.0
    # Python uses radians. The common degrees/radians factor cancels when
    # normalizing the sum, preserving MAXScript's area * corner-angle result.
    return math.acos(max(-1.0, min(1.0, _dot(first, second) / divisor)))


def calculate_outline_normals(vertices, faces):
    """Return packed normals and diagnostics; triangle indices are ONE-based."""
    vertices = [_point(vertex) for vertex in vertices]
    if not vertices or not faces:
        raise ValueError("빈 메시입니다.")
    sums = [[0.0, 0.0, 0.0] for _ in vertices]
    skipped = 0
    for face in faces:
        indices = tuple(int(index) for index in face)
        if len(indices) != 3 or any(i < 1 or i > len(vertices) for i in indices):
            raise ValueError("메시에 유효하지 않은 삼각형이 있습니다.")
        points = [vertices[index - 1] for index in indices]
        first, second = _sub(points[1], points[0]), _sub(points[2], points[0])
        cross = (first[1] * second[2] - first[2] * second[1],
                 first[2] * second[0] - first[0] * second[2],
                 first[0] * second[1] - first[1] * second[0])
        double_area = math.sqrt(_dot(cross, cross))
        if not double_area:
            skipped += 1
            continue
        if not math.isfinite(double_area):
            raise ValueError("메시 좌표가 지원하는 숫자 범위를 벗어났습니다.")
        for corner, index in enumerate(indices):
            angle = _angle(points[corner], points[(corner + 1) % 3],
                           points[(corner + 2) % 3])
            # unitNormal * area == cross / 2, including area weighting.
            for axis in range(3):
                sums[index - 1][axis] += cross[axis] * 0.5 * angle
    if skipped == len(faces):
        raise ValueError("메시에 면적이 있는 삼각형이 없습니다.")
    packed, fallback = [], 0
    for normal in sums:
        length = math.sqrt(_dot(normal, normal))
        if not math.isfinite(length):
            raise ValueError("노멀 계산이 지원하는 숫자 범위를 벗어났습니다.")
        if length:
            normal = [component / length for component in normal]
        else:
            normal = (0.0, 0.0, 1.0)
            fallback += 1
        packed.append(tuple((component + 1.0) * 0.5 for component in normal))
    return {"packed": packed, "skipped_faces": skipped, "fallback_vertices": fallback}


@contextmanager
def _undoable(pymxs_module, label):
    """Propagate errors even though pymxs.undo rolls back AND suppresses them."""
    failure = None
    with pymxs_module.undo(True, label):
        try:
            yield
        except BaseException as exc:
            failure = exc
            raise  # Let Max undo the failed transaction.
    if failure is not None:
        raise failure


class _CleanupFailure(RuntimeError):
    """A failed snapshot could not be removed; the whole batch must roll back."""


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

    def _candidate(self, node):
        rt = self._runtime()
        try:
            return bool(rt.isValidNode(node)
                        and rt.superClassOf(node) == rt.GeometryClass
                        and rt.canConvertTo(node, rt.Editable_Mesh))
        except Exception:
            return False

    def status(self):
        selected = []
        try:
            selected = list(self._runtime().selection)
            eligible = sum(self._candidate(node) for node in selected)
            return {"selected": len(selected), "eligible": eligible,
                    "ready": eligible > 0,
                    "detail": (f"변환 가능한 오브젝트 {eligible}개 · 복사본에 Max 맵 채널 8 사용"
                               if eligible else "메시로 변환 가능한 지오메트리를 선택하세요.")}
        except Exception as exc:
            return {"selected": len(selected), "eligible": 0, "ready": False,
                    "detail": f"선택 항목을 읽을 수 없습니다: {exc}"}

    def _bake(self, source):
        rt = self._runtime()
        copy = None
        try:
            copy = rt.snapshot(source, name=rt.uniqueName(str(source.name) + "_OutlineNormals"))
            if not rt.isValidNode(copy):
                raise RuntimeError("메시 복사본을 만들 수 없습니다.")
            if rt.classOf(copy.baseObject) != rt.Editable_Mesh:
                rt.convertToMesh(copy)
            if rt.classOf(copy.baseObject) != rt.Editable_Mesh:
                raise RuntimeError("복사본이 Editable Mesh가 아닙니다.")
            # No node argument: reads object-local coordinates independently
            # of the current viewport coordinate system and object transform.
            mesh = copy.baseObject
            vertex_count = int(rt.meshop.getNumVerts(mesh))
            face_count = int(rt.meshop.getNumFaces(mesh))
            vertices = [_point(rt.meshop.getVert(mesh, i)) for i in range(1, vertex_count + 1)]
            faces = [tuple(int(v) for v in _point(rt.getFace(mesh, i)))
                     for i in range(1, face_count + 1)]
            result = calculate_outline_normals(vertices, faces)
            if rt.meshop.getNumMaps(mesh) <= MAP_CHANNEL:
                rt.meshop.setNumMaps(mesh, MAP_CHANNEL + 1, keep=True)
            rt.meshop.setMapSupport(mesh, MAP_CHANNEL, True)
            rt.meshop.setNumMapVerts(mesh, MAP_CHANNEL, vertex_count)
            rt.meshop.setNumMapFaces(mesh, MAP_CHANNEL, face_count)
            for index, packed in enumerate(result["packed"], 1):
                rt.meshop.setMapVert(mesh, MAP_CHANNEL, index, rt.Point3(*packed))
            for index, face in enumerate(faces, 1):
                rt.meshop.setMapFace(mesh, MAP_CHANNEL, index, rt.Point3(*face))
            rt.update(copy)
            return copy, result
        except BaseException:
            if copy is not None and rt.isValidNode(copy):
                try:
                    rt.delete(copy)
                except Exception as exc:
                    raise _CleanupFailure("실패한 복사본을 정리할 수 없습니다. 배치 변경을 되돌립니다.") from exc
            raise

    def run(self, options=None, emit=None):
        if threading.current_thread() is not threading.main_thread():
            raise RuntimeError("장면 도구는 3ds Max 메인 스레드에서 실행해야 합니다.")
        rt = self._runtime()
        sources = [node for node in list(rt.selection) if self._candidate(node)]
        if not sources:
            raise ValueError("메시로 변환 가능한 지오메트리를 선택하세요.")
        copies, details = [], []
        with _undoable(self._module(), "Bake Outline Normal Copies"):
            for index, source in enumerate(sources, 1):
                source_name = str(source.name) if rt.isValidNode(source) else "<삭제된 오브젝트>"
                if emit:
                    emit(f"베이크 {index}/{len(sources)}: {source_name}")
                try:
                    if not self._candidate(source):
                        raise RuntimeError("오브젝트를 더 이상 베이크할 수 없습니다.")
                    copy, result = self._bake(source)
                    copies.append(copy)
                    details.append(f"완료: {copy.name}")
                    if result["skipped_faces"]:
                        details.append(f"  건너뛴 면적 0인 면: {result['skipped_faces']}개")
                    if result["fallback_vertices"]:
                        details.append(f"  기본 노멀 적용: {result['fallback_vertices']}개")
                except _CleanupFailure:
                    raise
                except Exception as exc:
                    details.append(f"실패: {source_name}: {exc}")
            if copies:
                rt.select(rt.Array(*copies))
        rt.redrawViews()
        details.append("원본 유지 · 정적 복사본: _OutlineNormals · Max 맵 8 · (normal + 1) / 2")
        return {"summary": f"메시 복사본 {len(copies)}/{len(sources)}개 베이크 완료", "details": details}
