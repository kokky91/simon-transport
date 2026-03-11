import json
import urllib.error
import urllib.request
from typing import Any

from app.services.ai.config import get_ai_settings
from app.services.ai.factory import AIProviderError, resolve_provider


class AIClientError(Exception):
    pass


class AIInvalidJSONError(AIClientError):
    pass


def generate_text(
    prompt: str,
    model: str | None = None,
    temperature: float | None = None,
) -> str:
    ai_settings = get_ai_settings()
    resolved_model = (model or ai_settings.default_model).strip()
    resolved_temperature = (
        temperature if isinstance(temperature, (float, int)) else ai_settings.default_temperature
    )

    if not resolved_model:
        raise AIClientError("AI model is not configured")
    if not ai_settings.base_url:
        raise AIClientError("AI base URL is not configured")

    provider = resolve_provider(ai_settings)
    try:
        return provider.generate(
            prompt=prompt,
            model=resolved_model,
            temperature=float(resolved_temperature),
        )
    except AIProviderError as exc:
        fallback_model = _resolve_fallback_model(
            provider=ai_settings.provider,
            base_url=ai_settings.base_url,
            timeout_seconds=ai_settings.request_timeout_seconds,
            failed_model=resolved_model,
            error_detail=str(exc),
        )
        if fallback_model:
            try:
                return provider.generate(
                    prompt=prompt,
                    model=fallback_model,
                    temperature=float(resolved_temperature),
                )
            except AIProviderError as retry_exc:
                raise AIClientError(str(retry_exc)) from retry_exc

        raise AIClientError(str(exc)) from exc


def generate_json(
    prompt: str,
    model: str | None = None,
    temperature: float | None = None,
) -> dict[str, Any] | list[Any]:
    text = generate_text(prompt=prompt, model=model, temperature=temperature)
    parsed = _parse_json_candidates(text)
    if parsed is None:
        raise AIInvalidJSONError("AI provider returned invalid JSON")
    return parsed


def get_ai_readiness(model: str | None = None) -> dict[str, Any]:
    ai_settings = get_ai_settings()
    resolved_model = (model or ai_settings.default_model).strip()

    if not resolved_model:
        return {
            "ready": False,
            "status": "not_ready",
            "provider": ai_settings.provider,
            "base_url": ai_settings.base_url,
            "model": resolved_model,
            "detail": "AI model is not configured",
        }
    if not ai_settings.base_url:
        return {
            "ready": False,
            "status": "not_ready",
            "provider": ai_settings.provider,
            "base_url": ai_settings.base_url,
            "model": resolved_model,
            "detail": "AI base URL is not configured",
        }

    try:
        provider = resolve_provider(ai_settings)
        ready, detail = provider.check_readiness(model=resolved_model)
    except AIProviderError as exc:
        return {
            "ready": False,
            "status": "not_ready",
            "provider": ai_settings.provider,
            "base_url": ai_settings.base_url,
            "model": resolved_model,
            "detail": str(exc),
        }

    fallback_model = None
    if not ready:
        fallback_model = _resolve_fallback_model(
            provider=ai_settings.provider,
            base_url=ai_settings.base_url,
            timeout_seconds=ai_settings.request_timeout_seconds,
            failed_model=resolved_model,
            error_detail=detail,
        )
        if fallback_model:
            ready, detail = provider.check_readiness(model=fallback_model)
            resolved_model = fallback_model
            if ready:
                detail = f"ready (fallback model '{fallback_model}')"

    return {
        "ready": ready,
        "status": "ready" if ready else "not_ready",
        "provider": ai_settings.provider,
        "base_url": ai_settings.base_url,
        "model": resolved_model,
        "detail": detail,
    }


def _resolve_fallback_model(
    provider: str,
    base_url: str,
    timeout_seconds: float,
    failed_model: str,
    error_detail: str,
) -> str | None:
    if provider.strip().lower() != "ollama":
        return None
    lowered_detail = error_detail.strip().lower()
    if "model" not in lowered_detail or "not found" not in lowered_detail:
        return None

    return _find_first_available_ollama_text_model(
        base_url=base_url,
        timeout_seconds=timeout_seconds,
        exclude={failed_model.strip().lower()},
    )


def _find_first_available_ollama_text_model(
    base_url: str,
    timeout_seconds: float,
    exclude: set[str],
) -> str | None:
    request = urllib.request.Request(
        url=f"{base_url.rstrip('/')}/api/tags",
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError):
        return None

    models = body.get("models") if isinstance(body, dict) else None
    if not isinstance(models, list):
        return None

    local_candidates: list[str] = []
    cloud_candidates: list[str] = []

    for entry in models:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if not isinstance(name, str):
            continue
        normalized = name.strip()
        lowered = normalized.lower()
        if not normalized:
            continue
        if lowered in exclude or lowered.split(":", 1)[0] in exclude:
            continue
        if "embed" in lowered:
            continue
        if "cloud" in lowered:
            cloud_candidates.append(normalized)
        else:
            local_candidates.append(normalized)

    if local_candidates:
        return local_candidates[0]
    if cloud_candidates:
        return cloud_candidates[0]

    return None


def _parse_json_candidates(text: str) -> dict[str, Any] | list[Any] | None:
    candidates = _build_json_candidates(text)
    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, (dict, list)):
            return parsed
    return None


def _build_json_candidates(text: str) -> list[str]:
    stripped = text.strip()
    candidates: list[str] = [stripped]

    if stripped.startswith("```") and stripped.endswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            candidates.append("\n".join(lines[1:-1]).strip())

    object_start = stripped.find("{")
    object_end = stripped.rfind("}")
    if object_start != -1 and object_end != -1 and object_end > object_start:
        candidates.append(stripped[object_start : object_end + 1].strip())

    array_start = stripped.find("[")
    array_end = stripped.rfind("]")
    if array_start != -1 and array_end != -1 and array_end > array_start:
        candidates.append(stripped[array_start : array_end + 1].strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate and candidate not in seen:
            deduped.append(candidate)
            seen.add(candidate)

    return deduped
