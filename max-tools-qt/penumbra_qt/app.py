"""Shared, modeless Qt tools. Scene changes are delegated to synchronous backends."""
import importlib
import traceback
from pathlib import Path
from PySide6 import QtCore, QtGui, QtWidgets
import shiboken6
from .style import STYLE

TOOLS = {
    'uv_export': dict(title='UV Exporter', category='UV TOOLS / 02', intro='선택한 오브젝트의 UV를 PNG 템플릿으로 저장합니다.', action='UV 템플릿 저장', note='임시 복사본에서 출력합니다. 원본 오브젝트와 모디파이어는 유지됩니다.'),
    'normal_baker': dict(title='Outline Normal Baker', category='MESH TOOLS / 03', intro='외곽선용 스무딩 노멀을 새 메시 복사본에 기록합니다.', action='노멀 복사본 만들기', note='현재 프레임의 정적 메시를 만듭니다. 원본의 모디파이어와 애니메이션은 유지됩니다.'),
    'collinear': dict(title='Collinear Cleanup', category='MESH TOOLS / 04', intro='직선 위에 놓인 불필요한 정점을 정리합니다.', action='정점 제거', note='조건에 맞는 오브젝트의 전체 정점을 검사합니다. 제거 작업은 Max의 Undo로 되돌릴 수 있습니다.'),
    'fbx_export': dict(title='Quick Export FBX', category='FILE TOOLS / 05', intro='원본을 유지하면서 내보내기용 복사본을 준비합니다.', action='FBX 내보내기', note='기존 파일은 덮어쓰지 않습니다. 이름이 겹치면 번호를 붙입니다.'),
    'fbx_import': dict(title='Batch FBX Importer', category='FILE TOOLS / 06', intro='여러 FBX 파일을 목록 순서대로 불러옵니다.', action='FBX 가져오기', note='현재 장면에 추가하거나, 파일마다 새 장면으로 열 수 있습니다.'),
}


def label(text='', role='', wrap=True):
    widget = QtWidgets.QLabel(text)
    widget.setTextFormat(QtCore.Qt.TextFormat.PlainText)
    widget.setObjectName(role)
    widget.setWordWrap(wrap)
    policy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Policy.Ignored, QtWidgets.QSizePolicy.Policy.Preferred)
    policy.setHeightForWidth(wrap)
    widget.setSizePolicy(policy)
    return widget


def button(text, handler=None, primary=False):
    widget = QtWidgets.QPushButton(text)
    widget.setAutoDefault(False)
    if primary:
        widget.setObjectName('primary')
    if handler:
        widget.clicked.connect(handler)
    return widget


