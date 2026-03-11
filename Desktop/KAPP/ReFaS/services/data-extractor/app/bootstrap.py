import os
import sys
from pathlib import Path


def ensure_api_import_path() -> None:
    env_api_root = os.getenv("EXTRACTOR_API_ROOT", "").strip()
    candidates: list[Path] = []

    if env_api_root:
        candidates.append(Path(env_api_root))

    candidates.extend(
        [
            Path("/api"),
            Path("/services/api"),
            Path(__file__).resolve().parents[2] / "api",
        ]
    )

    for candidate in candidates:
        if candidate.is_dir() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))
            return
