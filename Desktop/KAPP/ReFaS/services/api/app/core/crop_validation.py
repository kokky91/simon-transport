from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Literal, TypedDict

WarningLevel = Literal["warning", "critical"]
ConfidenceLevel = Literal["high", "medium", "low"]


class CropDomainWarning(TypedDict):
    level: WarningLevel
    field: str
    message: str
    rule: str


@dataclass(frozen=True)
class CropRule:
    name: str
    check_fn: Callable[[dict], list[CropDomainWarning]]

    def run(self, data: dict) -> list[CropDomainWarning]:
        return self.check_fn(data)


def _to_float(value: object) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", ".").strip())
        except ValueError:
            return None
    return None


def _coalesce_numbers(*values: object) -> float | None:
    for value in values:
        parsed = _to_float(value)
        if parsed is not None:
            return parsed
    return None


def _parse_yield_kg_per_m2_from_text(value: object) -> tuple[float | None, float | None]:
    if not isinstance(value, str):
        return None, None

    match = re.search(r"(\d+(?:[\.,]\d+)?)\s*(?:[-–]\s*(\d+(?:[\.,]\d+)?))?\s*kg\s*(?:per|/)\s*m[²2]", value, flags=re.IGNORECASE)
    if not match:
        return None, None

    min_val = _to_float(match.group(1))
    max_val = _to_float(match.group(2)) if match.group(2) else min_val
    if min_val is None or max_val is None:
        return None, None
    if min_val > max_val:
        min_val, max_val = max_val, min_val
    return min_val, max_val


def _resolve_yield_range(data: dict) -> tuple[float | None, float | None]:
    min_val = _coalesce_numbers(data.get("yield_min_kg_per_m2"))
    max_val = _coalesce_numbers(data.get("yield_max_kg_per_m2"))

    if min_val is None and max_val is None:
        text_min, text_max = _parse_yield_kg_per_m2_from_text(data.get("expected_yield"))
        min_val, max_val = text_min, text_max

    if min_val is not None and max_val is None:
        max_val = min_val
    if max_val is not None and min_val is None:
        min_val = max_val

    if min_val is not None and max_val is not None and min_val > max_val:
        min_val, max_val = max_val, min_val

    return min_val, max_val


def _category_group(category: str) -> str:
    value = category.lower()

    if any(token in value for token in ["fruit tree", "tree", "boom", "orchard"]):
        return "fruit_tree"
    if any(token in value for token in ["root crop", "root", "cassava", "potato", "knol", "wortel"]):
        return "root_crop"
    if any(token in value for token in ["leafy", "lettuce", "spinach", "kale", "blad", "sla"]):
        return "leafy"
    if any(token in value for token in ["vine", "tomato", "pepper", "cucumber", "courgette", "fruiting"]):
        return "vine_fruiting"

    return "other"


def _warning(level: WarningLevel, field: str, message: str, rule: str) -> CropDomainWarning:
    return {
        "level": level,
        "field": field,
        "message": message,
        "rule": rule,
    }


