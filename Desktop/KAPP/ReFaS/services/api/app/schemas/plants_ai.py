from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PlantAIPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plant_name: str = Field(default="n.v.t.", min_length=1, max_length=120)
    scientific_name: str = Field(default="n.v.t.", min_length=1, max_length=200)
    category: str = Field(default="n.v.t.", min_length=1, max_length=120)
    growing_days: int | None = Field(default=None, ge=0, le=3650)
    plants_per_m2: float | None = Field(default=None, ge=0)
    plants_per_m2_source: Literal["ai", "calculated", "fallback"] | None = Field(default=None)
    expected_yield: str = Field(default="n.v.t.", min_length=1, max_length=200)
    yield_min_kg_per_m2: float | None = Field(default=None, ge=0)
    yield_max_kg_per_m2: float | None = Field(default=None, ge=0)
    yield_unit: str | None = Field(default=None, max_length=50)
    grow_time: str = Field(default="n.v.t.", min_length=1, max_length=200)
    harvest_time: str = Field(default="n.v.t.", min_length=1, max_length=200)
    harvest_method: str = Field(default="n.v.t.", min_length=1, max_length=200)
    water_need: str = Field(default="n.v.t.", min_length=1, max_length=200)
    notes: str = Field(default="n.v.t.", min_length=1, max_length=2000)


class PlantAIStatusPayload(BaseModel):
    ai_status: Literal["ok", "fallback", "timeout"] = "ok"