class ToolDialog(QtWidgets.QDialog):
    def __init__(self, tool_id, backend, parent=None):
        super().__init__(parent)
        self.tool_id, self.backend = tool_id, backend
        self.spec = TOOLS[tool_id]
        self.busy = False
        self.last_details = ''
        self.fields = {}
        self.setObjectName('PenumbraTool')
        self.setWindowTitle(self.spec['title'] + ' · Penumbra')
        self.setWindowFlag(QtCore.Qt.WindowType.Tool, True)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.setStyleSheet(STYLE)
        self.setMinimumSize(420, 540)
        self.resize(470, 760)
        self._build()
        self.timer = QtCore.QTimer(self)
        self.timer.setInterval(600)
        self.timer.timeout.connect(self.refresh)
        self.refresh()
        self.timer.start()

    def card(self, title):
        frame = QtWidgets.QFrame()
        frame.setObjectName('card')
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(10)
        layout.addWidget(label(title, 'sectionTitle'))
        self.content.addWidget(frame)
        return layout

    def combo(self, layout, key, title, choices):
        layout.addWidget(label(title, 'muted'))
        field = QtWidgets.QComboBox()
        field.setAccessibleName(title)
        for text, value in choices:
            field.addItem(text, value)
        field.currentIndexChanged.connect(self.settings_changed)
        self.fields[key] = field
        layout.addWidget(field)
        return field

    def check(self, layout, key, title, default=True):
        field = QtWidgets.QCheckBox(title)
        field.setChecked(default)
        field.toggled.connect(self.settings_changed)
        self.fields[key] = field
        layout.addWidget(field)

    def folder(self, layout):
        row = QtWidgets.QHBoxLayout()
        field = QtWidgets.QLineEdit()
        field.setReadOnly(True)
        field.setPlaceholderText('출력 폴더를 선택하세요')
        field.setAccessibleName('출력 폴더')
        self.fields['folder'] = field
        row.addWidget(field, 1)
        row.addWidget(button('찾기…', self.browse_folder))
        layout.addLayout(row)
        self.open_folder_button = button('출력 폴더 열기', self.open_folder)
        layout.addWidget(self.open_folder_button)

    def _build(self):
        outer = QtWidgets.QVBoxLayout(self)
        outer.setContentsMargins(22, 22, 22, 16)
        outer.setSpacing(12)
        outer.addWidget(label(self.spec['category'], 'eyebrow'))
        outer.addWidget(label(self.spec['title'], 'heading'))
        outer.addWidget(label(self.spec['intro'], 'muted'))
        scroll = QtWidgets.QScrollArea()
        self.scroll = scroll
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.body = QtWidgets.QWidget()
        self.body.setObjectName('body')
        self.content = QtWidgets.QVBoxLayout(self.body)
        self.content.setContentsMargins(0, 4, 2, 4)
        self.content.setSpacing(12)
        scroll.setWidget(self.body)
        outer.addWidget(scroll, 1)

        layout = self.card('작업 대상' if self.tool_id != 'fbx_import' else '입력 파일')
        metrics = QtWidgets.QHBoxLayout()
        self.selected_value, self.eligible_value = label('—', 'metric'), label('—', 'metric')
        for title, value in [('선택 오브젝트', self.selected_value), ('작업 가능', self.eligible_value)]:
            col = QtWidgets.QVBoxLayout()
            col.setSpacing(4)
            col.addWidget(label(title, 'muted'))
            col.addWidget(value)
            metrics.addLayout(col, 1)
        if self.tool_id != 'fbx_import':
            layout.addLayout(metrics)
        self.target_hint = label('', 'muted')
        layout.addWidget(self.target_hint)
        if self.tool_id == 'fbx_import':
            self.file_list = QtWidgets.QListWidget()
            self.file_list.setAccessibleName('가져올 FBX 파일 목록')
            self.file_list.setSelectionMode(QtWidgets.QAbstractItemView.SelectionMode.ExtendedSelection)
            self.file_list.setTextElideMode(QtCore.Qt.TextElideMode.ElideMiddle)
            self.file_list.setMinimumHeight(110)
            self.file_list.setMaximumHeight(180)
            layout.addWidget(self.file_list)
            row = QtWidgets.QHBoxLayout()
            for text, fn in [('추가…', self.browse_files), ('선택 삭제', self.remove_files), ('비우기', self.clear_files)]:
                row.addWidget(button(text, fn))
            layout.addLayout(row)

        if self.tool_id == 'uv_export':
            layout = self.card('출력 설정')
            self.combo(layout, 'resolution', 'PNG 해상도', [('1024 × 1024', 1024), ('2048 × 2048', 2048), ('4096 × 4096', 4096)])
            self.folder(layout)
        elif self.tool_id == 'normal_baker':
            layout = self.card('저장할 노멀')
            layout.addWidget(label('MK Toon · UV7 / Max Map 8'))
            layout.addWidget(label('면적과 모서리 각도로 가중한 평균 노멀을 (normal + 1) / 2로 저장합니다.', 'muted'))
            layout.addWidget(label('복사본의 Map 8을 대체하며 다른 UV 채널은 유지합니다. 생성된 _OutlineNormals 복사본을 Export Selected로 내보내세요.', 'muted'))
        elif self.tool_id == 'collinear':
            layout = self.card('정리 설정')
            layout.addWidget(label('직선 판정 거리 · 월드 단위', 'muted'))
            field = QtWidgets.QDoubleSpinBox()
            field.setDecimals(5)
            field.setRange(0.0001, 10.0)
            field.setSingleStep(0.001)
            field.setValue(0.001)
            field.setKeyboardTracking(False)
            field.setAccessibleName('직선 판정 거리, 월드 단위')
            field.valueChanged.connect(self.settings_changed)
            self.fields['threshold'] = field
            layout.addWidget(field)
            layout.addWidget(label('Editable Poly 전용입니다. 모디파이어가 있거나 선택하지 않은 인스턴스와 데이터를 공유하면 제외합니다.', 'muted'))
            self.preview_hint = label('미리보기는 작업할 정점을 선택합니다.', 'muted')
            layout.addWidget(self.preview_hint)
        elif self.tool_id == 'fbx_export':
            layout = self.card('출력 폴더')
            self.folder(layout)
            layout = self.card('복사본 준비')
            self.check(layout, 'reset_xform', 'Reset XForm')
            self.check(layout, 'center_pivot', '피벗을 오브젝트 중심으로')
            self.check(layout, 'move_origin', '오브젝트를 원점 (0, 0, 0)으로')
            layout = self.card('파일 구성')
            self.combo(layout, 'mode', '저장 방식', [('오브젝트별 개별 파일', 'individual'), ('선택한 오브젝트를 한 파일로', 'combined')])
            self.filename_label = label('합본 파일 이름', 'muted')
            layout.addWidget(self.filename_label)
            field = QtWidgets.QLineEdit('export')
            field.setAccessibleName('합본 FBX 파일 이름')
            field.textChanged.connect(self.settings_changed)
            self.fields['filename'] = field
            layout.addWidget(field)
            layout.addWidget(label('Y-Up · Smoothing Groups · Tangent Space', 'muted'))
        else:
            layout = self.card('가져오기 방식')
            self.combo(layout, 'mode', '장면', [('현재 장면에 추가', 'current'), ('파일마다 새 장면', 'new_scene')])
            self.mode_note = label('', 'muted')
            layout.addWidget(self.mode_note)

        layout = self.card('결과')
        self.result_text = label('설정을 확인한 뒤 실행하세요.')
        layout.addWidget(self.result_text)
        layout.addWidget(label(self.spec['note'], 'muted'))
        self.details = QtWidgets.QPlainTextEdit()
        self.details.setReadOnly(True)
        self.details.setAccessibleName('작업 기록과 오류 상세')
        self.details.setMinimumHeight(100)
        self.details.setMaximumHeight(180)
        self.details.hide()
        self.content.addWidget(self.details)
        self.content.addStretch(1)
        row = QtWidgets.QHBoxLayout()
        self.preview_button = None
        if self.tool_id == 'collinear':
            self.preview_button = button('정점 선택 / 미리보기', lambda: self.run(True))
            row.addWidget(self.preview_button, 1)
        self.apply_button = button(self.spec['action'], lambda: self.run(False), primary=True)
        self.apply_button.setMinimumHeight(40)
        row.addWidget(self.apply_button, 2)
        outer.addLayout(row)
        footer = QtWidgets.QHBoxLayout()
        self.details_button = button('상태 / 오류 보기')
        self.details_button.setObjectName('quiet')
        self.details_button.setCheckable(True)
        self.details_button.toggled.connect(self.details.setVisible)
        footer.addWidget(self.details_button)
        footer.addStretch(1)
        brand = label('STUDIO PENUMBRA', 'brand', False)
        brand.setSizePolicy(QtWidgets.QSizePolicy.Policy.Preferred, QtWidgets.QSizePolicy.Policy.Preferred)
        footer.addWidget(brand)
        outer.addLayout(footer)

    def options(self):
        data = {}
        for key, field in self.fields.items():
            if isinstance(field, QtWidgets.QComboBox):
                data[key] = field.currentData()
            elif isinstance(field, QtWidgets.QCheckBox):
                data[key] = field.isChecked()
            elif isinstance(field, QtWidgets.QDoubleSpinBox):
                field.interpretText()
                data[key] = field.value()
            else:
                data[key] = field.text()
        if self.tool_id == 'fbx_import':
            data['files'] = [self.file_list.item(i).data(QtCore.Qt.ItemDataRole.UserRole) for i in range(self.file_list.count())]
        return data

    def settings_changed(self, *_):
        if hasattr(self, 'result_text') and not self.busy:
            self.result_text.setText('설정이 바뀌었습니다. 현재 설정으로 실행합니다.')
            self.refresh()

    def refresh(self):
        if self.busy:
            return
        try:
            status = self.backend.status()
            self.selected_value.setText(format(status.get('selected', 0), ','))
            self.eligible_value.setText(format(status.get('eligible', 0), ','))
            detail = status.get('detail', '')
            ready = bool(status.get('ready', False))
            if 'folder' in self.fields:
                folder = self.fields['folder'].text()
                valid_folder = bool(folder) and Path(folder).is_dir()
                self.open_folder_button.setEnabled(valid_folder)
                if not valid_folder:
                    detail += '\n출력 폴더를 선택하세요.'
                ready = ready and valid_folder
            if self.tool_id == 'fbx_export':
                combined = self.fields['mode'].currentData() == 'combined'
                self.filename_label.setVisible(combined)
                self.fields['filename'].setVisible(combined)
                ready = ready and (not combined or bool(self.fields['filename'].text().strip()))
            if self.tool_id == 'fbx_import':
                count = self.file_list.count()
                file_detail = '{}개 파일 · 추가 순서대로 처리합니다.'.format(count)
                detail = file_detail if ready else file_detail + '\n' + detail
                ready = ready and count > 0
                new_scene = self.fields['mode'].currentData() == 'new_scene'
                self.mode_note.setText('각 장면을 닫기 전에 Max의 저장 확인이 표시됩니다. 마지막 파일의 장면만 열려 있습니다.' if new_scene else '기존 오브젝트를 갱신하지 않고 새 오브젝트로 추가합니다.')
            self.target_hint.setText(detail.strip())
            self.apply_button.setEnabled(ready)
            if self.preview_button:
                self.preview_button.setEnabled(bool(status.get('preview_ready', ready)))
                self.preview_hint.setText(status.get('preview_detail', '미리보기는 작업할 정점을 선택합니다.'))
            self.set_details(detail.strip() + ('\n\n' + self.last_details if self.last_details else ''))
        except Exception as exc:
            self.target_hint.setText(str(exc))
            self.selected_value.setText('—')
            self.eligible_value.setText('—')
            self.apply_button.setEnabled(False)
            if self.preview_button:
                self.preview_button.setEnabled(False)
            self.set_details(str(exc) + ('\n\n' + self.last_details if self.last_details else ''))

    def set_details(self, text):
        # Polling must not reset selection or scroll while the log is being read.
        if self.details.toPlainText() != text:
            self.details.setPlainText(text)

    def browse_folder(self):
        chosen = QtWidgets.QFileDialog.getExistingDirectory(self, '출력 폴더 선택', self.fields['folder'].text())
        if chosen:
            self.fields['folder'].setText(chosen)
            self.fields['folder'].setToolTip(chosen)
            self.settings_changed()

    def open_folder(self):
        folder = self.fields['folder'].text()
        if folder and Path(folder).is_dir():
            QtGui.QDesktopServices.openUrl(QtCore.QUrl.fromLocalFile(folder))

    def add_files(self, paths):
        known = {str(self.file_list.item(i).data(QtCore.Qt.ItemDataRole.UserRole)).replace('\\', '/').casefold() for i in range(self.file_list.count())}
        for path in paths:
            path = str(path)
            key = path.replace('\\', '/').casefold()
            if key in known or Path(path).suffix.lower() != '.fbx':
                continue
            item = QtWidgets.QListWidgetItem(path)
            item.setToolTip(path)
            item.setData(QtCore.Qt.ItemDataRole.UserRole, path)
            self.file_list.addItem(item)
            known.add(key)
        self.settings_changed()

    def browse_files(self):
        paths, _ = QtWidgets.QFileDialog.getOpenFileNames(self, 'FBX 파일 선택', '', 'FBX (*.fbx *.FBX)')
        self.add_files(paths)

    def remove_files(self):
        for item in self.file_list.selectedItems():
            self.file_list.takeItem(self.file_list.row(item))
        self.settings_changed()

    def clear_files(self):
        self.file_list.clear()
        self.settings_changed()

    def emit(self, message):
        # Paint a progress label without dispatching input or scene-changing events.
        self.result_text.setText(str(message))
        self.result_text.repaint()

    def run(self, preview=False):
        if self.busy:
            return
        data = self.options()
        data['preview'] = bool(preview)
        self.busy = True
        self.timer.stop()
        self.body.setEnabled(False)
        self.apply_button.setEnabled(False)
        if self.preview_button:
            self.preview_button.setEnabled(False)
        try:
            self.emit('작업 중입니다…')
            result = self.backend.run(data, emit=self.emit)
            self.result_text.setText(result['summary'])
            self.last_details = '\n'.join(str(x) for x in result.get('details', []))
        except Exception as exc:
            self.result_text.setText('작업을 완료하지 못했습니다. 상태 / 오류 보기에서 내용을 확인하세요.')
            self.last_details = str(exc) + '\n\n' + traceback.format_exc()
            self.details_button.setChecked(True)
        finally:
            self.busy = False
            self.body.setEnabled(True)
            self.refresh()
            self.timer.start()
            QtCore.QTimer.singleShot(0, self.reveal_result)

    def reveal_result(self):
        if shiboken6.isValid(self):
            self.scroll.ensureWidgetVisible(self.result_text, 0, 30)

    def reject(self):
        if not self.busy:
            self.close()

    def closeEvent(self, event):
        if self.busy:
            event.ignore()
        else:
            self.timer.stop()
            event.accept()