def rule_tree_density(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    if _category_group(str(data.get("category") or "")) != "fruit_tree":
        return warnings

    density = _coalesce_numbers(data.get("plants_per_m2"))
    if density is None:
        return warnings

    if density > 1:
        warnings.append(_warning("critical", "plants_per_m2", "Dichtheid extreem hoog voor boomgewassen", "tree-density"))
    elif density > 0.5:
        warnings.append(_warning("warning", "plants_per_m2", "Dichtheid ongebruikelijk hoog voor boomgewassen", "tree-density"))

    return warnings


def rule_tree_growing_days(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    if _category_group(str(data.get("category") or "")) != "fruit_tree":
        return warnings

    min_days = _coalesce_numbers(data.get("growing_days_min"), data.get("growing_days"))
    if min_days is None:
        return warnings

    if min_days < 120:
        warnings.append(_warning("critical", "growing_days", "Groeiperiode is extreem kort voor boomgewassen", "tree-growing-days"))
    elif min_days < 200:
        warnings.append(_warning("warning", "growing_days", "Groeiperiode lijkt kort voor boomgewassen", "tree-growing-days"))

    return warnings


def rule_root_crop_density(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    if _category_group(str(data.get("category") or "")) != "root_crop":
        return warnings

    density = _coalesce_numbers(data.get("plants_per_m2"))
    if density is None:
        return warnings

    if density > 12:
        warnings.append(_warning("critical", "plants_per_m2", "Dichtheid extreem hoog voor wortel-/knolgewassen", "root-density"))
    elif density > 8:
        warnings.append(_warning("warning", "plants_per_m2", "Dichtheid hoog voor wortel-/knolgewassen", "root-density"))

    return warnings


def rule_leafy_density(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    if _category_group(str(data.get("category") or "")) != "leafy":
        return warnings

    density = _coalesce_numbers(data.get("plants_per_m2"))
    if density is None:
        return warnings

    if density > 45:
        warnings.append(_warning("critical", "plants_per_m2", "Dichtheid extreem hoog voor bladgewassen", "leafy-density"))
    elif density > 30:
        warnings.append(_warning("warning", "plants_per_m2", "Dichtheid hoog voor bladgewassen", "leafy-density"))

    return warnings


def rule_vine_density(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    if _category_group(str(data.get("category") or "")) != "vine_fruiting":
        return warnings

    density = _coalesce_numbers(data.get("plants_per_m2"))
    if density is None:
        return warnings

    if density > 12:
        warnings.append(_warning("critical", "plants_per_m2", "Dichtheid extreem hoog voor vruchtgewassen", "vine-density"))
    elif density > 8:
        warnings.append(_warning("warning", "plants_per_m2", "Dichtheid hoog voor vruchtgewassen", "vine-density"))

    return warnings


def rule_general_yield(data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []

    yield_min, yield_max = _resolve_yield_range(data)
    if yield_min is None and yield_max is None:
        return warnings

    high = yield_max if yield_max is not None else yield_min
    low = yield_min if yield_min is not None else yield_max

    if high is not None and high > 20:
        warnings.append(_warning("critical", "expected_yield", "Opbrengst extreem hoog; controleer eenheidsconversie", "yield-upper-bound"))
    elif high is not None and high > 15:
        warnings.append(_warning("warning", "expected_yield", "Opbrengst ligt hoog; controleer eenheden", "yield-upper-bound"))

    if _category_group(str(data.get("category") or "")) == "fruit_tree" and low is not None and low < 0.1:
        warnings.append(_warning("warning", "expected_yield", "Opbrengst ongebruikelijk laag voor boomgewassen", "yield-lower-bound"))

    return warnings


def rule_missing_yield_unit(data: dict) -> list[CropDomainWarning]:
    expected_yield = str(data.get("expected_yield") or "").strip()
    yield_unit = str(data.get("yield_unit") or "").strip()

    if not expected_yield:
        return []

    if re.search(r"\d", expected_yield) and not yield_unit:
        return [
            _warning("warning", "expected_yield", "Opbrengst bevat getallen zonder genormaliseerde eenheid", "yield-unit")
        ]

    return []


def rule_scientific_name_source(data: dict) -> list[CropDomainWarning]:
    source = str(data.get("scientific_name_source") or "").strip().lower()
    if source == "fallback_from_name":
        return [
            _warning("warning", "scientific_name", "Scientific name afgeleid uit plantnaam", "scientific-name-source")
        ]
    if source == "missing":
        return [
            _warning("critical", "scientific_name", "Scientific name ontbreekt of is niet binomiaal", "scientific-name-source")
        ]
    return []


RULES: list[CropRule] = [
    CropRule(name="tree-density", check_fn=rule_tree_density),
    CropRule(name="tree-growing-days", check_fn=rule_tree_growing_days),
    CropRule(name="root-density", check_fn=rule_root_crop_density),
    CropRule(name="leafy-density", check_fn=rule_leafy_density),
    CropRule(name="vine-density", check_fn=rule_vine_density),
    CropRule(name="yield-general", check_fn=rule_general_yield),
    CropRule(name="yield-unit", check_fn=rule_missing_yield_unit),
    CropRule(name="scientific-name-source", check_fn=rule_scientific_name_source),
]


def validate_crop_domain(prefill_data: dict) -> list[CropDomainWarning]:
    warnings: list[CropDomainWarning] = []
    for rule in RULES:
        warnings.extend(rule.run(prefill_data))

    unique: list[CropDomainWarning] = []
    seen: set[tuple[str, str, str]] = set()
    for warning in warnings:
        key = (warning["rule"], warning["field"], warning["message"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(warning)

    return unique


def compute_field_confidence(prefill_data: dict) -> dict[str, ConfidenceLevel]:
    confidence: dict[str, ConfidenceLevel] = {}

    scientific_source = str(prefill_data.get("scientific_name_source") or "").strip().lower()
    if scientific_source == "extracted":
        confidence["scientific_name"] = "high"
    elif scientific_source == "fallback_from_name":
        confidence["scientific_name"] = "medium"
    else:
        confidence["scientific_name"] = "low"

    density_source = str(prefill_data.get("plants_per_m2_source") or "").strip().lower()
    if density_source == "calculated":
        confidence["plants_per_m2"] = "high"
    elif density_source == "ai":
        confidence["plants_per_m2"] = "medium"
    else:
        confidence["plants_per_m2"] = "low"

    has_days_range = prefill_data.get("growing_days_min") is not None and prefill_data.get("growing_days_max") is not None
    has_days_value = prefill_data.get("growing_days") is not None
    if has_days_range:
        confidence["growing_days"] = "high"
    elif has_days_value:
        confidence["growing_days"] = "medium"
    else:
        confidence["growing_days"] = "low"

    has_yield_range = prefill_data.get("yield_min_kg_per_m2") is not None and prefill_data.get("yield_max_kg_per_m2") is not None
    has_yield_unit = bool(str(prefill_data.get("yield_unit") or "").strip())
    has_yield_text = bool(str(prefill_data.get("expected_yield") or "").strip())
    if has_yield_range and has_yield_unit:
        confidence["expected_yield"] = "high"
    elif has_yield_text:
        confidence["expected_yield"] = "medium"
    else:
        confidence["expected_yield"] = "low"

    return confidence


def _is_missing_critical_value(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        cleaned = value.strip().lower()
        return cleaned in {"", "n.v.t.", "nvt"}
    return False


def compute_overall_confidence_score(
    field_confidence: dict[str, ConfidenceLevel],
    prefill_data: dict | None = None,
) -> int:
    if not field_confidence:
        return 0

    weights = {
        "scientific_name": 25,
        "plants_per_m2": 20,
        "growing_days": 20,
        "expected_yield": 20,
        "water_need": 5,
        "harvest_method": 5,
        "grow_time": 5,
    }
    multipliers = {
        "high": 1.0,
        "medium": 0.6,
        "low": 0.3,
    }

    score = 0.0
    for field, weight in weights.items():
        level = field_confidence.get(field)
        if level is None:
            continue
        score += weight * multipliers.get(level, 0.3)

    penalties = 0.0
    data = prefill_data or {}

    scientific_source = str(data.get("scientific_name_source") or "").strip().lower()
    if scientific_source == "fallback_from_name":
        penalties += 5

    critical_fields = ["scientific_name", "plants_per_m2", "growing_days", "expected_yield"]
    if any(_is_missing_critical_value(data.get(field)) for field in critical_fields):
        penalties += 10

    yield_unit = str(data.get("yield_unit") or "").strip().lower()
    expected_yield = str(data.get("expected_yield") or "").strip()
    if expected_yield and re.search(r"\d", expected_yield) and not yield_unit:
        penalties += 5

    bounded = max(0, min(100, round(score - penalties)))
    return int(bounded)
