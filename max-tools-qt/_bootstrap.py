"""Load this extracted copy without requiring installation or sys.path changes."""
import hashlib
import importlib
import importlib.util
from pathlib import Path
import sys


def launch(tool=None):
    package = Path(__file__).resolve().parent / 'penumbra_qt'
    # Updated bundles receive a new namespace; existing tool windows can close
    # cleanly while re-running a launcher loads the updated Python sources.
    digest = hashlib.sha256(str(package).encode('utf-8'))
    for source in sorted(package.glob('*.py')):
        digest.update(source.name.encode('utf-8'))
        digest.update(source.read_bytes())
    name = '_penumbra_max_qt_' + digest.hexdigest()[:16]
    if name not in sys.modules:
        spec = importlib.util.spec_from_file_location(name, package / '__init__.py', submodule_search_locations=[str(package)])
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        try:
            spec.loader.exec_module(module)
        except BaseException:
            sys.modules.pop(name, None)
            raise
    ui = importlib.import_module(name + '.app')
    return ui.show_tool(tool) if tool else ui.show_launcher()
