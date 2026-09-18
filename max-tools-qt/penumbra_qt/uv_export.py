"""UV template export using temporary 3ds Max nodes, with no Qt dependency.

Call on the 3ds Max main thread. Importing this module does not import pymxs;
passing a runtime (and optionally a pymxs module) permits isolated tests.
"""

from contextlib import contextmanager, nullcontext
import os
from pathlib import Path
import re
import shutil
import tempfile


RESOLUTIONS = (1024, 2048, 4096)
_INVALID_FILENAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def safe_object_name(name):
    """Keep the original exporter's Windows-safe, 100-character name rule."""
    name = _INVALID_FILENAME.sub("_", str(name)).lstrip().rstrip(" .")
    return (name or "Object")[:100]


def unique_output_path(folder, object_name, resolution):
    """Return an unused PNG name; UV_ also protects Windows device names."""
    folder = Path(folder)
    stem = "UV_{}_{}".format(safe_object_name(object_name), resolution)
    path = folder / (stem + ".png")
    suffix = 2
    # lexists includes broken symlinks, which must never be overwritten either.
    while os.path.lexists(path):
        path = folder / "{}_{}.png".format(stem, suffix)
        suffix += 1
    return path


def _publish_png(source, folder, object_name, resolution):
    """Copy a finished image to an exclusively created, collision-safe file."""
    while True:
        destination = unique_output_path(folder, object_name, resolution)
        try:
            output = destination.open("xb")
        except FileExistsError:
            # Another exporter may have claimed this name after the check.
            continue
        try:
            with output, Path(source).open("rb") as image:
                shutil.copyfileobj(image, output)
        except BaseException:
            # This destination was created by us, never a pre-existing PNG.
            destination.unlink(missing_ok=True)
            raise
        return destination


@contextmanager
def _undo_with_errors(pymxs_module):
    """Let pymxs roll back, then re-raise errors it normally suppresses."""
    context = (
        pymxs_module.undo(True, "Export UV Templates")
        if pymxs_module is not None
        else nullcontext()
    )
    error = None
    with context:
        try:
            yield
        except BaseException as exc:
            error = exc
            raise
    if error is not None:
        raise error


