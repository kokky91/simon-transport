from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from app.services.ai.config import AISettings


class AIProviderError(Exception):
    pass


class TextProvider(Protocol):
    def generate(self, prompt: str, model: str, temperature: float) -> str:
        ...

    def check_readiness(self, model: str) -> tuple[bool, str]:
        ...


@dataclass
class OllamaTextProvider:
    base_url: str
    timeout_seconds: float

    def generate(self, prompt: str, model: str, temperature: float) -> str:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except TimeoutError as exc:
            raise AIProviderError("Ollama request timed out") from exc
        except urllib.error.HTTPError as exc:
            detail = ""
            try:
                raw = exc.read().decode("utf-8")
                parsed = json.loads(raw) if raw else {}
                if isinstance(parsed, dict):
                    detail_value = parsed.get("error") or parsed.get("detail")
                    if isinstance(detail_value, str):
                        detail = detail_value.strip()
            except Exception:
                detail = ""

            if exc.code == 404 and "model" in detail.lower() and "not found" in detail.lower():
                raise AIProviderError(f"Ollama model '{model}' not found") from exc

            raise AIProviderError(f"Ollama HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError("Ollama is not reachable") from exc
        except Exception as exc:
            if "timed out" in str(exc).lower():
                raise AIProviderError("Ollama request timed out") from exc
            raise AIProviderError("Ollama request failed") from exc

        text = str(body.get("response", "")).strip()
        if not text:
            raise AIProviderError("Ollama returned an empty response")
        return text

    def check_readiness(self, model: str) -> tuple[bool, str]:
        request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/api/tags",
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except TimeoutError:
            return False, "Ollama request timed out"
        except urllib.error.URLError:
            return False, "Ollama is not reachable"
        except Exception as exc:
            if "timed out" in str(exc).lower():
                return False, "Ollama request timed out"
            return False, "Ollama request failed"

        models = body.get("models") if isinstance(body, dict) else None
        if not isinstance(models, list):
            return False, "Ollama did not return model tags"

        names: set[str] = set()
        for entry in models:
            if isinstance(entry, dict):
                raw_name = entry.get("name")
                if isinstance(raw_name, str) and raw_name.strip():
                    name = raw_name.strip()
                    names.add(name)
                    names.add(name.split(":", 1)[0])

        if model not in names and model.split(":", 1)[0] not in names:
            return False, f"Model '{model}' not found in Ollama tags"

        return True, "ready"


@dataclass
class OpenAICompatibleTextProvider:
    base_url: str
    api_key: str
    timeout_seconds: float

    def generate(self, prompt: str, model: str, temperature: float) -> str:
        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }

        request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise AIProviderError("OpenAI-compatible endpoint is not reachable") from exc

        choices = body.get("choices")
        if not isinstance(choices, list) or not choices:
            raise AIProviderError("OpenAI-compatible endpoint returned no choices")

        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        text = str(content or "").strip()

        if not text:
            raise AIProviderError("OpenAI-compatible endpoint returned an empty response")
        return text

    def check_readiness(self, model: str) -> tuple[bool, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        request = urllib.request.Request(
            url=f"{self.base_url.rstrip('/')}/v1/models",
            headers=headers,
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code in {401, 403}:
                return False, "OpenAI-compatible endpoint unauthorized"
            return False, f"OpenAI-compatible endpoint HTTP {exc.code}"
        except urllib.error.URLError:
            return False, "OpenAI-compatible endpoint is not reachable"

        data = body.get("data") if isinstance(body, dict) else None
        if not isinstance(data, list):
            return False, "OpenAI-compatible endpoint returned invalid models payload"

        model_ids = {
            str(item.get("id")).strip()
            for item in data
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        if model_ids and model not in model_ids:
            return False, f"Model '{model}' not found on endpoint"

        return True, "ready"


def resolve_provider(settings: AISettings) -> TextProvider:
    provider = settings.provider
    if provider == "ollama":
        return OllamaTextProvider(
            base_url=settings.base_url,
            timeout_seconds=settings.request_timeout_seconds,
        )
    if provider in {"openai", "openai_compatible", "openai-compatible"}:
        return OpenAICompatibleTextProvider(
            base_url=settings.base_url,
            api_key=settings.api_key,
            timeout_seconds=settings.request_timeout_seconds,
        )
    raise AIProviderError(f"Unsupported AI provider: {provider}")
