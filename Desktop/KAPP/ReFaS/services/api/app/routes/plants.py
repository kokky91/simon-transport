from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.auth import get_current_user, require_role
from app.core.plant_web_enrichment import enrich_plant_by_name
import httpx
import logging

async def fetch_kew_reference(plant_name: str) -> dict:
    """
    Fetch plant data from Plants of the World Online (Kew).
    Returns dict with scientific_name, family, distribution (if available).
    """
    base_url = "http://powo.science.kew.org/api/2/search"
    params = {"q": plant_name, "perPage": 1}
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            if not results:
                logging.warning(f"Kew POWO: No results for {plant_name}")
                return {}
            item = results[0]
            return {
                "scientific_name": item.get("name", {}).get("scientificName", ""),
                "family": item.get("family", {}).get("name", ""),
                "distribution": item.get("distribution", {}).get("text", ""),
                "source": "Kew"
            }
    except Exception as e:
        logging.error(f"Kew POWO fetch failed for {plant_name}: {e}")
        return {}

router = APIRouter(prefix="/plants", tags=["plants"])

class ScrapeRequest(BaseModel):
    plant_name: str = Field(..., min_length=2, max_length=200, examples=["Vigna unguiculata"])

class ScrapeResponse(BaseModel):
    plant_name: str
    enriched: dict
    sources: list[str]

@router.post(
    "/scrape",
    response_model=ScrapeResponse,
    summary="Enrich plant data via web scraping (GBIF + Wikidata + PFAF + Kew)",
)
async def scrape_plant(
    body: ScrapeRequest,
    current_user: dict = Depends(require_role("editor")),
) -> ScrapeResponse:
    """
    Fetch publicly available plant data for a given scientific or common name.
    Returns a prefill dict suitable for the PlantIntakeForm.

    Sources consulted (in order, merged):
    - GBIF Species API  — taxonomy, family, climate zones, vernacular names
    - Wikidata SPARQL   — family confirmation, origin region
    - PFAF.org          — drought tolerance, N-fixing, soil type, harvest days
    - Kew/POWO          — scientific name, family, distribution

    Never raises 500 on partial failures — missing sources are skipped gracefully.
    """
    name = body.plant_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="plant_name must not be blank")

    enriched = enrich_plant_by_name({"plant_name": name})
    kew_data = await fetch_kew_reference(name)
    if kew_data:
        enriched["kew_scientific_name"] = kew_data.get("scientific_name")
        enriched["kew_family"] = kew_data.get("family")
        enriched["kew_distribution"] = kew_data.get("distribution")

    sources = []
    if enriched.get("scientific_name") and enriched.get("family"):
        sources.append("GBIF")
    if enriched.get("origin_region"):
        sources.append("Wikidata")
    if enriched.get("drought_tolerance") != "medium" or enriched.get("nitrogen_fixing"):
        sources.append("PFAF")
    if kew_data:
        sources.append("Kew")

    return ScrapeResponse(
        plant_name=name,
        enriched=enriched,
        sources=sources,
    )
from typing import Annotated, cast
import io
import hashlib
import json
import re
import time
from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pypdf import PdfReader
from psycopg2 import Error as Psycopg2Error
from pydantic import BaseModel, Field

from app.services.ai.assets import (
    AIAssetError,
    is_model_compatible_with_provider,
    is_supported_model,
    load_model_catalog,
    render_prompt,
)
from app.services.ai.client import AIClientError, AIInvalidJSONError, generate_json, generate_text
from app.services.ai.config import get_ai_settings
from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.event_bus import publish_event
from app.core.crop_validation import compute_field_confidence, compute_overall_confidence_score, validate_crop_domain
from app.core.plant_web_enrichment import validate_with_web_references
from app.core.plant_document_repository import PlantDocumentRepository
from app.schemas.plants_ai import PlantAIPayload
from app.services.event_factory import plant_extraction_queued

plant_document_repository = PlantDocumentRepository()

MAX_PDF_BYTES = 10 * 1024 * 1024

AI_STATUS_OK = "ok"
AI_STATUS_FALLBACK = "fallback"
AI_STATUS_TIMEOUT = "timeout"

AI_CONTRACT_KEYS = {
    "plant_name",
    "scientific_name",
    "category",
    "growing_days",
    "plants_per_m2",
    "plants_per_m2_source",
    "expected_yield",
    "yield_min_kg_per_m2",
    "yield_max_kg_per_m2",
    "yield_unit",
    "grow_time",
    "harvest_time",
    "harvest_method",
    "water_need",
    "notes",
}


class PlantDuplicateCheckRequest(BaseModel):
    plant_name: str = Field(min_length=1, max_length=120)
    scientific_name: str | None = Field(default=None, max_length=200)


class PlantGenerateCompareRequest(BaseModel):
    models: list[str] = Field(default_factory=list)
    prompt_version: str | None = Field(default=None, max_length=120)


class PlantApplyGenerationRequest(BaseModel):
    generation_id: str = Field(min_length=1, max_length=120)

PREFILL_KEY_ALIASES: dict[str, set[str]] = {
    "plant_name": {"plant_name", "plantname", "name", "crop_name", "crop"},
    "scientific_name": {"scientific_name", "scientificname", "botanical_name", "latin_name"},
    "category": {"category", "type", "crop_type", "plant_type", "life_cycle"},
    "growing_days": {"growing_days", "days", "growth_days", "maturity_days"},
    "grow_time": {"grow_time", "growing_period", "growing_time", "growth_period"},
    "harvest_time": {"harvest_time", "first_harvest", "harvest_period"},
    "plants_per_m2": {"plants_per_m2", "plants_per_m2_avg", "density", "density_per_m2"},
    "spacing_plant_cm": {"spacing_plant_cm", "plant_spacing_cm", "plant_spacing"},
    "spacing_row_cm": {"spacing_row_cm", "row_spacing_cm", "row_spacing"},
    "expected_yield": {"expected_yield", "yield", "average_yield"},
    "yield_min_kg_per_m2": {"yield_min_kg_per_m2", "yield_min", "min_yield_kg_per_m2"},
    "yield_max_kg_per_m2": {"yield_max_kg_per_m2", "yield_max", "max_yield_kg_per_m2"},
    "yield_unit": {"yield_unit", "yield_units", "yield_uom"},
    "water_need": {"water_need", "water_requirement", "water_requirements", "irrigation_need"},
    "harvest_method": {"harvest_method", "harvesting_method"},
    "notes": {"notes", "note", "remarks", "description", "summary"},
}