class Backend:
    """Preserve source stacks and restore scene/PNG preferences on every exit."""

    def __init__(self, runtime=None, pymxs_module=None):
        self._runtime = runtime
        self._pymxs = pymxs_module

    @property
    def runtime(self):
        if self._runtime is None:
            if self._pymxs is None:
                import pymxs

                self._pymxs = pymxs
            self._runtime = self._pymxs.runtime
        return self._runtime

    def _is_geometry(self, node):
        rt = self.runtime
        return bool(rt.isValidNode(node) and rt.superClassOf(node) == rt.GeometryClass)

    def status(self):
        try:
            selection = list(self.runtime.selection)
            eligible = sum(self._is_geometry(node) for node in selection)
        except Exception as exc:
            return {
                "selected": 0,
                "eligible": 0,
                "ready": False,
                "detail": "3ds Max 선택을 확인하지 못했습니다: {}".format(exc),
            }
        return {
            "selected": len(selection),
            "eligible": eligible,
            "ready": eligible > 0,
            "detail": (
                "지오메트리 {}개를 출력할 수 있습니다.".format(eligible)
                if eligible
                else "지오메트리 오브젝트를 하나 이상 선택하세요."
            ),
        }

    @staticmethod
    def _options(options):
        resolution = options.get("resolution", 1024)
        if type(resolution) is not int or resolution not in RESOLUTIONS:
            raise ValueError("PNG 해상도는 1024, 2048, 4096 중에서 선택하세요.")
        folder = options.get("folder", "")
        if not isinstance(folder, str) or not folder.strip():
            raise ValueError("출력 폴더를 선택하세요.")
        folder = Path(folder).expanduser().absolute()
        if not folder.is_dir():
            raise ValueError("출력 폴더가 존재하지 않습니다.")
        return resolution, folder

    def run(self, options, emit=None):
        resolution, folder = self._options(options)
        rt = self.runtime
        selection = list(rt.selection)
        targets = [node for node in selection if self._is_geometry(node)]
        if not targets:
            raise ValueError("지오메트리 오브젝트를 하나 이상 선택하세요.")

        # Capture every value before changing anything. A failed snapshot must
        # leave the scene and all global preferences untouched.
        state = {
            "panel": rt.getCommandPanelTaskMode(),
            "current": rt.modPanel.getCurrentObject(),
            "level": rt.subObjectLevel,
            "alpha": rt.pngio.getAlpha(),
            "type": rt.pngio.getType(),
        }
        details = []
        successes = 0
        failures = 0
        stopped = False
        restoration_warnings = 0
        temp_node = None

        def report(message):
            details.append(message)
            if emit is not None:
                try:
                    emit(message)
                except Exception:
                    # A UI logger must not interrupt scene cleanup.
                    pass

        def restore(label, action):
            nonlocal restoration_warnings
            try:
                action()
            except Exception as exc:
                restoration_warnings += 1
                report("복원 실패 ({}): {}".format(label, exc))

        try:
            # Creating the staging directory checks folder write access before
            # any scene mutation. Only owned files are removed on failure.
            with tempfile.TemporaryDirectory(prefix=".uv-export-", dir=folder) as staging:
                with _undo_with_errors(self._pymxs):
                    rt.pngio.setAlpha(False)
                    rt.pngio.setType(rt.Name("true24"))
                    for index, target in enumerate(targets, start=1):
                        name = "Object"
                        try:
                            if not rt.isValidNode(target):
                                raise RuntimeError("원본 오브젝트가 더 이상 존재하지 않습니다.")
                            name = str(target.name)
                            report("{}/{} 출력 중: {}".format(index, len(targets), name))
                            candidate = rt.copy(target)
                            if not rt.isValidNode(candidate):
                                raise RuntimeError("임시 복사본을 만들지 못했습니다.")
                            if candidate == target:
                                raise RuntimeError("복사 과정에서 원본이 반환되어 출력을 중단했습니다.")
                            temp_node = candidate
                            temp_node.name = rt.uniqueName("__UV_EXPORT_TEMP_")
                            rt.select(temp_node)
                            rt.setCommandPanelTaskMode(rt.Name("modify"))
                            rt.subObjectLevel = 0
                            uv_modifier = next(
                                (
                                    modifier
                                    for modifier in temp_node.modifiers
                                    if rt.classOf(modifier) == rt.Unwrap_UVW
                                ),
                                None,
                            )
                            if uv_modifier is None:
                                uv_modifier = rt.Unwrap_UVW()
                                rt.addModifier(temp_node, uv_modifier)
                            rt.modPanel.setCurrentObject(uv_modifier)
                            uv_modifier.renderuv_width = resolution
                            uv_modifier.renderuv_height = resolution
                            uv_modifier.renderuv_showframebuffer = False
                            image_path = Path(staging) / "template_{}.png".format(index)
                            uv_modifier.renderUV(str(image_path))
                            if not image_path.is_file():
                                raise RuntimeError("PNG 파일이 생성되지 않았습니다.")
                            if image_path.stat().st_size <= 0:
                                raise RuntimeError("PNG 파일이 비어 있습니다.")
                            output_path = _publish_png(image_path, folder, name, resolution)
                            successes += 1
                            report("[{}px] 저장: {}".format(resolution, output_path))
                        except Exception as exc:
                            failures += 1
                            report("{} 출력 실패: {}".format(name, exc))
                        finally:
                            if temp_node is not None and rt.isValidNode(temp_node):
                                # If deletion fails, abort the batch and let
                                # the undo context roll back its scene edits.
                                rt.delete(temp_node)
                            temp_node = None
        except Exception as exc:
            stopped = True
            report("UV 출력을 중단했습니다: {}".format(exc))
        finally:
            # Also retry after undo rollback or failure to enter/leave a context.
            if temp_node is not None:
                def remove_temp():
                    if rt.isValidNode(temp_node):
                        rt.delete(temp_node)

                restore("임시 복사본 정리", remove_temp)
            restore("PNG 알파 설정", lambda: rt.pngio.setAlpha(state["alpha"]))
            restore("PNG 형식 설정", lambda: rt.pngio.setType(state["type"]))

            def restore_selection():
                remaining = [node for node in selection if rt.isValidNode(node)]
                if remaining:
                    rt.select(rt.Array(*remaining))
                else:
                    rt.clearSelection()

            restore("선택", restore_selection)
            restore("명령 패널", lambda: rt.setCommandPanelTaskMode(state["panel"]))
            if state["panel"] == rt.Name("modify") and state["current"] is not None:
                restore("현재 모디파이어", lambda: rt.modPanel.setCurrentObject(state["current"]))
            if state["level"] is not None:
                restore("하위 오브젝트 단계", lambda: setattr(rt, "subObjectLevel", state["level"]))

        summary = "{}개 저장 · {}개 실패.".format(successes, failures)
        skipped = len(selection) - len(targets)
        if skipped:
            summary += "\n지오메트리가 아닌 {}개를 제외했습니다.".format(skipped)
        if stopped:
            summary += "\n출력이 중단되었습니다. 상세 기록을 확인하세요."
        if restoration_warnings:
            summary += "\n일부 설정을 복원하지 못했습니다. 상세 기록을 확인하세요."
        return {"summary": summary, "details": details}
