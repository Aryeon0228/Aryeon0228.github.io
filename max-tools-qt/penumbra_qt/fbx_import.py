"""Synchronous FBX add/import backend for 3ds Max 2026; no Qt imports.

Options: files (ordered list of paths), mode ('current' or 'new_scene').
New-scene mode uses native save/cancel prompts before every reset. Import
failures may leave native scene changes; no rollback guarantee is made.
"""

from __future__ import annotations

import importlib
import os
from pathlib import Path


def normalize_files(files):
    """Validate FBX suffixes and deduplicate Windows paths in display order.

    Missing files stay in this list, so the backend reports them individually
    and never resets the current scene merely to discover a missing file.
    """
    if isinstance(files, (str, bytes, os.PathLike)):
        raise ValueError("FBX 파일 경로 목록을 지정하세요.")
    paths, seen = [], set()
    for value in files:
        path = os.path.abspath(os.path.expanduser(os.fspath(value)))
        if Path(path).suffix.lower() != ".fbx":
            raise ValueError(f"FBX 파일만 가져올 수 있습니다: {value}")
        key = path.replace("\\", "/").casefold()
        if key not in seen:
            seen.add(key)
            paths.append(path)
    return paths


class Backend:
    def __init__(self, runtime=None, pymxs_module=None):
        self._rt = runtime
        self._pymxs = pymxs_module

    def _runtime(self):
        if self._rt is None:
            if self._pymxs is None:
                self._pymxs = importlib.import_module("pymxs")
            self._rt = self._pymxs.runtime
        return self._rt

    def status(self):
        try:
            rt = self._runtime()
            return {"selected": len(list(rt.selection)), "eligible": 0,
                    "ready": True, "detail": "가져올 FBX 파일을 목록에 추가하세요."}
        except Exception as exc:
            return {"selected": 0, "eligible": 0, "ready": False,
                    "detail": f"3ds Max 런타임을 사용할 수 없습니다: {exc}"}

    def _param(self, name, *values):
        if str(self._rt.FBXImporterSetParam(name, *values)) != "OK":
            raise RuntimeError(f"FBX importer could not apply {name}.")

    def run(self, options, emit=None):
        files = normalize_files(options.get("files", []))
        if not files:
            raise ValueError("가져올 FBX 파일을 하나 이상 추가하세요.")
        mode = options.get("mode", "current")
        if mode not in ("current", "new_scene"):
            raise ValueError("가져오기 모드는 current 또는 new_scene이어야 합니다.")
        new_scene = mode == "new_scene"
        rt = self._runtime()
        old_selection = list(rt.selection)
        details, issues = [], []
        imported = failed = 0
        settings_saved = progress_started = stopped = False
        possible_partial_import = False
        try:
            rt.pluginManager.loadClass(rt.FBXIMP)
            self._param("PushSettings")
            settings_saved = True
            self._param("Mode", rt.Name("create"))
            rt.progressStart("FBX 가져오기")
            progress_started = True
            for index, path in enumerate(files):
                if not rt.progressUpdate(100.0 * index / len(files)):
                    stopped = True
                    details.append("다음 파일을 가져오기 전에 취소했습니다.")
                    break
                if not os.path.isfile(path):
                    failed += 1
                    details.append(f"파일을 찾을 수 없습니다: {path}")
                    continue
                if new_scene:
                    # In Quiet Mode checkForSave silently returns true.
                    if rt.getQuietMode():
                        raise RuntimeError("새 씬 가져오기는 저장 확인이 필요합니다. Quiet Mode를 먼저 끄세요.")
                    if not rt.checkForSave():
                        stopped = True
                        details.append("씬 저장 확인에서 가져오기를 취소했습니다.")
                        break
                    # Reset is a native scene mutation, never an undo rollback.
                    # False is an explicit failure; some Max versions return OK.
                    try:
                        if rt.resetMaxFile(rt.Name("noPrompt")) is False:
                            raise RuntimeError("Scene reset returned false.")
                    except Exception as exc:
                        failed += 1
                        issues.append("씬 초기화 중 오류가 발생했습니다. 현재 씬을 확인하세요. 자동 복원하지 않았습니다.")
                        try:
                            rt.setSaveRequired(True)
                        except Exception as dirty_exc:
                            issues.append(f"Could not mark the scene as needing a save: {dirty_exc}")
                        raise RuntimeError(f"Scene reset failed; import was not started: {exc}") from exc
                attempted = False
                try:
                    # Reset may change plug-in state; reapply for every file.
                    self._param("Mode", rt.Name("create"))
                    if emit:
                        emit(f"가져오는 중 {index + 1}/{len(files)}: {Path(path).name}")
                    attempted = True
                    if not rt.importFile(path, rt.Name("noPrompt"), using=rt.FBXIMP):
                        raise RuntimeError("FBX import failed or was cancelled.")
                    rt.setSaveRequired(True)
                    imported += 1
                    details.append(f"가져오기 완료: {path}")
                except Exception as exc:
                    failed += 1
                    stopped = True
                    possible_partial_import = attempted
                    issues.append(f"가져오기 중단: {path}: {exc}")
                    if attempted:
                        try:
                            rt.setSaveRequired(True)
                        except Exception as dirty_exc:
                            issues.append(f"Could not mark the changed scene as needing a save: {dirty_exc}")
                    break
        except Exception as exc:
            stopped = True
            issues.append(str(exc))
        finally:
            if progress_started:
                try:
                    rt.progressEnd()
                except Exception as exc:
                    issues.append(f"Progress display could not be closed: {exc}")
            if settings_saved:
                try:
                    self._param("PopSettings")
                except Exception as exc:
                    issues.append(f"FBX 가져오기 설정을 복원하지 못했습니다. 설정을 확인하세요. {exc}")
            if not new_scene:
                try:
                    rt.select(rt.Array(*[node for node in old_selection if rt.isValidNode(node)]))
                except Exception as exc:
                    issues.append(f"원래 선택을 복원하지 못했습니다: {exc}")
        summary = f"파일 {imported}개 가져오기 완료, {failed}개 실패."
        if stopped:
            summary += " 작업이 중단되어 나머지 파일은 가져오지 않았습니다."
        if possible_partial_import:
            issues.append("현재 씬에 일부만 가져온 데이터가 남아 있을 수 있습니다. 계속하기 전에 확인하세요. 자동 복원하지 않았습니다.")
        if issues:
            summary += " " + " ".join(issues)
        return {"summary": summary, "details": details + issues}