def _parse_review_payload(payload: str | None, fallback: dict) -> dict:
    if payload is None or not payload.strip():
        return fallback

    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Ongeldige JSON in reviewed_data") from exc

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="reviewed_data moet een JSON-object zijn")

    return parsed


def _clean_prefill_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", key.strip().lower()).strip("_")


def _extract_payload_container(payload: dict) -> dict:
    for container_key in ("prefill", "data", "result", "fields"):
        nested = payload.get(container_key)
        if isinstance(nested, dict):
            return nested
    return payload


def _canonicalize_prefill_payload(payload: dict) -> dict:
    source = _extract_payload_container(payload)
    normalized_items: dict[str, object] = {}

    for raw_key, value in source.items():
        if not isinstance(raw_key, str):
            continue
        cleaned = _clean_prefill_key(raw_key)
        normalized_items[cleaned] = value

    canonical: dict[str, object] = {}
    for target_key, aliases in PREFILL_KEY_ALIASES.items():
        for alias in aliases:
            if alias in normalized_items and normalized_items[alias] not in (None, ""):
                canonical[target_key] = normalized_items[alias]
                break

    return canonical if canonical else source


def _normalize_labeled_value(value: str) -> str:
    cleaned = value.strip()
    cleaned = re.sub(r"^(scientific\s*name|botanical\s*name|category|type|yield|water\s*need)\s*[:\-]\s*", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _format_binomial_case(candidate: str) -> str:
    parts = candidate.strip().split()
    if len(parts) < 2:
        return candidate.strip()
    genus = parts[0].capitalize()
    species = parts[1].lower()
    return f"{genus} {species}"


def _extract_binomial(text: str | None) -> str | None:
    if not text:
        return None

    normalized = _normalize_labeled_value(text)

    strict = re.search(r"\b([A-Z][a-z]+\s+[a-z\-]+)\b", normalized)
    if strict:
        return _format_binomial_case(strict.group(1))

    loose = re.search(r"\b([A-Za-z][a-zA-Z\-]+\s+[a-z\-]+)\b", normalized)
    if loose:
        return _format_binomial_case(loose.group(1))

    parenthesized = re.search(r"\(([A-Za-z][a-zA-Z\-]+\s+[a-z\-]+)\)", normalized)
    if parenthesized:
        return _format_binomial_case(parenthesized.group(1))

    return None


def _normalize_scientific_name_value(value: str, extracted_text: str, fallback_name: str) -> tuple[str, str]:
    cleaned = _normalize_labeled_value(value)
    extracted_from_value = _extract_binomial(cleaned)
    if extracted_from_value:
        return extracted_from_value, "extracted"

    extracted_from_text = _extract_scientific_name(extracted_text)
    if extracted_from_text:
        return _format_binomial_case(extracted_from_text), "extracted"

    extracted_from_name = _extract_binomial(fallback_name)
    if extracted_from_name:
        return extracted_from_name, "fallback_from_name"

    return fallback_name.strip(), "missing"


def _to_float(value: str) -> float | None:
    try:
        return float(value.replace(",", ".").strip())
    except ValueError:
        return None


def _format_decimal(value: float, max_decimals: int = 3) -> str:
    rendered = f"{value:.{max_decimals}f}".rstrip("0").rstrip(".")
    return rendered if rendered else "0"


def _normalize_extracted_document_text(text: str) -> str:
    if not text.strip():
        return ""

    normalized = text.replace("\r\n", "\n")
    normalized = re.sub(
        r"(?<!\n)([A-Z][A-Z\-\s]{2,}\([^\)]+\)\s*[—-]\s*Complete AI Database Sheet)",
        r"\n\1",
        normalized,
    )

    title_pattern = re.compile(
        r"([A-Z][A-Z\-\s]{2,}\([^\)]+\)\s*[—-]\s*Complete AI Database Sheet)",
        flags=re.IGNORECASE,
    )
    parts = title_pattern.split(normalized)
    if len(parts) < 3:
        return re.sub(r"\n{3,}", "\n\n", normalized).strip()

    preamble = parts[0].strip()
    deduped_blocks: list[str] = [preamble] if preamble else []
    seen_keys: set[str] = set()

    for index in range(1, len(parts), 2):
        title = parts[index].strip()
        body = parts[index + 1].strip() if index + 1 < len(parts) else ""
        scientific_match = re.search(r"\(([^\)]+)\)", title)
        key = scientific_match.group(1).strip().lower() if scientific_match else title.lower()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        block = f"{title}\n{body}".strip()
        if block:
            deduped_blocks.append(block)

    return re.sub(r"\n{3,}", "\n\n", "\n\n".join(deduped_blocks)).strip()


def _to_meters(value: float, unit: str) -> float:
    normalized = unit.strip().lower()
    if normalized == "cm":
        return value / 100
    if normalized == "mm":
        return value / 1000
    return value


def _to_centimeters(value: float, unit: str) -> float:
    normalized = unit.strip().lower()
    if normalized == "m":
        return value * 100
    if normalized == "mm":
        return value / 10
    return value


def _extract_spacing_metrics(text: str) -> tuple[float | None, float | None, float | None]:
    plant_match = re.search(
        r"(?:plant spacing|spacing between plants|plantafstand|afstand tussen planten)\s*[:\-]?\s*(\d+(?:[\.,]\d+)?)\s*(mm|cm|m)\b",
        text,
        flags=re.IGNORECASE,
    )
    row_match = re.search(
        r"(?:row spacing|rijafstand|spacing between rows|afstand tussen rijen)\s*[:\-]?\s*(\d+(?:[\.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[\.,]\d+)?)\s*)?(mm|cm|m)\b",
        text,
        flags=re.IGNORECASE,
    )

    if not plant_match or not row_match:
        return None, None, None

    plant_raw = _to_float(plant_match.group(1))
    row_raw_start = _to_float(row_match.group(1))
    row_raw_end = _to_float(row_match.group(2)) if row_match.group(2) else None
    plant_unit = plant_match.group(2)
    row_unit = row_match.group(3) if row_match.group(2) is None else row_match.group(4)

    if plant_raw is None or row_raw_start is None or row_unit is None:
        return None, None, None

    row_raw = (row_raw_start + row_raw_end) / 2 if row_raw_end is not None else row_raw_start
    plant_m = _to_meters(plant_raw, plant_unit)
    row_m = _to_meters(row_raw, row_unit)

    if plant_m <= 0 or row_m <= 0:
        return None, None, None

    plant_cm = round(_to_centimeters(plant_raw, plant_unit), 2)
    row_cm = round(_to_centimeters(row_raw, row_unit), 2)
    density = round(1 / (plant_m * row_m), 2)
    return plant_cm, row_cm, density


def _extract_density_from_spacing(text: str) -> float | None:
    _, _, density = _extract_spacing_metrics(text)
    return density


def _extract_day_range(text: str) -> tuple[int, int] | None:
    match = re.search(r"(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:days|dagen)\b", text, flags=re.IGNORECASE)
    if match:
        start = int(match.group(1))
        end = int(match.group(2))
        return (start, end) if start <= end else (end, start)

    single = re.search(
        r"(?:growing period|grow(?:ing)? time|groeitijd|groeiperiode)\s*[:\-]?\s*(\d{1,3})\s*(?:days|dagen)\b",
        text,
        flags=re.IGNORECASE,
    )
    if single:
        value = int(single.group(1))
        return value, value

    return None


def _extract_year_range_in_days(text: str) -> tuple[int, int] | None:
    year_range = re.search(
        r"(?:first\s*harvest|harvest|to\s*harvest|maturity|first\s*bearing)\s*[:\-]?\s*(\d+(?:[\.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[\.,]\d+)?)\s*)?(?:years?|yrs?|jaar|jaren)\b",
        text,
        flags=re.IGNORECASE,
    )
    if not year_range:
        return None

    min_year = _to_float(year_range.group(1))
    max_year = _to_float(year_range.group(2)) if year_range.group(2) else min_year
    if min_year is None or max_year is None:
        return None

    if min_year > max_year:
        min_year, max_year = max_year, min_year

    return round(min_year * 365), round(max_year * 365)


def _extract_single_spacing_range_meters(text: str) -> tuple[float, float] | None:
    match = re.search(
        r"(?:plant spacing|plantafstand)\s*[:\-]?\s*(\d+(?:[\.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[\.,]\d+)?)\s*)?(mm|cm|m|meter|meters)\b",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    min_raw = _to_float(match.group(1))
    max_raw = _to_float(match.group(2)) if match.group(2) else min_raw
    unit = match.group(3)
    if min_raw is None or max_raw is None:
        return None

    min_m = _to_meters(min_raw, unit)
    max_m = _to_meters(max_raw, unit)
    if min_m <= 0 or max_m <= 0:
        return None
    if min_m > max_m:
        min_m, max_m = max_m, min_m

    return min_m, max_m


def _extract_yield_range_kg_per_m2(text: str) -> tuple[float, float] | None:
    pattern = re.compile(
        r"(\d+(?:[\.,]\d+)?)\s*(?:[-–]|to)?\s*(\d+(?:[\.,]\d+)?)?\s*(tons?|tonnes?|t|kg|g)\s*(?:per|/)\s*(hectare|ha|m²|m2)",
        flags=re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return None

    min_raw = _to_float(match.group(1))
    max_raw = _to_float(match.group(2)) if match.group(2) else min_raw
    mass_unit = match.group(3).lower()
    area_unit = match.group(4).lower().replace("²", "2")

    if min_raw is None or max_raw is None:
        return None

    def to_kg(value: float) -> float:
        if mass_unit in {"ton", "tons", "tonne", "tonnes", "t"}:
            return value * 1000
        if mass_unit == "g":
            return value / 1000
        return value

    def to_per_m2(value_kg: float) -> float:
        if area_unit in {"hectare", "ha"}:
            return value_kg / 10000
        return value_kg

    min_kg_m2 = to_per_m2(to_kg(min_raw))
    max_kg_m2 = to_per_m2(to_kg(max_raw))
    if min_kg_m2 > max_kg_m2:
        min_kg_m2, max_kg_m2 = max_kg_m2, min_kg_m2
    return (min_kg_m2, max_kg_m2)


def _extract_scientific_name(text: str) -> str | None:
    match = re.search(r"\(([A-Z][a-z]+\s+[a-z\-]+)\)", text)
    if not match:
        return None
    return match.group(1).strip()


def _extract_pdf_text(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    chunks: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            chunks.append(page_text.strip())
    raw_text = "\n\n".join(chunks).strip()
    return _normalize_extracted_document_text(raw_text)


def _normalize_ai_summary(summary: str) -> str:
    cleaned = summary.strip()
    cleaned = cleaned.replace("\r\n", "\n")
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*(.*?)\*", r"\1", cleaned)
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]
    blocked_patterns = [
        r"\bai\b",
        r"\bdatabase\b",
        r"\bmodel\b",
        r"\bparser\b",
        r"\bextract",
    ]
    filtered_lines: list[str] = []
    for line in lines:
        lowered = line.lower()
        if any(re.search(pattern, lowered) for pattern in blocked_patterns):
            continue
        filtered_lines.append(line)

    normalized = "\n".join(filtered_lines).strip()
    return normalized or "- n.v.t."


def _extract_first_int(value: str) -> int | None:
    matches = re.findall(r"\d+", value)
    if not matches:
        return None
    try:
        return int(matches[0])
    except ValueError:
        return None


def _complete_prefill_values(
    prefill: dict,
    fallback_plant_name: str,
    extracted_text: str,
    ai_status: str = AI_STATUS_OK,
) -> dict:
    plant_name = str(prefill.get("plant_name") or fallback_plant_name).strip() or fallback_plant_name
    scientific_raw = str(prefill.get("scientific_name") or "").strip()
    scientific_name, scientific_name_source = _normalize_scientific_name_value(
        scientific_raw,
        extracted_text=extracted_text,
        fallback_name=plant_name,
    )

    category = _normalize_labeled_value(str(prefill.get("category") or "").strip()) or "n.v.t."

    grow_time = str(prefill.get("grow_time") or "").strip()
    day_range = _extract_day_range("\n".join([grow_time, extracted_text]))
    year_day_range = _extract_year_range_in_days(extracted_text)
    if year_day_range is not None:
        day_range = year_day_range
    growing_days = prefill.get("growing_days") if isinstance(prefill.get("growing_days"), int) else None
    growing_days_min = day_range[0] if day_range else None
    growing_days_max = day_range[1] if day_range else None
    if growing_days is None and growing_days_min is not None:
        growing_days = growing_days_min
    if growing_days is None and grow_time and year_day_range is None:
        growing_days = _extract_first_int(grow_time)
    if growing_days is None:
        growing_days = 30
    if day_range is not None:
        grow_time = (
            f"{day_range[0]}-{day_range[1]} dagen"
            if day_range[0] != day_range[1]
            else f"{day_range[0]} dagen"
        )
    elif not grow_time:
        grow_time = f"{growing_days} dagen"

    spacing_plant_cm, spacing_row_cm, spacing_density = _extract_spacing_metrics(extracted_text)
    plants_per_m2_min = spacing_density if spacing_density is not None else None
    plants_per_m2_max = spacing_density if spacing_density is not None else None

    if spacing_density is None:
        single_spacing_range_m = _extract_single_spacing_range_meters(extracted_text)
        if single_spacing_range_m is not None:
            spacing_min_m, spacing_max_m = single_spacing_range_m
            spacing_avg_m = (spacing_min_m + spacing_max_m) / 2
            spacing_plant_cm = round(spacing_avg_m * 100, 2)
            spacing_row_cm = round(spacing_avg_m * 100, 2)
            spacing_density = round(1 / (spacing_avg_m * spacing_avg_m), 4)
            plants_per_m2_min = round(1 / (spacing_max_m * spacing_max_m), 4)
            plants_per_m2_max = round(1 / (spacing_min_m * spacing_min_m), 4)

    ai_plants_per_m2 = prefill.get("plants_per_m2") if isinstance(prefill.get("plants_per_m2"), (int, float)) else None
    plants_per_m2 = spacing_density if spacing_density is not None else ai_plants_per_m2
    plants_per_m2_source = "calculated" if spacing_density is not None else "ai"
    if plants_per_m2 is None:
        plants_per_m2 = 1.0
        plants_per_m2_source = "fallback"
    if plants_per_m2_min is None:
        plants_per_m2_min = float(plants_per_m2)
    if plants_per_m2_max is None:
        plants_per_m2_max = float(plants_per_m2)

    yield_candidates = "\n".join(
        [
            str(prefill.get("expected_yield") or ""),
            str(prefill.get("notes") or ""),
            extracted_text,
        ]
    )
    yield_range = _extract_yield_range_kg_per_m2(yield_candidates)
    if yield_range is not None:
        yield_min_kg_per_m2, yield_max_kg_per_m2 = yield_range
        expected_yield = (
            f"{_format_decimal(yield_min_kg_per_m2)}-{_format_decimal(yield_max_kg_per_m2)} kg per m²"
            if yield_max_kg_per_m2 != yield_min_kg_per_m2
            else f"{_format_decimal(yield_min_kg_per_m2)} kg per m²"
        )
    else:
        yield_min_kg_per_m2 = None
        yield_max_kg_per_m2 = None
        expected_yield = _normalize_labeled_value(str(prefill.get("expected_yield") or "").strip()) or "n.v.t."

    harvest_time = str(prefill.get("harvest_time") or "").strip() or f"Na {grow_time}"
    harvest_method = (
        str(prefill.get("harvest_method") or "").strip()
        or "n.v.t."
    )
    water_need = _normalize_labeled_value(str(prefill.get("water_need") or "").strip()) or "n.v.t."
    notes = _normalize_labeled_value(str(prefill.get("notes") or "").strip()) or "n.v.t."

    return {
        "ai_status": ai_status,
        "plant_name": plant_name,
        "scientific_name": scientific_name,
        "scientific_name_source": scientific_name_source,
        "category": category,
        "growing_days": growing_days,
        "growing_days_min": growing_days_min,
        "growing_days_max": growing_days_max,
        "spacing_plant_cm": spacing_plant_cm,
        "spacing_row_cm": spacing_row_cm,
        "plants_per_m2": float(plants_per_m2),
        "plants_per_m2_min": plants_per_m2_min,
        "plants_per_m2_max": plants_per_m2_max,
        "plants_per_m2_source": plants_per_m2_source,
        "expected_yield": expected_yield,
        "yield_min_kg_per_m2": yield_min_kg_per_m2,
        "yield_max_kg_per_m2": yield_max_kg_per_m2,
        "yield_unit": "kg per m²" if yield_range is not None else None,
        "grow_time": grow_time,
        "harvest_time": harvest_time,
        "harvest_method": harvest_method,
        "water_need": water_need,
        "notes": notes,
    }


def _resolve_model_override(model: str | None) -> str | None:
    ai_settings = get_ai_settings()
    model_override = model.strip() if model else None
    if not model_override:
        return None
    if model_override == ai_settings.default_model:
        return model_override
    if not is_supported_model(model_override):
        raise HTTPException(status_code=400, detail="Onbekend AI-model voor plants")
    return model_override


def _list_model_options() -> list[dict]:
    ai_settings = get_ai_settings()

    try:
        catalog = load_model_catalog()
    except AIAssetError as exc:
        if ai_settings.default_model:
            return [
                {
                    "value": ai_settings.default_model,
                    "label": f"{ai_settings.default_model} (actief)",
                    "recommended": True,
                    "compatible": True,
                }
            ]
        raise HTTPException(status_code=503, detail=f"Modelcatalogus niet beschikbaar: {exc}") from exc

    models = catalog.get("models") if isinstance(catalog, dict) else None
    if not isinstance(models, list):
        models = []

    options: list[dict] = []
    for item in models:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if not isinstance(model_id, str) or not model_id.strip():
            continue
        compatible = is_model_compatible_with_provider(model_id, ai_settings.provider)
        label_value = item.get("label")
        label = label_value.strip() if isinstance(label_value, str) and label_value.strip() else model_id.strip()
        options.append(
            {
                "value": model_id.strip(),
                "label": label,
                "recommended": bool(item.get("recommended", False)),
                "compatible": compatible,
            }
        )

    default_model = ai_settings.default_model
    if default_model:
        default_compatible = is_model_compatible_with_provider(default_model, ai_settings.provider)
        if not any(option.get("value") == default_model for option in options):
            options.insert(
                0,
                {
                    "value": default_model,
                    "label": f"{default_model} (actief)",
                    "recommended": True,
                    "compatible": default_compatible,
                },
            )

    return options


def _build_summary_prompt(plant_name: str, text_snippet: str) -> str:
    try:
        return render_prompt(
            "plants-summary.nl.txt",
            plant_name=plant_name,
            text_snippet=text_snippet,
        )
    except AIAssetError as exc:
        raise HTTPException(status_code=503, detail=f"Samenvattingsprompt niet beschikbaar: {exc}") from exc


def _build_prefill_prompt(plant_name: str, text_snippet: str) -> str:
    try:
        return render_prompt(
            "plants-prefill.nl.txt",
            plant_name=plant_name,
            text_snippet=text_snippet,
        )
    except AIAssetError as exc:
        raise HTTPException(status_code=503, detail=f"Prefill-prompt niet beschikbaar: {exc}") from exc


def _build_fallback_summary_from_text(extracted_text: str) -> str:
    lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
    if not lines:
        return "- Geen samenvatting beschikbaar (geen leesbare tekst in document)."

    bullets = []
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


def _resolve_ai_status_from_error(error: Exception) -> str:
    detail = str(error).lower()
    if "timed out" in detail or "timeout" in detail:
        return AI_STATUS_TIMEOUT
    return AI_STATUS_FALLBACK


def _merge_ai_status(*statuses: str) -> str:
    if AI_STATUS_TIMEOUT in statuses:
        return AI_STATUS_TIMEOUT
    if AI_STATUS_FALLBACK in statuses:
        return AI_STATUS_FALLBACK
    return AI_STATUS_OK


def _to_ai_contract_payload(parsed: dict, fallback_plant_name: str) -> PlantAIPayload:
    base_payload: dict[str, object] = {
        key: value
        for key, value in parsed.items()
        if key in AI_CONTRACT_KEYS
    }

    if not isinstance(base_payload.get("plant_name"), str) or not str(base_payload.get("plant_name")).strip():
        base_payload["plant_name"] = fallback_plant_name

    try:
        model_validate = getattr(PlantAIPayload, "model_validate", None)
        if callable(model_validate):
            return cast(PlantAIPayload, model_validate(base_payload))
        return cast(PlantAIPayload, PlantAIPayload.parse_obj(base_payload))
    except Exception:
        return PlantAIPayload(plant_name=fallback_plant_name)


def _parse_json_from_model_output(raw_text: str) -> dict:
    stripped = raw_text.strip()
    candidates: list[str] = [stripped]

    if stripped.startswith("```") and stripped.endswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            candidates.append("\n".join(lines[1:-1]).strip())

    object_start = stripped.find("{")
    object_end = stripped.rfind("}")
    if object_start != -1 and object_end != -1 and object_end > object_start:
        candidates.append(stripped[object_start : object_end + 1].strip())

    for candidate in candidates:
        if not candidate:
            continue
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return {}


def _is_valid_binomial(value: str) -> bool:
    return bool(re.match(r"^[A-Z][a-z]+\s+[a-z\-]+$", value.strip()))


def _compute_generation_confidence_score(payload: dict) -> float:
    checks = 0
    score = 0

    checks += 1
    scientific_name = str(payload.get("scientific_name") or "").strip()
    if _is_valid_binomial(scientific_name):
        score += 1

    checks += 1
    growing_days = payload.get("growing_days")
    if isinstance(growing_days, int) and 1 <= growing_days <= 3650:
        score += 1

    checks += 1
    spacing_ok = False
    spacing_plant = payload.get("spacing_plant_cm")
    spacing_row = payload.get("spacing_row_cm")
    plants_per_m2 = payload.get("plants_per_m2")
    if isinstance(spacing_plant, (int, float)) and spacing_plant > 0:
        spacing_ok = True
    if isinstance(spacing_row, (int, float)) and spacing_row > 0:
        spacing_ok = True
    if isinstance(plants_per_m2, (int, float)) and plants_per_m2 > 0:
        spacing_ok = True
    if spacing_ok:
        score += 1

    checks += 1
    y_min = payload.get("yield_min_kg_per_m2")
    y_max = payload.get("yield_max_kg_per_m2")
    if y_min is None and y_max is None:
        score += 1
    elif isinstance(y_min, (int, float)) and isinstance(y_max, (int, float)):
        if 0 <= y_min <= y_max <= 100:
            score += 1

    if checks == 0:
        return 0.0
    return round(score / checks, 4)


def _resolve_compare_models(requested_models: list[str]) -> list[str]:
    cleaned = [model.strip() for model in requested_models if model.strip()]
    unique_models: list[str] = []
    seen: set[str] = set()
    for model in cleaned:
        lowered = model.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_models.append(model)

    if unique_models:
        return unique_models

    options = _list_model_options()
    defaults = [str(option.get("value") or "").strip() for option in options if str(option.get("value") or "").strip()]
    unique_defaults: list[str] = []
    seen_defaults: set[str] = set()
    for model in defaults:
        lowered = model.lower()
        if lowered in seen_defaults:
            continue
        seen_defaults.add(lowered)
        unique_defaults.append(model)
    return unique_defaults[:2]


def _build_generation_diffs(generations: list[dict]) -> dict:
    fields_to_compare = [
        "scientific_name",
        "category",
        "growing_days",
        "plants_per_m2",
        "expected_yield",
        "yield_min_kg_per_m2",
        "yield_max_kg_per_m2",
        "yield_unit",
        "harvest_time",
        "water_need",
    ]

    field_diffs: list[dict] = []
    for field_name in fields_to_compare:
        values: dict[str, object] = {}
        canonical_values: set[str] = set()
        missing_count = 0
        numeric_values: list[float] = []
        for generation in generations:
            model_name = str(generation.get("model_name") or "unknown")
            payload = generation.get("normalized_payload") if isinstance(generation.get("normalized_payload"), dict) else {}
            value = payload.get(field_name) if isinstance(payload, dict) else None
            values[model_name] = value
            if value in (None, "", "n.v.t."):
                missing_count += 1
            if isinstance(value, (int, float)):
                numeric_values.append(float(value))
            canonical_values.add(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str))

        if len(canonical_values) > 1:
            if 0 < missing_count < len(values):
                conflict_type = "missing"
                severity = "yellow"
            elif len(numeric_values) >= 2 and max(numeric_values) > min(numeric_values):
                conflict_type = "range_conflict"
                severity = "yellow"
            else:
                conflict_type = "hard_conflict"
                severity = "red"

            field_diffs.append(
                {
                    "field": field_name,
                    "values": values,
                    "mismatch": True,
                    "conflict_type": conflict_type,
                    "severity": severity,
                }
            )

    unit_conflicts = [
        diff for diff in field_diffs if diff.get("field") in {"yield_unit", "expected_yield"}
    ]

    logical_conflicts: list[dict] = []
    growing_values = []
    for generation in generations:
        payload = generation.get("normalized_payload") if isinstance(generation.get("normalized_payload"), dict) else {}
        value = payload.get("growing_days") if isinstance(payload, dict) else None
        if isinstance(value, int):
            growing_values.append(value)
    if len(growing_values) >= 2 and (max(growing_values) - min(growing_values)) > 365:
        logical_conflicts.append(
            {
                "rule": "growing_days_spread",
                "message": "Groeidagen verschillen meer dan 365 dagen tussen modellen",
            }
        )

    density_values = []
    for generation in generations:
        payload = generation.get("normalized_payload") if isinstance(generation.get("normalized_payload"), dict) else {}
        value = payload.get("plants_per_m2") if isinstance(payload, dict) else None
        if isinstance(value, (int, float)) and value > 0:
            density_values.append(float(value))
    if len(density_values) >= 2 and (max(density_values) / min(density_values)) > 2.0:
        logical_conflicts.append(
            {
                "rule": "density_spread",
                "message": "Plantdichtheid verschilt meer dan factor 2 tussen modellen",
            }
        )

    return {
        "field_diffs": field_diffs,
        "unit_conflicts": unit_conflicts,
        "logical_conflicts": logical_conflicts,
    }


def _summarize_with_ai(plant_name: str, extracted_text: str, model_override: str | None = None) -> tuple[str, str]:
    snippet = extracted_text[:8000]
    prompt = _build_summary_prompt(plant_name=plant_name, text_snippet=snippet)
    try:
        summary = generate_text(prompt=prompt, model=model_override)
    except AIClientError as exc:
        fallback_summary = _build_fallback_summary_from_text(extracted_text)
        return fallback_summary, _resolve_ai_status_from_error(exc)

    if not summary:
        return _build_fallback_summary_from_text(extracted_text), AI_STATUS_FALLBACK
    return _normalize_ai_summary(summary), AI_STATUS_OK


def _prefill_with_ai(plant_name: str, extracted_text: str, model_override: str | None = None) -> tuple[dict, str]:
    snippet = extracted_text[:8000]
    prompt = _build_prefill_prompt(plant_name=plant_name, text_snippet=snippet)
    try:
        parsed = generate_json(prompt=prompt, model=model_override)
        ai_status = AI_STATUS_OK
    except AIInvalidJSONError:
        parsed = {}
        ai_status = AI_STATUS_FALLBACK
    except AIClientError as exc:
        parsed = {}
        ai_status = _resolve_ai_status_from_error(exc)
    if not isinstance(parsed, dict):
        parsed = {}
        ai_status = AI_STATUS_FALLBACK

    parsed = _canonicalize_prefill_payload(parsed)
    contract_payload = _to_ai_contract_payload(parsed, fallback_plant_name=plant_name)
    model_dump = getattr(contract_payload, "model_dump", None)
    raw_contract = model_dump() if callable(model_dump) else contract_payload.dict()
    normalized_contract = cast(dict[str, object], raw_contract)

    return (
        _complete_prefill_values(
            normalized_contract,
            fallback_plant_name=plant_name,
            extracted_text=extracted_text,
            ai_status=ai_status,
        ),
        ai_status,
    )


@router.post("/documents/prefill")
async def prefill_plant_document(
    plant_name: Annotated[str, Form(min_length=1, max_length=120)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    model: Annotated[str | None, Form()] = None,
    file: UploadFile = File(...),
) -> dict:
    _ = current_user
    normalized_name = plant_name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="plant_name is verplicht")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Alleen PDF-bestanden zijn toegestaan")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Bestand moet de extensie .pdf hebben")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Bestand is leeg")

    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Bestand overschrijdt de limiet van 10MB",
        )

    extracted_text = _extract_pdf_text(file_bytes)
    if not extracted_text:
        raise HTTPException(status_code=400, detail="Kon geen tekst uit PDF halen")

    model_override = _resolve_model_override(model)
    ai_summary, summary_status = _summarize_with_ai(normalized_name, extracted_text, model_override=model_override)
    prefill, prefill_status = _prefill_with_ai(normalized_name, extracted_text, model_override=model_override)
    prefill["ai_status"] = _merge_ai_status(summary_status, prefill_status)
    warnings = validate_crop_domain(prefill)
    field_confidence = compute_field_confidence(prefill)
    overall_confidence_score = compute_overall_confidence_score(field_confidence, prefill)
    external_validation = validate_with_web_references(prefill)

    return {
        "prefill": prefill,
        "warnings": warnings,
        "field_confidence": field_confidence,
        "overall_confidence_score": overall_confidence_score,
        "external_validation": external_validation,
        "ai_summary": ai_summary,
        "file_name": file.filename,
        "file_size_bytes": len(file_bytes),
    }


