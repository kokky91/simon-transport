from pydantic import BaseModel

class SimulationScenario(BaseModel):
    biomass_to_bsf: float | None = None
    compost_field: str | None = None
    sell_product: str | None = None
