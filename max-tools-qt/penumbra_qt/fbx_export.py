"""Safe, synchronous FBX export for 3ds Max 2026; no Qt imports.

Options: folder, mode (individual/combined), filename (combined stem),
reset_xform, center_pivot, move_origin, smoothing_groups, tangents.
Optional triangulate overrides the installed plug-in's value when supplied.
All scene calls must be made on the 3ds Max main thread.
"""

from __future__ import annotations

import importlib
import os
import re
from pathlib import Path


_INVALID_FILENAME = re.compile(r'[\x00-\x1f<>:"/\\|?*]')
_DEVICE_NAMES = {"CON", "PRN", "AUX", "NUL"} | {
    f"{prefix}{number}" for prefix in ("COM", "LPT") for number in range(1, 10)
}


def safe_filename(name):
    """Return a Windows-safe leaf name; never permit a directory escape."""
    clean = _INVALID_FILENAME.sub("_", str(name)).rstrip(" .") or "object"
    if clean.split(".", 1)[0].upper() in _DEVICE_NAMES:
        clean = "_" + clean
    return clean


def plan_export_paths(folder, names):
    """Plan unique paths, including case-insensitive on-disk collisions.

    The exporter reserves each path again at execution time, since a plan alone
    cannot prevent another process from creating a file in the meantime.
    """
    directory = Path(folder)
    if not directory.is_dir():
        raise ValueError("기존 내보내기 폴더를 먼저 선택하세요.")
    used = {entry.name.casefold() for entry in directory.iterdir()}
    paths = []
    for name in names:
        stem = safe_filename(name)
        leaf = stem + ".fbx"
        suffix = 1
        while leaf.casefold() in used:
            leaf = f"{stem}_{suffix}.fbx"
            suffix += 1
        used.add(leaf.casefold())
        paths.append(str(directory / leaf))
    return paths


def _reserve_path(folder, name):
    # Reserve the output itself atomically: exportFile may overwrite this empty
    # file, but never a file that existed before this operation.
    while True:
        path = plan_export_paths(folder, [name])[0]
        try:
            with open(path, "xb"):
                pass
            return path
        except FileExistsError:
            continue


def _parents_first(nodes):
    """Topologically order clones without hashing pymxs node wrappers."""
    pending = list(nodes)
    ordered = []
    while pending:
        available = [node for node in pending if node.parent not in pending]
        if not available:
            raise RuntimeError("Temporary object hierarchy contains a cycle.")
        ordered.extend(available)
        pending = [node for node in pending if node not in available]
    return ordered