@router.get("/models")
def get_plant_ai_models(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    _ = current_user
    return {"models": _list_model_options()}


@router.post("/{document_id}/generate-compare")
def generate_compare_plant_document(
    document_id: str,
    payload: PlantGenerateCompareRequest,
    current_user: Annotated[CurrentUser, Depends(require_role("editor"))],
) -> dict:
    try:
        UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="document_id moet een geldige UUID zijn") from exc

    document = plant_document_repository.get_document_by_id(
        tenant_id=current_user.tenant_id,
        document_id=document_id,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Plantdocument niet gevonden")

    extracted_text = str(document.get("extracted_text") or "").strip()
    if not extracted_text:
        raise HTTPException(status_code=400, detail="Document bevat geen extraheerbare tekst")

    requested_models = _resolve_compare_models(payload.models)
    if len(requested_models) < 2:
        raise HTTPException(status_code=400, detail="Minimaal 2 modellen zijn vereist voor vergelijking")

    validated_models: list[str] = []
    for requested_model in requested_models:
        resolved = _resolve_model_override(requested_model)
        if resolved:
            validated_models.append(resolved)

    if len(validated_models) < 2:
        raise HTTPException(status_code=400, detail="Minimaal 2 geldige modellen zijn vereist")

    prompt_version = payload.prompt_version.strip() if payload.prompt_version else "plants-prefill.nl.txt"
    prompt = _build_prefill_prompt(
        plant_name=str(document.get("plant_name") or "Onbekend plant"),
        text_snippet=extracted_text[:8000],
    )
    prompt_hash_sha256 = hashlib.sha256(prompt.encode("utf-8")).hexdigest()

    generation_rows: list[dict] = []
    comparison_items: list[dict] = []
    generation_views: list[dict] = []

    for model_name in validated_models:
        started_at = time.perf_counter()
        raw_text = ""
        ai_status = AI_STATUS_OK
        parsed_dict: dict = {}

        try:
            raw_text = generate_text(prompt=prompt, model=model_name)
            parsed_dict = _parse_json_from_model_output(raw_text)
            if not parsed_dict:
                ai_status = AI_STATUS_FALLBACK
        except AIClientError as exc:
            ai_status = _resolve_ai_status_from_error(exc)

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        contract_payload = _to_ai_contract_payload(parsed_dict, fallback_plant_name=str(document.get("plant_name") or "Onbekend plant"))
        model_dump = getattr(contract_payload, "model_dump", None)
        raw_contract = model_dump() if callable(model_dump) else contract_payload.dict()
        normalized_contract = cast(dict[str, object], raw_contract)
        normalized_payload = _complete_prefill_values(
            normalized_contract,
            fallback_plant_name=str(document.get("plant_name") or "Onbekend plant"),
            extracted_text=extracted_text,
            ai_status=ai_status,
        )
        confidence_score = _compute_generation_confidence_score(normalized_payload)

        generation_row = plant_document_repository.create_ai_generation(
            tenant_id=current_user.tenant_id,
            plant_document_id=document_id,
            model_name=model_name,
            prompt_version=prompt_version,
            prompt_hash_sha256=prompt_hash_sha256,
            ai_status=ai_status,
            raw_response={"text": raw_text},
            normalized_payload=normalized_payload,
            latency_ms=latency_ms,
            confidence_score=confidence_score,
        )
        generation_rows.append(generation_row)

        comparison_items.append(
            {
                "generation_id": generation_row.get("id"),
                "model": model_name,
                "ai_status": ai_status,
                "confidence_score": confidence_score,
                "latency_ms": latency_ms,
                "prompt_version": prompt_version,
            }
        )
        generation_views.append(
            {
                "generation_id": generation_row.get("id"),
                "model": model_name,
                "ai_status": ai_status,
                "confidence_score": confidence_score,
                "latency_ms": latency_ms,
                "prompt_version": prompt_version,
                "normalized_payload": normalized_payload,
            }
        )

    diffs = _build_generation_diffs(generation_rows)

    return {
        "plant_document_id": document_id,
        "prompt_version": prompt_version,
        "prompt_hash_sha256": prompt_hash_sha256,
        "comparisons": comparison_items,
        "generations": generation_views,
        "diffs": diffs,
    }


@router.post("/{document_id}/apply-generation")
def apply_generation_to_plant_document(
    document_id: str,
    payload: PlantApplyGenerationRequest,
    current_user: Annotated[CurrentUser, Depends(require_role("ai_reviewer"))],
) -> dict:
    try:
        UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="document_id moet een geldige UUID zijn") from exc

    try:
        UUID(payload.generation_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="generation_id moet een geldige UUID zijn") from exc

    applied = plant_document_repository.apply_generation(
        tenant_id=current_user.tenant_id,
        plant_document_id=document_id,
        generation_id=payload.generation_id,
    )
    if not applied:
        raise HTTPException(status_code=404, detail="Generatie niet gevonden voor dit document")

    return applied


