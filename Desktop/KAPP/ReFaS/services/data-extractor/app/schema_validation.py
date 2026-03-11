from __future__ import annotations

import importlib
from typing import Any

from bootstrap import ensure_api_import_path


class PayloadValidationError(Exception):
    pass


ensure_api_import_path()

PlantAIPayload = importlib.import_module("app.schemas.plants_ai").PlantAIPayload


def validate_plant_payload(payload: dict[str, Any], fallback_plant_name: str) -> dict[str, Any]:
    candidate = dict(payload)
    if not isinstance(candidate.get("plant_name"), str) or not str(candidate.get("plant_name")).strip():
        candidate["plant_name"] = fallback_plant_name

    try:
        model_validate = getattr(PlantAIPayload, "model_validate", None)
        if callable(model_validate):
            validated = model_validate(candidate)
        else:
            validated = PlantAIPayload.parse_obj(candidate)
    except Exception as exc:
        raise PayloadValidationError(str(exc)) from exc

    model_dump = getattr(validated, "model_dump", None)
    if callable(model_dump):
        normalized = model_dump()
    else:
        dict_method = getattr(validated, "dict", None)
        if not callable(dict_method):
            raise PayloadValidationError("Validated payload cannot be serialized")
        normalized = dict_method()

    if not isinstance(normalized, dict):
        raise PayloadValidationError("Validated payload is not an object")

    return normalized
