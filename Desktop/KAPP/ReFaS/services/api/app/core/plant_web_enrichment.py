from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


REQUEST_TIMEOUT_SECONDS = 4


@dataclass
class ReferenceData:
    scientific_name: str | None = None
    growing_days_min: float | None = None
    growing_days_max: float | None = None
    spacing_plant_cm_min: float | None = None
    spacing_plant_cm_max: float | None = None
    spacing_row_cm_min: float | None = None
    spacing_row_cm_max: float | None = None


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _extract_binomial(text: str) -> str | None:
    match = re.search(r"\b([A-Z][a-z]+\s+[a-z][a-z\-]+)\b", text)
    if not match:
        return None
    parts = match.group(1).split()
    return f"{parts[0].capitalize()} {parts[1].lower()}"


def _http_get_json(url: str) -> dict[str, Any] | None:
    request = Request(url, headers={"User-Agent": "ReFaSPlantValidation/1.0"})
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            content = response.read().decode("utf-8")
    except (HTTPError, URLError, TimeoutError):
        return None

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def _fetch_wikipedia_reference(prefill: dict[str, Any]) -> tuple[ReferenceData, str]:
    reference = ReferenceData()
    scientific_name = str(prefill.get("scientific_name") or "").strip()
    plant_name = str(prefill.get("plant_name") or "").strip()

    titles = []
    if scientific_name:
        titles.append(scientific_name)
    if plant_name:
        titles.append(plant_name)

    for title in titles:
        summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(title)}"
        payload = _http_get_json(summary_url)
        if not payload:
            continue

        extract = str(payload.get("extract") or "")
        title_text = str(payload.get("title") or "")
        binomial = _extract_binomial(extract) or _extract_binomial(title_text)
        if binomial:
            reference.scientific_name = binomial
        # Optionally, parse more fields from Wikipedia extract if available
        # For now, only scientific_name is reliably parsed
        if reference.scientific_name:
            return reference, "wikipedia"
    return reference, "wikipedia"


def _openfarm_to_reference(item: dict[str, Any]) -> ReferenceData:
    attrs = item.get("attributes") if isinstance(item, dict) else None
    if not isinstance(attrs, dict):
        return ReferenceData()

    spread = _safe_float(attrs.get("spread"))
    row_spacing = _safe_float(attrs.get("row_spacing"))
    days = _safe_float(attrs.get("median_days_to_first_harvest"))
    binomial = attrs.get("binomial_name")

    reference = ReferenceData()
    if isinstance(binomial, str) and binomial.strip():
        reference.scientific_name = binomial.strip()

    if spread is not None:
        reference.spacing_plant_cm_min = max(1.0, spread * 0.85)
        reference.spacing_plant_cm_max = max(reference.spacing_plant_cm_min, spread * 1.15)

    if row_spacing is not None:
        reference.spacing_row_cm_min = max(1.0, row_spacing * 0.85)
        reference.spacing_row_cm_max = max(reference.spacing_row_cm_min, row_spacing * 1.15)

    if days is not None:
        reference.growing_days_min = max(1.0, days * 0.85)
        reference.growing_days_max = max(reference.growing_days_min, days * 1.15)

    return reference


def _fetch_openfarm_reference(prefill: dict[str, Any]) -> tuple[ReferenceData, str]:
    plant_name = str(prefill.get("plant_name") or "").strip()
    scientific_name = str(prefill.get("scientific_name") or "").strip()

    filters = [plant_name, scientific_name]
    for candidate in filters:
        if not candidate:
            continue
        url = f"https://openfarm.cc/api/v1/crops/?filter={quote(candidate)}"
        payload = _http_get_json(url)
        if not payload:
            continue

        data = payload.get("data")
        if not isinstance(data, list) or not data:
            continue

        for item in data:
            reference = _openfarm_to_reference(item)
            # Optionally, parse more fields from OpenFarm attributes if available
            # For now, only mapped fields in ReferenceData are parsed
            if any(
                value is not None
                for value in (
                    reference.scientific_name,
                    reference.growing_days_min,
                    reference.growing_days_max,
                    reference.spacing_plant_cm_min,
                    reference.spacing_plant_cm_max,
                    reference.spacing_row_cm_min,
                    reference.spacing_row_cm_max,
                )
            ):
                return reference, "openfarm"

    return ReferenceData(), "openfarm"