@router.get("/{plant_id}/versions")
def get_plant_versions(
    plant_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    limit: int = 20,
) -> dict:
    try:
        UUID(plant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="plant_id moet een geldige UUID zijn") from exc

    bounded_limit = max(1, min(limit, 100))
    versions = plant_document_repository.list_plant_versions(
        tenant_id=current_user.tenant_id,
        plant_id=plant_id,
        limit=bounded_limit,
    )

    if not versions:
        raise HTTPException(status_code=404, detail="Geen versies gevonden voor deze plant")

    return {
        "plant_id": plant_id,
        "count": len(versions),
        "versions": versions,
    }


@router.post("/documents/check-duplicate")
def check_duplicate_plant_document(
    payload: PlantDuplicateCheckRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    scientific_name = (payload.scientific_name or "").strip()
    if scientific_name and _is_valid_binomial(scientific_name):
        normalized_scientific_name = plant_document_repository.normalize_scientific_name(scientific_name)
        existing_plant = plant_document_repository.find_plant_by_scientific_name(
            tenant_id=current_user.tenant_id,
            scientific_name_normalized=normalized_scientific_name,
        )
        if existing_plant is not None:
            return {
                "duplicate": True,
                "existing_plant_id": existing_plant.get("id"),
                "existing_document": None,
            }

    existing = plant_document_repository.find_duplicate_document(
        tenant_id=current_user.tenant_id,
        plant_name=payload.plant_name.strip(),
        scientific_name=payload.scientific_name,
    )
    return {
        "duplicate": existing is not None,
        "existing_plant_id": None,
        "existing_document": existing,
    }


@router.post("/documents")
async def upload_plant_document(
    request: Request,
    plant_name: Annotated[str, Form(min_length=1, max_length=120)],
    current_user: Annotated[CurrentUser, Depends(require_role("ai_reviewer"))],
    model: Annotated[str | None, Form()] = None,
    reviewed_data: Annotated[str | None, Form()] = None,
    ai_prefill: Annotated[str | None, Form()] = None,
    ai_summary: Annotated[str | None, Form()] = None,
    file: UploadFile = File(...),
) -> dict:
    normalized_name = plant_name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="plant_name is verplicht")

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Alleen PDF-bestanden zijn toegestaan")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Bestandsnaam is verplicht")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Bestand moet de extensie .pdf hebben")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Bestand is leeg")

    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Bestand overschrijdt de limiet van 10MB",
        )

    model_override = _resolve_model_override(model)
    resolved_ai_summary = ai_summary.strip() if ai_summary else None
    resolved_prefill = _parse_review_payload(ai_prefill, fallback={})
    resolved_reviewed = _parse_review_payload(reviewed_data, fallback={"plant_name": normalized_name})

    scientific_name_raw = str(resolved_reviewed.get("scientific_name") or "").strip()
    if not _is_valid_binomial(scientific_name_raw):
        raise HTTPException(
            status_code=400,
            detail="scientific_name is verplicht en moet binomiaal zijn (bijv. Solanum lycopersicum)",
        )

    normalized_scientific_name = plant_document_repository.normalize_scientific_name(scientific_name_raw)
    active_version = plant_document_repository.get_active_plant_version_by_scientific_name(
        tenant_id=current_user.tenant_id,
        scientific_name_normalized=normalized_scientific_name,
    )

    existing_snapshot = active_version.get("snapshot_json") if active_version else None
    if isinstance(existing_snapshot, dict) and existing_snapshot == resolved_reviewed:
        raise HTTPException(
            status_code=409,
            detail="No content change detected; identieke payload wordt niet als nieuwe versie opgeslagen",
        )

    field_confidence = compute_field_confidence(resolved_reviewed)
    overall_confidence_score = compute_overall_confidence_score(field_confidence, resolved_reviewed)
    climate_zones_raw = resolved_reviewed.get("climate_zones")
    climate_zones = climate_zones_raw if isinstance(climate_zones_raw, list) else []
    soil_types_raw = resolved_reviewed.get("soil_types")
    soil_types = soil_types_raw if isinstance(soil_types_raw, list) else []
    ai_model_used = str(
        resolved_reviewed.get("ai_model_used")
        or resolved_prefill.get("ai_model_used")
        or (model_override or "")
    ).strip() or None
    prompt_version = str(
        resolved_reviewed.get("prompt_version")
        or resolved_prefill.get("prompt_version")
        or "plants-prefill.nl.txt"
    ).strip() or "plants-prefill.nl.txt"
    review_status = str(resolved_reviewed.get("review_status") or "reviewed").strip() or "reviewed"
    source_type = str(resolved_reviewed.get("source_type") or "pdf").strip() or "pdf"
    source_reference = str(resolved_reviewed.get("source_reference") or file.filename).strip() or file.filename

    try:
        document = plant_document_repository.create_document(
            tenant_id=current_user.tenant_id,
            plant_name=normalized_name,
            file_name=file.filename,
            content_type=file.content_type,
            file_size_bytes=len(file_bytes),
            file_data=file_bytes,
            extracted_text=None,
            ai_summary=resolved_ai_summary,
            ai_prefill=resolved_prefill,
            reviewed_data=resolved_reviewed,
        )
    except Psycopg2Error as exc:
        raise HTTPException(status_code=400, detail="Kon plantdocument niet opslaan") from exc

    try:
        version_result = plant_document_repository.create_plant_version(
            tenant_id=current_user.tenant_id,
            scientific_name=scientific_name_raw,
            snapshot_json=resolved_reviewed,
            confidence_score=overall_confidence_score,
            created_by=current_user.user_id,
            climate_zones=climate_zones,
            soil_types=soil_types,
            ai_model_used=ai_model_used,
            prompt_version=prompt_version,
            review_status=review_status,
            source_type=source_type,
            source_reference=source_reference,
            source_document_id=document["id"],
        )
    except (Psycopg2Error, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Kon plantversie niet opslaan") from exc

    try:
        extraction_job = plant_document_repository.enqueue_extraction_job(
            tenant_id=current_user.tenant_id,
            resource_type="plant",
            resource_id=document["id"],
            payload={"model": model_override} if model_override else {},
        )
    except (Psycopg2Error, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Kon extraction job niet enqueuen") from exc

    trace_id = getattr(request.state, "trace_id", str(uuid4()))
    try:
        publish_event(
            plant_extraction_queued(
                tenant_id=current_user.tenant_id,
                document_id=document["id"],
                job_id=extraction_job["id"],
                trace_id=trace_id,
            )
        )
    except Exception:
        pass

    return {
        "status": "saved",
        "document": document,
        "extraction_job": extraction_job,
        "plant": version_result["plant"],
        "plant_version": version_result["version"],
        "overall_confidence_score": overall_confidence_score,
    }


@router.get("/documents/{document_id}/extraction-status")
def get_plant_document_extraction_status(
    document_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    try:
        UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="document_id moet een geldige UUID zijn") from exc

    document = plant_document_repository.get_document_by_id(
        tenant_id=current_user.tenant_id,
        document_id=document_id,
    )
    if not document:
        raise HTTPException(status_code=404, detail="Plantdocument niet gevonden")

    job = plant_document_repository.get_extraction_job_for_resource(
        tenant_id=current_user.tenant_id,
        resource_type="plant",
        resource_id=document_id,
    )

    if not job:
        raise HTTPException(status_code=404, detail="Extraction job niet gevonden")

    return {"document_id": document_id, "extraction_job": job}
