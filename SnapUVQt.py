# -*- coding: utf-8 -*-
"""Snap UV Vertices — STUDIO PENUMBRA, Qt edition 0.1.

For 3ds Max 2026 (bundled Python + PySide6). Run the included SnapUVQt.ms.
No network, installation, or external Python packages are required in Max.
"""


# ======================================================================
# 1. Pure Python snap planning
# ======================================================================
"""Pure UV snap planning, with no dependency on Qt or 3ds Max.

The threshold is a radius in UV units, not pixels. Connections are transitive:
if A is near B and B is near C, all three share one average, even when A and C
are farther apart than the threshold. Planning never mutates its inputs.
"""

from dataclasses import dataclass
import math
from numbers import Real
from typing import Callable, Iterable, Optional, Tuple


Vertex = Tuple[int, float, float, float]


@dataclass(frozen=True)
class SnapPlan:
    groups: int
    updates: Tuple[Vertex, ...]
    vertex_count: int


def _finite_number(value, description):
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError("{} must be a finite number.".format(description))
    try:
        result = float(value)
    except (ValueError, OverflowError):
        raise ValueError("{} must be a finite number.".format(description))
    if not math.isfinite(result):
        raise ValueError("{} must be a finite number.".format(description))
    return result


def plan_snaps(
    vertices: Iterable[Vertex],
    threshold: float,
    checkpoint: Optional[Callable[[], None]] = None,
) -> SnapPlan:
    """Return connected UV groups and only their changed vertex positions.

    Each input is ``(positive_unique_id, u, v, w)``. Distance uses U and V;
    each vertex retains its own W. Updates have the same order as the input.
    Groups of two or more already-coincident vertices still count as groups.

    Invalid inputs raise ValueError before any plan is returned. If supplied,
    ``checkpoint()`` runs periodically; its exceptions propagate unchanged,
    allowing cancellation without a partial plan or any geometry mutation.

    Spatial cells have side threshold / 2. Their diameter is strictly less
    than threshold, so each occupied cell is connected. Only its 24 adjacent
    candidates need testing. A connected cell pair requires just one matching
    vertex pair; already-connected cells can be skipped entirely. This avoids
    an all-vertices pairwise scan, including for densely stacked UVs.
    """
    threshold = _finite_number(threshold, "Threshold")
    if threshold <= 0:
        raise ValueError("Threshold must be greater than zero.")
    if checkpoint is not None and not callable(checkpoint):
        raise ValueError("Checkpoint must be callable or None.")

    operations = 0

    def pulse():
        nonlocal operations
        operations += 1
        if checkpoint is not None and operations % 1024 == 0:
            checkpoint()

    if checkpoint is not None:
        checkpoint()
    data = []
    identifiers = set()
    try:
        iterator = iter(vertices)
    except TypeError:
        raise ValueError("Vertices must be an iterable of (id, u, v, w).")
    for vertex in iterator:
        pulse()
        try:
            identifier, u, v, w = vertex
        except (TypeError, ValueError):
            raise ValueError("Each vertex must contain exactly (id, u, v, w).")
        if isinstance(identifier, bool) or not isinstance(identifier, int) or identifier <= 0:
            raise ValueError("UV vertex IDs must be positive integers.")
        if identifier in identifiers:
            raise ValueError("UV vertex IDs must be unique.")
        identifiers.add(identifier)
        data.append((identifier, _finite_number(u, "U"), _finite_number(v, "V"),
                     _finite_number(w, "W")))

    count = len(data)
    parents = list(range(count))
    sizes = [1] * count

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(first, second):
        first, second = find(first), find(second)
        if first == second:
            return
        if sizes[first] < sizes[second]:
            first, second = second, first
        parents[second] = first
        sizes[first] += sizes[second]

    # Integer ratios make cell assignment exact even at negative boundaries,
    # and avoid overflow/underflow when coordinates and thresholds differ in
    # magnitude. No floating-point threshold / 2 need be representable.
    threshold_numerator, threshold_denominator = threshold.as_integer_ratio()

    def cell_coordinate(value):
        numerator, denominator = value.as_integer_ratio()
        return (2 * numerator * threshold_denominator) // (denominator * threshold_numerator)

    cells = {}
    for index, (_, u, v, _) in enumerate(data):
        pulse()
        key = (cell_coordinate(u), cell_coordinate(v))
        members = cells.setdefault(key, [])
        if members:
            union(members[0], index)
        members.append(index)

    # Visit each neighboring pair once, in deterministic insertion order.
    offsets = [(0, 1), (0, 2)] + [(x, y) for x in (1, 2) for y in range(-2, 3)]
    for (cell_u, cell_v), members in cells.items():
        for offset_u, offset_v in offsets:
            pulse()
            neighbors = cells.get((cell_u + offset_u, cell_v + offset_v))
            if not neighbors or find(members[0]) == find(neighbors[0]):
                continue
            connected = False
            for first in members:
                first_vertex = data[first]
                for second in neighbors:
                    pulse()
                    second_vertex = data[second]
                    if math.hypot(first_vertex[1] - second_vertex[1],
                                  first_vertex[2] - second_vertex[2]) < threshold:
                        union(first, second)
                        connected = True
                        break
                if connected:
                    break

    components = {}
    for index in range(count):
        pulse()
        components.setdefault(find(index), []).append(index)

    targets = [None] * count
    groups = 0

    def mean(members, axis):
        first_value = data[members[0]][axis]
        if all(data[index][axis] == first_value for index in members):
            # Do not introduce a rounding movement on an already-aligned axis.
            return first_value
        try:
            return math.fsum(data[index][axis] for index in members) / len(members)
        except OverflowError:
            # A finite mean may exist even when summing large finite inputs
            # overflows. Dividing first keeps this fallback representable.
            return math.fsum(data[index][axis] / len(members) for index in members)

    for members in components.values():
        pulse()
        if len(members) < 2:
            continue
        groups += 1
        average_u, average_v = mean(members, 1), mean(members, 2)
        for index in members:
            pulse()
            identifier, u, v, w = data[index]
            if average_u != u or average_v != v:
                targets[index] = (identifier, average_u, average_v, w)

    updates = []
    for target in targets:
        pulse()
        if target is not None:
            updates.append(target)
    if checkpoint is not None:
        checkpoint()
    return SnapPlan(groups=groups, updates=tuple(updates), vertex_count=count)


