from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class AISettings:
    provider: str
    base_url: str
    default_model: str
    api_key: str
    default_temperature: float
    request_timeout_seconds: float


def get_ai_settings() -> AISettings:
    provider = (settings.AI_PROVIDER or "ollama").strip().lower()
    base_url = (settings.AI_BASE_URL or "").strip()
    default_model = (settings.AI_MODEL or "").strip()
    api_key = (settings.AI_API_KEY or "").strip()

    return AISettings(
        provider=provider,
        base_url=base_url,
        default_model=default_model,
        api_key=api_key,
        default_temperature=0.2,
        request_timeout_seconds=60.0,
    )