def show_tool(tool_id, backend=None, parent=None):
    if tool_id == 'snap_uv':
        from .snap_uv import show_tool as show_snap
        return show_snap(backend=backend, parent=parent)
    if tool_id not in TOOLS:
        raise ValueError('Unknown tool: ' + str(tool_id))
    app = QtWidgets.QApplication.instance()
    if app is None:
        raise RuntimeError('3ds Max 2026의 Scripting > Run Script에서 실행해 주세요.')
    if backend is None:
        import qtmax
        backend = importlib.import_module('.' + tool_id, __package__).Backend()
        parent = qtmax.GetQMaxMainWindow()
    key = '_penumbra_qt_' + tool_id
    old = getattr(app, key, None)
    if old is not None and shiboken6.isValid(old):
        if not old.close():
            old.raise_()
            return old
    dialog = ToolDialog(tool_id, backend, parent)
    if parent is not None:
        import qtmax
        qtmax.DisableMaxAcceleratorsOnFocus(dialog, True)
    setattr(app, key, dialog)
    screen = parent.screen() if parent is not None else app.primaryScreen()
    if screen:
        available = screen.availableGeometry()
        dialog.resize(min(470, available.width() - 40), min(760, available.height() - 60))
    dialog.show()
    dialog.raise_()
    return dialog