# ======================================================================
# 2. 3ds Max scene adapter
# ======================================================================
"""3ds Max 2026 adapter for Penumbra Snap UV; no Qt dependencies.

Only apply() writes scene data. Call on Max's main thread. Read snapshots again
when Snap is clicked, rather than executing an old preview. API signatures were
checked against Autodesk docs; this module has not run inside 3ds Max here.
"""

from dataclasses import dataclass, field
import math
from typing import Any, Tuple


class TargetError(RuntimeError):
    """Actionable target, stale-data, or transaction error for the UI."""


@dataclass(frozen=True)
class TargetStatus:
    node: Any = field(repr=False)
    modifier: Any = field(repr=False)
    node_name: str
    modifier_name: str
    total_vertices: int
    selected_vertices: int
    time: Any
    selected_ids: Tuple[int, ...] = field(repr=False)
    active_object: Any = field(repr=False)


@dataclass(frozen=True)
class UVSnapshot:
    status: TargetStatus
    selected_only: bool
    # MAXScript vertex IDs stay 1-based; Python tuples are ordinary 0-based data.
    vertices: Tuple[Tuple[int, float, float, float], ...]


class MaxBackend:
    """Runtime is imported lazily, so the UI can also load in standalone demo mode."""

    def __init__(self, runtime=None, pymxs_module=None):
        if runtime is None or pymxs_module is None:
            import pymxs
            runtime = pymxs.runtime if runtime is None else runtime
            pymxs_module = pymxs if pymxs_module is None else pymxs_module
        self.rt = runtime
        self.pymxs = pymxs_module
        # A fixed MAXScript function performs the documented `as Array`
        # conversion. No object names, paths, or user input enter this code.
        self._selected_array = self.rt.execute(
            "(fn penumbraSnapUvBitsToArray bits = (bits as Array))"
        )

    def read_status(self):
        """Return the one selected node and its unambiguous Unwrap UVW target."""
        try:
            nodes = list(self.rt.selection)
            if not nodes:
                raise TargetError("Unwrap UVW가 있는 오브젝트 하나를 선택해 주세요.")
            if len(nodes) != 1:
                raise TargetError("씬에서 오브젝트 하나만 선택해 주세요. 여러 오브젝트는 한 번에 처리하지 않아요.")
            node = nodes[0]
            if not self.rt.isValidNode(node):
                raise TargetError("선택한 오브젝트가 더 이상 유효하지 않아요. 다시 선택해 주세요.")
            modifiers = [
                mod for mod in node.modifiers
                if self.rt.classOf(mod) == self.rt.Unwrap_UVW
            ]
            if not modifiers:
                raise TargetError("선택한 오브젝트에 Unwrap UVW 모디파이어가 없어요.")
            active = self.rt.modPanel.getCurrentObject()
            # Distinct pymxs wrappers can refer to the same Max object: use ==.
            modifier = next((mod for mod in modifiers if mod == active), None)
            if modifier is None:
                if len(modifiers) != 1:
                    raise TargetError("Unwrap UVW가 여러 개예요. 스택에서 작업할 Unwrap UVW를 선택해 주세요.")
                modifier = modifiers[0]
            total = int(modifier.numberVerticesByNode(node))
            bit_selection = modifier.getSelectedVerticesByNode(node)
            ids = tuple(
                int(index) for index in self._selected_array(bit_selection)
                if 1 <= int(index) <= total
            )
            return TargetStatus(
                node=node, modifier=modifier, node_name=str(node.name),
                modifier_name=str(modifier.name), total_vertices=total,
                selected_vertices=len(ids), time=self.rt.currentTime,
                selected_ids=ids, active_object=active,
            )
        except TargetError:
            raise
        except Exception as error:
            raise TargetError(
                "UV 정보를 읽지 못했어요. Modify 패널에서 해당 Unwrap UVW를 "
                "선택한 뒤 다시 시도해 주세요.\n\n" + str(error)
            ) from error

    def read_vertices(self, selected_only=True):
        """Capture coordinates at the current time without altering selection."""
        status = self.read_status()
        indices = status.selected_ids if selected_only else range(1, status.total_vertices + 1)
        try:
            vertices = tuple(self._read_vertex(status, index) for index in indices)
        except Exception as error:
            if isinstance(error, TargetError):
                raise
            raise TargetError("UV 정점 위치를 읽지 못했어요.\n\n" + str(error)) from error
        return UVSnapshot(status, bool(selected_only), vertices)

    def _read_vertex(self, status, index):
        position = status.modifier.getVertexPositionByNode(status.time, index, status.node)
        values = (float(position.x), float(position.y), float(position.z))
        if not all(math.isfinite(value) for value in values):
            raise TargetError("UV 정점 {}에 유효하지 않은 좌표가 있어요.".format(index))
        return (index,) + values

    def _validate_snapshot(self, snapshot):
        """Fail before writes if user selection, time, stack, or UV data changed."""
        before = snapshot.status
        now = self.read_status()
        if (now.node != before.node or now.modifier != before.modifier
                or now.active_object != before.active_object
                or now.time != before.time
                or now.total_vertices != before.total_vertices
                or (snapshot.selected_only and now.selected_ids != before.selected_ids)):
            raise TargetError("대상이나 UV 선택 상태가 바뀌었어요. 다시 실행해 주세요.")
        for vertex in snapshot.vertices:
            if self._read_vertex(now, vertex[0]) != vertex:
                raise TargetError("계산 중 UV 좌표가 바뀌었어요. 다시 실행해 주세요.")

    def apply(self, snapshot, updates):
        """Apply (id, u, v, w) updates as one undo item; always preserve old W.

        Returns the actual number of changed vertices. All coordinates are
        validated and converted to Point3 before opening the undo transaction.
        pymxs.undo rolls back AND suppresses exceptions, so capture and re-raise
        afterward. Never call run_undo() here: it might undo the user's prior edit.
        """
        original = {vertex[0]: vertex[1:] for vertex in snapshot.vertices}
        writes = []
        seen = set()
        for update in updates:
            if len(update) != 4:
                raise TargetError("내부 오류: 스냅 좌표는 (정점 ID, U, V, W)여야 해요.")
            index, u, v, _unused_w = update
            if isinstance(index, bool) or not isinstance(index, int) or index not in original or index in seen:
                raise TargetError("내부 오류: 중복되거나 잘못된 UV 정점 ID예요.")
            seen.add(index)
            u, v = float(u), float(v)
            if not (math.isfinite(u) and math.isfinite(v)):
                raise TargetError("내부 오류: 스냅 위치에 유효하지 않은 값이 있어요.")
            old_u, old_v, old_w = original[index]
            # Max's Point3 uses native floats. Skip changes lost to that rounding.
            point = self.rt.Point3(u, v, old_w)
            if (float(point.x), float(point.y), float(point.z)) != (old_u, old_v, old_w):
                writes.append((index, point))
        self._validate_snapshot(snapshot)
        if not writes:
            return 0
        status = snapshot.status
        failure = None
        completed = False
        try:
            with self.pymxs.undo(True, "Penumbra Snap UV"):
                try:
                    for index, point in writes:
                        status.modifier.setVertexPosition2ByNode(
                            status.time, index, point, True, True, status.node
                        )
                    completed = True
                except BaseException as error:
                    failure = error
                    raise  # pymxs sees this exception and rolls the transaction back.
        except BaseException as error:
            # Also catches failure to enter/leave the host transaction itself.
            if failure is None:
                failure = error
        if failure is not None or not completed:
            detail = str(failure) if failure is not None else "Undo transaction did not complete."
            raise TargetError(
                "스냅을 완료하지 못해 Undo 트랜잭션을 중단했어요. "
                "UV 상태를 확인해 주세요.\n\n" + detail
            ) from failure
        self.rt.redrawViews()
        return len(writes)


