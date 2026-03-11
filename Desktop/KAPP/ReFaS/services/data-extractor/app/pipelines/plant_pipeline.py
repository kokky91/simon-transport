import io
import importlib
import re
from typing import Any

from pypdf import PdfReader

from bootstrap import ensure_api_import_path

ensure_api_import_path()

_ai_assets = importlib.import_module("app.services.ai.assets")
_ai_client = importlib.import_module("app.services.ai.client")

AIAssetError = _ai_assets.AIAssetError
render_prompt = _ai_assets.render_prompt
AIClientError = _ai_client.AIClientError
AIInvalidJSONError = _ai_client.AIInvalidJSONError
generate_json = _ai_client.generate_json
generate_text = _ai_client.generate_text

from schema_validation import PayloadValidationError, validate_plant_payload


def _resolve_ai_status_from_error(error: Exception) -> str:
    detail = str(error).lower()
    if "timed out" in detail or "timeout" in detail:
        return "timeout"
    return "fallback"


def _build_summary_prompt(plant_name: str, text_snippet: str) -> str:
    try:
        return render_prompt(
            "plants-summary.nl.txt",
            plant_name=plant_name,
            text_snippet=text_snippet,
        )
    except AIAssetError as exc:
        raise RuntimeError(f"Samenvattingsprompt niet beschikbaar: {exc}") from exc


def _build_prefill_prompt(plant_name: str, text_snippet: str) -> str:
    try:
        return render_prompt(
            "plants-prefill.nl.txt",
            plant_name=plant_name,
            text_snippet=text_snippet,
        )
    except AIAssetError as exc:
        raise RuntimeError(f"Prefill-prompt niet beschikbaar: {exc}") from exc


def _extract_pdf_text(file_data: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_data))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text.strip())
    return "\n\n".join(pages).strip()


def _normalize_text(text: str) -> str:
    if not text.strip():
        return ""
    cleaned = text.replace("\r\n", "\n")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _build_fallback_summary(extracted_text: str) -> str:
    lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
    if not lines:
        return "- Geen samenvatting beschikbaar (geen leesbare tekst in document)."

    bullets: list[str] = []
    for line in lines:
        cleaned = re.sub(r"\s+", " ", line).strip()
        if not cleaned:
            continue
        bullets.append(f"- {cleaned[:220]}")
        if len(bullets) == 5:
            break

    if not bullets:
        return "- Geen samenvatting beschikbaar op basis van het document."

    return "\n".join(bullets)


def process_plant_job(job: Any, repository: Any) -> None:
    document = repository.get_plant_document(tenant_id=job.tenant_id, document_id=job.resource_id)
    if not document:
        raise RuntimeError("Plant document niet gevonden")

    file_data = document.get("file_data")
    if not isinstance(file_data, (bytes, bytearray)) or not file_data:
        raise RuntimeError("Plant document bevat geen bestand")

    extracted_text = _normalize_text(_extract_pdf_text(bytes(file_data)))
    if not extracted_text:
        raise RuntimeError("Kon geen tekst uit PDF halen")

    plant_name = str(document.get("plant_name") or "").strip() or "Onbekende plant"
    model_override = str(job.payload.get("model") or "").strip() or None
    snippet = extracted_text[:8000]

    summary_prompt = _build_summary_prompt(plant_name=plant_name, text_snippet=snippet)
    try:
        ai_summary = generate_text(prompt=summary_prompt, model=model_override)
    except AIClientError:
        ai_summary = _build_fallback_summary(extracted_text)

    prefill_prompt = _build_prefill_prompt(plant_name=plant_name, text_snippet=snippet)
    ai_status = "ok"
    try:
        parsed = generate_json(prompt=prefill_prompt, model=model_override)
    except AIInvalidJSONError as exc:
        ai_status = _resolve_ai_status_from_error(exc)
        raise PayloadValidationError("AI returned invalid JSON") from exc
    except AIClientError as exc:
        ai_status = _resolve_ai_status_from_error(exc)
        raise PayloadValidationError(str(exc)) from exc

    if not isinstance(parsed, dict):
        raise PayloadValidationError("AI payload is not an object")

    validated_payload = validate_plant_payload(parsed, fallback_plant_name=plant_name)
    validated_payload["ai_status"] = ai_status

    repository.mark_job_succeeded(
        job_id=job.id,
        tenant_id=job.tenant_id,
        document_id=job.resource_id,
        extracted_text=extracted_text,
        ai_summary=ai_summary,
        ai_prefill=validated_payload,
    )