class LauncherDialog(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName('PenumbraTool')
        self.setWindowTitle('Penumbra · Max Tools')
        self.setWindowFlag(QtCore.Qt.WindowType.Tool, True)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_DeleteOnClose, True)
        self.setStyleSheet(STYLE)
        self.setMinimumSize(380, 480)
        self.resize(430, 610)
        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(22, 22, 22, 18)
        layout.setSpacing(10)
        layout.addWidget(label('STUDIO PENUMBRA', 'eyebrow'))
        layout.addWidget(label('Max Tools', 'heading'))
        layout.addWidget(label('Python · Qt edition / Max 2026', 'muted'))
        entries = [('snap_uv', 'Snap UV Vertices', '가까운 UV 정점을 평균 위치로')]
        entries += [(key, spec['title'], spec['intro']) for key, spec in TOOLS.items()]
        for key, title, description in entries:
            widget = button(title + '  ↗', lambda checked=False, tool=key: show_tool(tool))
            widget.setToolTip(description)
            widget.setMinimumHeight(48)
            layout.addWidget(widget)
        layout.addStretch(1)
        layout.addWidget(label('실행할 도구를 선택하세요. 각 창은 따로 열립니다.', 'muted'))


def show_launcher(parent=None):
    app = QtWidgets.QApplication.instance()
    if app is None:
        raise RuntimeError('3ds Max 2026 안에서 실행해 주세요.')
    if parent is None:
        import qtmax
        parent = qtmax.GetQMaxMainWindow()
    old = getattr(app, '_penumbra_qt_launcher', None)
    if old is not None and shiboken6.isValid(old):
        old.close()
    dialog = LauncherDialog(parent)
    import qtmax
    qtmax.DisableMaxAcceleratorsOnFocus(dialog, True)
    app._penumbra_qt_launcher = dialog
    dialog.show()
    dialog.raise_()
    return dialog