# ======================================================================
# 3. PySide6 interface
# ======================================================================
"""Qt UI layer, assembled with the pure planner and Max adapter for release."""
import traceback

from PySide6 import QtCore, QtGui, QtWidgets
import shiboken6


class SnapCancelled(Exception):
    pass


class ElidedLabel(QtWidgets.QLabel):
    """Keep long object names on one line, with the full name in a tooltip."""

    def __init__(self, text=""):
        super().__init__()
        self._full_text = ""
        self.setTextFormat(QtCore.Qt.TextFormat.PlainText)
        self.setSizePolicy(QtWidgets.QSizePolicy.Policy.Ignored, QtWidgets.QSizePolicy.Policy.Preferred)
        self.setText(text)

    def setText(self, text):
        self._full_text = str(text)
        self.setToolTip(self._full_text)
        self._sync_text()

    def _sync_text(self):
        QtWidgets.QLabel.setText(self, self.fontMetrics().elidedText(
            self._full_text, QtCore.Qt.TextElideMode.ElideRight, max(1, self.contentsRect().width())))

    def resizeEvent(self, event):
        super().resizeEvent(event)
        self._sync_text()


class SnapUVDialog(QtWidgets.QDialog):
    """A modeless Max tool. Only the injected backend can touch the scene."""

    def __init__(self, backend, parent=None):
        super().__init__(parent)
        self.backend = backend
        self._busy = False
        self._signature = None
        self._progress = None
        self._last_error = ""
        self.setObjectName("PenumbraSnapUV")
        self.setWindowTitle("Snap UV Vertices · Penumbra")
        self.setWindowFlag(QtCore.Qt.WindowType.Tool, True)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.setMinimumSize(420, 540)
        self.resize(460, 700)
        self.setStyleSheet("""
            QDialog#PenumbraSnapUV { background: #17181a; color: #eeeeef; }
            QWidget { color: #eeeeef; font-size: 12px; }
            QScrollArea, QWidget#body { background: transparent; border: none; }
            QProgressDialog { background: #202226; }
            QLabel { background: transparent; border: none; }
            QLabel#eyebrow { color: #93969c; font-size: 10px; letter-spacing: 2px; }
            QLabel#heading { font-size: 25px; font-weight: 600; }
            QLabel#muted { color: #a1a4aa; }
            QLabel#sectionTitle { color: #9c9fa5; font-size: 11px; }
            QLabel#metric { font-size: 23px; font-weight: 500; }
            QLabel#brand { color: #81858b; font-size: 9px; letter-spacing: 1.5px; }
            QFrame#card { background: #202226; border: 1px solid #34363b; border-radius: 8px; }
            QDoubleSpinBox { background: #151619; border: 1px solid #4c4f56;
                border-radius: 5px; padding: 7px 10px; min-height: 20px; }
            QDoubleSpinBox:focus { border-color: #b8bac0; }
            QCheckBox { spacing: 10px; }
            QCheckBox::indicator { width: 15px; height: 15px; }
            QPushButton { background: #2a2c31; border: 1px solid #45484f;
                border-radius: 5px; padding: 9px 14px; }
            QPushButton:hover { background: #373a40; border-color: #858991; }
            QPushButton:pressed { background: #1b1d21; }
            QPushButton#primary { background: #e8e8e7; color: #17181a; border-color: #e8e8e7; font-weight: 600; }
            QPushButton#primary:hover { background: #ffffff; border-color: #ffffff; }
            QPushButton#primary:pressed { background: #c8c9cc; }
            QPushButton:disabled, QPushButton#primary:disabled { background: #292b2f; color: #6f737b; border-color: #34363b; }
            QPushButton#quiet { padding: 4px 7px; background: transparent; border: 1px solid transparent; color: #a1a4aa; }
            QPushButton#quiet:hover { color: #ffffff; border-color: #45484f; }
            QPlainTextEdit { background: #111214; color: #bfc2c8; border: 1px solid #383b41; border-radius: 4px; padding: 8px; }
            QScrollBar:vertical { width: 8px; background: transparent; }
            QScrollBar::handle:vertical { background: #4b4e55; border-radius: 4px; min-height: 24px; }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical { background: transparent; }
        """)
        self._build_ui()
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(500)
        self.timer.timeout.connect(self.refresh_target)
        self.refresh_target()
        self.timer.start()

    def _label(self, text="", role="", wrap=False):
        label = QtWidgets.QLabel(text)
        label.setTextFormat(QtCore.Qt.TextFormat.PlainText)
        label.setObjectName(role)
        label.setWordWrap(wrap)
        policy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Policy.Ignored, QtWidgets.QSizePolicy.Policy.Preferred)
        policy.setHeightForWidth(wrap)
        label.setSizePolicy(policy)
        return label

    def _card(self, title):
        frame = QtWidgets.QFrame()
        frame.setObjectName("card")
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(10)
        layout.addWidget(self._label(title, "sectionTitle"))
        return frame, layout

    def _build_ui(self):
        outer = QtWidgets.QVBoxLayout(self)
        outer.setContentsMargins(22, 22, 22, 16)
        outer.setSpacing(12)
        outer.addWidget(self._label("UV TOOLS / 01", "eyebrow"))
        outer.addWidget(self._label("Snap UV Vertices", "heading"))
        outer.addWidget(self._label("가까운 UV 정점을 같은 위치로 정렬합니다.", "muted", True))

        scroll = QtWidgets.QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        body = QtWidgets.QWidget()
        body.setObjectName("body")
        content = QtWidgets.QVBoxLayout(body)
        content.setContentsMargins(0, 4, 2, 4)
        content.setSpacing(12)
        scroll.setWidget(body)
        outer.addWidget(scroll, 1)

        target, layout = self._card("작업 대상")
        self.target_name = ElidedLabel("오브젝트를 선택하세요.")
        self.modifier_name = self._label("Unwrap UVW", "muted", True)
        layout.addWidget(self.target_name)
        layout.addWidget(self.modifier_name)
        metrics = QtWidgets.QHBoxLayout()
        self.total_value, self.selected_value = self._label("—", "metric"), self._label("—", "metric")
        for title, value in (("전체 UV 정점", self.total_value), ("선택된 정점", self.selected_value)):
            col = QtWidgets.QVBoxLayout()
            col.setSpacing(4)
            col.addWidget(self._label(title, "muted"))
            col.addWidget(value)
            metrics.addLayout(col, 1)
        layout.addLayout(metrics)
        self.target_hint = self._label("", "muted", True)
        layout.addWidget(self.target_hint)
        content.addWidget(target)

        settings, layout = self._card("스냅 설정")
        field = QtWidgets.QHBoxLayout()
        field.addWidget(self._label("근접 거리 · UV"), 1)
        self.threshold = QtWidgets.QDoubleSpinBox()
        self.threshold.setDecimals(5)
        self.threshold.setRange(0.00001, 1.0)
        self.threshold.setSingleStep(0.0001)
        self.threshold.setValue(0.005)
        self.threshold.setKeyboardTracking(False)
        self.threshold.setAlignment(QtCore.Qt.AlignmentFlag.AlignRight)
        self.threshold.setMinimumWidth(138)
        self.threshold.setAccessibleName("근접 거리, UV 단위")
        field.addWidget(self.threshold)
        layout.addLayout(field)
        self.selected_only = QtWidgets.QCheckBox("선택한 정점만 정렬")
        self.selected_only.setChecked(True)
        layout.addWidget(self.selected_only)
        layout.addWidget(self._label("UV 타일 한 변이 1입니다. 거리로 이어진 정점은 한 그룹으로 모입니다.", "muted", True))
        content.addWidget(settings)

        result, layout = self._card("결과")
        self.result_text = self._label("미리보기로 그룹과 이동할 정점 수를 확인하세요.", wrap=True)
        layout.addWidget(self.result_text)
        layout.addWidget(self._label("위치만 정렬합니다. 정점을 합치는 Weld는 하지 않습니다.", "muted", True))
        content.addWidget(result)
        self.details = QtWidgets.QPlainTextEdit()
        self.details.setReadOnly(True)
        self.details.setMinimumHeight(100)
        self.details.setMaximumHeight(160)
        self.details.setVisible(False)
        content.addWidget(self.details)
        content.addStretch(1)

        buttons = QtWidgets.QHBoxLayout()
        buttons.setSpacing(10)
        self.preview_button = QtWidgets.QPushButton("미리보기")
        self.apply_button = QtWidgets.QPushButton("평균 위치로 정렬")
        self.apply_button.setObjectName("primary")
        for button in (self.preview_button, self.apply_button):
            button.setMinimumHeight(40)
            button.setAutoDefault(False)
        buttons.addWidget(self.preview_button, 1)
        buttons.addWidget(self.apply_button, 2)
        outer.addLayout(buttons)
        footer = QtWidgets.QHBoxLayout()
        self.details_button = QtWidgets.QPushButton("상태 / 오류 보기")
        self.details_button.setObjectName("quiet")
        self.details_button.setCheckable(True)
        self.details_button.setAutoDefault(False)
        self.details_button.toggled.connect(self.details.setVisible)
        footer.addWidget(self.details_button)
        footer.addStretch(1)
        brand = self._label("STUDIO PENUMBRA", "brand")
        brand.setSizePolicy(QtWidgets.QSizePolicy.Policy.Preferred, QtWidgets.QSizePolicy.Policy.Preferred)
        footer.addWidget(brand)
        outer.addLayout(footer)
        self.threshold.valueChanged.connect(self._settings_changed)
        self.selected_only.toggled.connect(self._settings_changed)
        self.preview_button.clicked.connect(lambda: self._run(False))
        self.apply_button.clicked.connect(lambda: self._run(True))

    def _settings_changed(self, *_args):
        self.result_text.setText("설정이 바뀌었습니다. 미리보기로 다시 확인하세요.")
        self.refresh_target()

    def refresh_target(self):
        if self._busy:
            return
        try:
            status = self.backend.read_status()
            signature = (status.node, status.modifier, status.total_vertices,
                         status.selected_ids, str(status.time))
            if self._signature is not None and self._signature != signature:
                self.result_text.setText("대상이나 선택이 바뀌었습니다. 미리보기로 다시 확인하세요.")
            self._signature = signature
            self.target_name.setText(status.node_name)
            self.target_name.setToolTip(status.node_name)
            self.modifier_name.setText(status.modifier_name)
            self.total_value.setText(format(status.total_vertices, ","))
            self.selected_value.setText(format(status.selected_vertices, ","))
            count = status.selected_vertices if self.selected_only.isChecked() else status.total_vertices
            ready = count >= 2
            hint = "준비됨 · 실행할 때 현재 선택을 다시 읽습니다." if ready else "Edit UVWs에서 정점을 2개 이상 선택하세요."
            if not self.selected_only.isChecked() and not ready:
                hint = "UV 정점이 2개 이상인 오브젝트가 필요합니다."
            self.target_hint.setText(hint)
            self.preview_button.setEnabled(ready)
            self.apply_button.setEnabled(ready)
            self.details.setPlainText("대상: {}\n모디파이어: {}\n전체 UV: {}\n선택 UV: {}\n\n{}".format(
                status.node_name, status.modifier_name, status.total_vertices,
                status.selected_vertices, self._last_error or "현재 읽기 오류가 없습니다."))
        except Exception as exc:
            self._signature = None
            self.target_name.setText("작업 대상을 확인해 주세요.")
            self.target_name.setToolTip("")
            self.modifier_name.setText("Unwrap UVW가 있는 오브젝트 하나")
            self.total_value.setText("—")
            self.selected_value.setText("—")
            self.target_hint.setText(str(exc))
            self.details.setPlainText(str(exc))
            self.preview_button.setEnabled(False)
            self.apply_button.setEnabled(False)

    def _checkpoint(self):
        QtWidgets.QApplication.processEvents()
        if self._progress is not None and self._progress.wasCanceled():
            raise SnapCancelled()

    def _run(self, apply):
        if self._busy:
            return
        self.threshold.interpretText()
        self._busy = True
        self.timer.stop()
        for widget in (self.preview_button, self.apply_button, self.threshold, self.selected_only):
            widget.setEnabled(False)
        self._progress = QtWidgets.QProgressDialog("UV 정점을 읽고 있습니다…", "취소", 0, 0, self)
        self._progress.setWindowTitle("Snap UV Vertices")
        self._progress.setWindowModality(QtCore.Qt.WindowModality.ApplicationModal)
        self._progress.setMinimumDuration(500)
        try:
            snapshot = self.backend.read_vertices(selected_only=self.selected_only.isChecked())
            self._progress.setLabelText("근접한 정점을 찾고 있습니다…")
            plan = plan_snaps(snapshot.vertices, self.threshold.value(), checkpoint=self._checkpoint)
            self._checkpoint()
            if apply:
                self._progress.setLabelText("평균 위치로 정렬하고 있습니다…")
                moved = self.backend.apply(snapshot, plan.updates)
                text = "완료 · {:,}개 그룹, {:,}개 정점 이동\nMax의 Undo로 한 번에 되돌릴 수 있습니다.".format(plan.groups, moved)
                if not moved:
                    text = "이동할 정점이 없습니다. 이미 정렬돼 있거나, 거리 안에 이웃 정점이 없습니다."
            else:
                text = "마지막 미리보기 · {:,}개 그룹, 약 {:,}개 정점 이동\nUV는 변경하지 않았습니다. 적용할 때 다시 계산합니다.".format(plan.groups, len(plan.updates))
            self._last_error = ""
            self.result_text.setText(text)
        except SnapCancelled:
            self.result_text.setText("계산을 취소했습니다. UV는 변경하지 않았습니다.")
        except Exception as exc:
            self._last_error = traceback.format_exc()
            self.result_text.setText("작업을 완료하지 못했습니다. 상태 / 오류 보기에서 내용을 확인해 주세요.")
            self.details.setPlainText(str(exc) + "\n\n" + self._last_error)
            self.details_button.setChecked(True)
        finally:
            self._progress.close()
            self._progress.deleteLater()
            self._progress = None
            self._busy = False
            self.threshold.setEnabled(True)
            self.selected_only.setEnabled(True)
            self.refresh_target()
            self.timer.start()

    def reject(self):
        if self._busy:
            if self._progress is not None:
                self._progress.cancel()
            return
        self.close()

    def closeEvent(self, event):
        if self._busy:
            if self._progress is not None:
                self._progress.cancel()
            event.ignore()
            return
        self.timer.stop()
        event.accept()


def show_tool(backend=None, parent=None):
    """Open inside Max's existing QApplication; never start a second event loop."""
    app = QtWidgets.QApplication.instance()
    if app is None:
        raise RuntimeError("3ds Max 2026의 Scripting > Run Script에서 실행해 주세요.")
    if backend is None:
        import qtmax
        backend = MaxBackend()
        parent = qtmax.GetQMaxMainWindow()
    existing = getattr(app, "_penumbra_snap_uv_qt", None)
    if existing is not None and shiboken6.isValid(existing):
        if not existing.close():
            existing.raise_()
            return existing
    dialog = SnapUVDialog(backend, parent)
    if parent is not None:
        import qtmax
        qtmax.DisableMaxAcceleratorsOnFocus(dialog, True)
    # Retain the Python wrapper across repeat Run Script executions.
    app._penumbra_snap_uv_qt = dialog
    screen = parent.screen() if parent is not None else app.primaryScreen()
    if screen is not None:
        available = screen.availableGeometry()
        dialog.resize(min(460, available.width() - 40), min(700, available.height() - 60))
    dialog.show()
    dialog.raise_()
    return dialog


if __name__ == "__main__":
    show_tool()