def _check_numeric_range(field: str, value: Any, minimum: float | None, maximum: float | None, source: str) -> dict[str, Any]:
    number = _safe_float(value)
    if number is None:
        return {
            "field": field,
            "status": "unverified",
            "source": source,
            "message": "Geen waarde om te vergelijken",
        }

    if minimum is None or maximum is None:
        return {
            "field": field,
            "status": "unverified",
            "source": source,
            "message": "Geen externe referentie gevonden",
        }

    if minimum <= number <= maximum:
        return {
            "field": field,
            "status": "confirmed",
            "source": source,
            "message": f"Bevestigd binnen referentie ({minimum:.0f}-{maximum:.0f})",
        }

    midpoint = (minimum + maximum) / 2
    deviation = abs(number - midpoint) / midpoint if midpoint > 0 else 1.0
    return {
        "field": field,
        "status": "conflict",
        "source": source,
        "deviation_pct": round(deviation * 100, 1),
        "message": f"Afwijking t.o.v. referentie ({minimum:.0f}-{maximum:.0f})",
    }


def _check_scientific_name(prefill: dict[str, Any], reference: ReferenceData, source: str) -> dict[str, Any]:
    candidate = str(prefill.get("scientific_name") or "").strip()
    if not candidate:
        return {
            "field": "scientific_name",
            "status": "unverified",
            "source": source,
            "message": "Geen scientific_name in payload",
        }

    if not reference.scientific_name:
        return {
            "field": "scientific_name",
            "status": "unverified",
            "source": source,
            "message": "Geen externe scientific_name beschikbaar",
        }

    if _normalized(candidate) == _normalized(reference.scientific_name):
        return {
            "field": "scientific_name",
            "status": "confirmed",
            "source": source,
            "message": f"Bevestigd ({reference.scientific_name})",
        }

    return {
        "field": "scientific_name",
        "status": "conflict",
        "source": source,
        "message": f"Verschil met referentie ({reference.scientific_name})",
    }


def _score(checks: list[dict[str, Any]]) -> int:
    if not checks:
        return 0

    weights = {"confirmed": 1.0, "unverified": 0.45, "conflict": 0.0}
    total = sum(weights.get(str(item.get("status")), 0.0) for item in checks)
    percentage = round((total / len(checks)) * 100)

    return min(95, max(0, int(percentage)))


def validate_with_web_references(prefill: dict[str, Any]) -> dict[str, Any]:
    wiki_reference, wiki_source = _fetch_wikipedia_reference(prefill)
    agr_reference, agr_source = _fetch_openfarm_reference(prefill)

    scientific_name_check = _check_scientific_name(prefill, wiki_reference, wiki_source)
    growing_days_check = _check_numeric_range(
        field="growing_days",
        value=prefill.get("growing_days"),
        minimum=agr_reference.growing_days_min,
        maximum=agr_reference.growing_days_max,
        source=agr_source,
    )
    spacing_plant_check = _check_numeric_range(
        field="spacing_plant_cm",
        value=prefill.get("spacing_plant_cm"),
        minimum=agr_reference.spacing_plant_cm_min,
        maximum=agr_reference.spacing_plant_cm_max,
        source=agr_source,
    )
    spacing_row_check = _check_numeric_range(
        field="spacing_row_cm",
        value=prefill.get("spacing_row_cm"),
        minimum=agr_reference.spacing_row_cm_min,
        maximum=agr_reference.spacing_row_cm_max,
        source=agr_source,
    )

    checks = [scientific_name_check, growing_days_check, spacing_plant_check, spacing_row_check]

    # Implementeer enriched met alle plantvelden
    enriched = {
        "scientific_name": wiki_reference.scientific_name or agr_reference.scientific_name or prefill.get("scientific_name"),
        "growing_days": agr_reference.growing_days_min or prefill.get("growing_days"),
        "spacing_plant_cm": agr_reference.spacing_plant_cm_min or prefill.get("spacing_plant_cm"),
        "spacing_row_cm": agr_reference.spacing_row_cm_min or prefill.get("spacing_row_cm"),
        # Voeg hier meer velden toe zoals genus, species, family, etc.
        "genus": prefill.get("genus"),
        "species": prefill.get("species"),
        "family": prefill.get("family"),
        "common_name_nl": prefill.get("common_name_nl"),
        "common_name_en": prefill.get("common_name_en"),
        "plant_type": prefill.get("plant_type"),
        "growth_form": prefill.get("growth_form"),
        "origin_region": prefill.get("origin_region"),
        "is_native": prefill.get("is_native"),
        "category": prefill.get("category"),
        # ... vul aan met alle gewenste plantvelden ...
    }

    return {
        "checks": checks,
        "confidence_score": _score(checks),
        "sources": [wiki_source, agr_source],
        **enriched,
    }

# Alias for compatibility with routes/plants.py
enrich_plant_by_name = validate_with_web_references
