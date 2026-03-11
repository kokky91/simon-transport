from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent

REQUIRED_FILES = {
    ROOT / "bootstrap.py",
    ROOT / "main.py",
    ROOT / "dispatcher.py",
    ROOT / "schema_validation.py",
    ROOT / "pipelines" / "plant_pipeline.py",
}

FORBIDDEN_FILES = {
    ROOT / "legacy_imports.py",
    ROOT / "old_bootstrap.py",
    ROOT / "temp_pipeline.py",
}

FILES_REQUIRING_BOOTSTRAP = [
    ROOT / "main.py",
    ROOT / "dispatcher.py",
    ROOT / "schema_validation.py",
    ROOT / "pipelines" / "plant_pipeline.py",
]

STATIC_APP_IMPORT_PATTERN = re.compile(r"^\s*(from|import)\s+app\.", re.MULTILINE)
RELATIVE_IMPORT_PATTERN = re.compile(r"^\s*from\s+\.+", re.MULTILINE)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _validate_file(path: Path) -> list[str]:
    errors: list[str] = []
    content = _read_text(path)

    if "from bootstrap import ensure_api_import_path" not in content:
        errors.append("missing bootstrap import")

    bootstrap_call_count = content.count("ensure_api_import_path()")
    if bootstrap_call_count != 1:
        errors.append(f"ensure_api_import_path() must appear exactly once, found {bootstrap_call_count}")

    if STATIC_APP_IMPORT_PATTERN.search(content):
        errors.append("contains static app.* import; use dynamic importlib loading")

    if RELATIVE_IMPORT_PATTERN.search(content):
        errors.append("contains relative import; use absolute imports with bootstrap")

    return errors


def main() -> int:
    all_errors: list[str] = []

    for file_path in sorted(REQUIRED_FILES):
        if not file_path.is_file():
            all_errors.append(f"missing required file: {file_path.relative_to(ROOT)}")

    for file_path in sorted(FORBIDDEN_FILES):
        if file_path.exists():
            all_errors.append(f"forbidden legacy file present: {file_path.relative_to(ROOT)}")

    for file_path in FILES_REQUIRING_BOOTSTRAP:
        if not file_path.is_file():
            all_errors.append(f"{file_path}: file not found")
            continue

        file_errors = _validate_file(file_path)
        for err in file_errors:
            all_errors.append(f"{file_path.relative_to(ROOT)}: {err}")

    if all_errors:
        print("Extractor consistency check failed:")
        for err in all_errors:
            print(f"- {err}")
        return 1

    print("Extractor consistency check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