class Backend:
    def __init__(self, runtime=None, pymxs_module=None):
        self._rt = runtime
        self._pymxs = pymxs_module
        self._world_origin = None

    def _runtime(self):
        if self._rt is None:
            if self._pymxs is None:
                self._pymxs = importlib.import_module("pymxs")
            self._rt = self._pymxs.runtime
        return self._rt

    def status(self):
        try:
            rt = self._runtime()
            selection = list(rt.selection)
            eligible = sum(bool(rt.isValidNode(node)) for node in selection)
            return {
                "selected": len(selection), "eligible": eligible,
                "ready": eligible > 0,
                "detail": f"선택한 오브젝트 {eligible}개를 내보낼 수 있습니다."
                if eligible else "내보낼 오브젝트를 선택하세요.",
            }
        except Exception as exc:
            return {"selected": 0, "eligible": 0, "ready": False,
                    "detail": f"3ds Max 런타임을 사용할 수 없습니다: {exc}"}

    def _param(self, name, *values):
        if str(self._rt.FBXExporterSetParam(name, *values)) != "OK":
            raise RuntimeError(f"FBX exporter could not apply {name}.")

    def _move_to_world_origin(self, node):
        # pymxs has no scoped coordsys context. getRefCoordSys/setRefCoordSys
        # cannot round-trip a picked object or grid (#object is not settable).
        # This constant bridge changes only the supplied clone's position; the
        # lexical MAXScript context leaves the toolbar coordinate system alone.
        # Never interpolate scene names, paths, or other user input here.
        if self._world_origin is None:
            self._world_origin = self._rt.execute(
                "(fn penumbraQtSetWorldOrigin node = "
                "(in coordsys world (node.pos = [0,0,0])))"
            )
        self._world_origin(node)

    def _export_copies(self, source_nodes, path, options):
        rt, pymxs = self._rt, self._pymxs
        copies = []
        errors = []
        completed = False
        # cloneNodes must not run in undo-off. Catch inside this scope because
        # pymxs.undo suppresses exceptions and attempts an implicit undo.
        with pymxs.undo(True, "Quick Export FBX temporary copies"):
            try:
                result, actual, cloned = rt.maxOps.cloneNodes(
                    rt.Array(*source_nodes), cloneType=rt.Name("copy"),
                    expandHierarchy=False, actualNodeList=pymxs.byref(None),
                    newNodes=pymxs.byref(None),
                )
                copies = list(cloned) if cloned is not None else []
                actual = list(actual) if actual is not None else []
                if not result or not copies or len(actual) != len(copies):
                    raise RuntimeError("Could not create temporary export copies.")
                with pymxs.animate(False):
                    for node, source in zip(copies, actual):
                        node.name = source.name
                        if options.get("reset_xform", True):
                            rt.resetXForm(node)
                            rt.collapseStack(node)
                        if options.get("center_pivot", True):
                            node.pivot = node.center
                    if options.get("move_origin", True):
                        for node in _parents_first(copies):
                            self._move_to_world_origin(node)
                rt.select(rt.Array(*copies))
                if not rt.exportFile(path, rt.Name("noPrompt"),
                                     selectedOnly=True, using=rt.FBXEXP):
                    raise RuntimeError("FBX export failed or was cancelled.")
                if not os.path.isfile(path) or os.path.getsize(path) <= 0:
                    raise RuntimeError("The exporter did not create a nonempty file.")
                completed = True
            except Exception as exc:
                errors.append(str(exc))
                if not copies:
                    errors.append("Inspect the scene if cloning created incomplete temporary objects.")
            finally:
                try:
                    remaining = [node for node in copies if rt.isValidNode(node)]
                    if remaining:
                        rt.delete(rt.Array(*remaining))
                    if any(rt.isValidNode(node) for node in copies):
                        raise RuntimeError("Some temporary copies still exist.")
                except Exception as exc:
                    errors.append(f"Temporary copy cleanup failed: {exc}")
        if errors:
            raise RuntimeError(" ".join(errors))
        if not completed:
            raise RuntimeError("Export did not complete; inspect the scene and output.")

    def run(self, options, emit=None):
        options = dict(options)
        folder = os.path.abspath(os.path.expanduser(str(options.get("folder", ""))))
        if not options.get("folder") or not os.path.isdir(folder):
            raise ValueError("기존 내보내기 폴더를 먼저 선택하세요.")
        mode = options.get("mode", "individual")
        if mode not in ("individual", "combined"):
            raise ValueError("내보내기 모드는 individual 또는 combined여야 합니다.")
        rt = self._runtime()
        if self._pymxs is None:
            self._pymxs = importlib.import_module("pymxs")
        original_selection = list(rt.selection)
        sources = [node for node in original_selection if rt.isValidNode(node)]
        if not sources:
            raise ValueError("내보낼 오브젝트를 선택하세요.")
        combined_name = str(options.get("filename", "export")).strip() or "export"
        if combined_name.lower().endswith(".fbx"):
            combined_name = combined_name[:-4]
        jobs = [([node], str(node.name)) for node in sources] if mode == "individual" else [(sources, combined_name)]
        details, issues = [], []
        exported = failed = 0
        settings_saved = progress_started = stopped = False
        try:
            rt.pluginManager.loadClass(rt.FBXEXP)
            self._param("PushSettings")
            settings_saved = True
            for name, value in (
                ("UpAxis", "Y"), ("SmoothingGroups", options.get("smoothing_groups", True)),
                ("TangentSpaceExport", options.get("tangents", True)),
                ("Preserveinstances", False), ("ASCII", False),
            ):
                self._param(name, value)
            if "triangulate" in options:
                self._param("Triangulate", bool(options["triangulate"]))
            # Keep the installed plug-in's selected FBX FileVersion.
            rt.progressStart("FBX 내보내기")
            progress_started = True
            for index, (nodes, stem) in enumerate(jobs):
                if not rt.progressUpdate(100.0 * index / len(jobs)):
                    stopped = True
                    details.append("다음 파일을 내보내기 전에 취소했습니다.")
                    break
                path = None
                try:
                    path = _reserve_path(folder, stem)
                    if emit:
                        emit(f"내보내는 중 {index + 1}/{len(jobs)}: {Path(path).name}")
                    self._export_copies(nodes, path, options)
                    exported += 1
                    details.append(f"내보내기 완료: {path}")
                except Exception as exc:
                    failed += 1
                    stopped = True
                    issues.append(f"내보내기 중단: {path or stem}: {exc}")
                    if path and os.path.isfile(path):
                        try:
                            if os.path.getsize(path) == 0:
                                os.unlink(path)
                            else:
                                details.append(f"Output kept for inspection after failure: {path}")
                        except OSError as cleanup_exc:
                            issues.append(f"Empty output could not be removed: {cleanup_exc}")
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
                    issues.append(f"FBX 내보내기 설정을 복원하지 못했습니다. 설정을 확인하세요. {exc}")
            try:
                rt.select(rt.Array(*[node for node in original_selection if rt.isValidNode(node)]))
            except Exception as exc:
                issues.append(f"원래 선택을 복원하지 못했습니다: {exc}")
        summary = f"파일 {exported}개 내보내기 완료, {failed}개 실패."
        if stopped:
            summary += " 작업이 중단되어 나머지 파일은 내보내지 않았습니다."
        if issues:
            summary += " " + " ".join(issues)
        return {"summary": summary, "details": details + issues}
