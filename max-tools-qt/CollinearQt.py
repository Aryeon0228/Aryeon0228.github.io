from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parent / "_bootstrap.py"))["launch"]('collinear')
