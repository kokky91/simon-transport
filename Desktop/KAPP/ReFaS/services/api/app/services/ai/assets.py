from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


class AIAssetError(Exception):
    pass


def _find_repo_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "services" / "ai").exists():
            return candidate
    raise AIAssetError("Could not resolve repository root for services/ai assets")


@lru_cache(maxsize=1)
def get_services_ai_root() -> Path:
    configured_root = os.getenv("AI_ASSETS_ROOT", "").strip()
    if configured_root:
        candidate = Path(configured_root).expanduser().resolve()
        if not candidate.exists():
            raise AIAssetError(f"AI_ASSETS_ROOT does not exist: {candidate}")
        if not candidate.is_dir():
            raise AIAssetError(f"AI_ASSETS_ROOT is not a directory: {candidate}")
        return candidate

    repo_root = _find_repo_root(Path(__file__).parent)
    services_ai_root = repo_root / "services" / "ai"
    if not services_ai_root.exists():
        raise AIAssetError("services/ai directory not found")
    return services_ai_root


def load_prompt_template(file_name: str) -> str:
    prompt_file = get_services_ai_root() / "prompts" / file_name
    if not prompt_file.exists():
        raise AIAssetError(f"Prompt template not found: {prompt_file}")
    return prompt_file.read_text(encoding="utf-8").strip()


def render_prompt(file_name: str, **values: Any) -> str:
    template = load_prompt_template(file_name)
    try:
        return template.format(**values)
    except KeyError as exc:
        raise AIAssetError(f"Missing prompt value for key: {exc.args[0]}") from exc


@lru_cache(maxsize=1)
def load_model_catalog() -> dict[str, Any]:
    catalog_file = get_services_ai_root() / "models" / "model-catalog.json"
    if not catalog_file.exists():
        raise AIAssetError(f"Model catalog not found: {catalog_file}")
    try:
        return json.loads(catalog_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise AIAssetError("Invalid JSON in model catalog") from exc


def get_supported_model_ids() -> set[str]:
    catalog = load_model_catalog()
    models = catalog.get("models") if isinstance(catalog, dict) else None
    if not isinstance(models, list):
        return set()
    model_ids: set[str] = set()
    for item in models:
        if isinstance(item, dict):
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id.strip():
                model_ids.add(model_id.strip())
    return model_ids


def is_supported_model(model: str) -> bool:
    try:
        supported = get_supported_model_ids()
    except AIAssetError:
        return True
    if not supported:
        return True
    return model.strip() in supported


def is_model_compatible_with_provider(model_id: str, provider: str) -> bool:
    normalized_provider = provider.strip().lower()
    normalized_model = model_id.strip().lower()

    if normalized_provider == "ollama":
        return "cloud" not in normalized_model

    return True
