from types import MappingProxyType
from typing import Mapping, Type

from pydantic import BaseModel

from app.schemas.events import (
    CompostProducedEvent,
    InfraAssetHighlightEvent,
    MarketPriceUpdatedEvent,
    PlantExtractionFailedEvent,
    PlantExtractionQueuedEvent,
    PlantExtractionStartedEvent,
    PlantExtractionSucceededEvent,
)

EVENT_MODELS: Mapping[str, Type[BaseModel]] = MappingProxyType(
    {
        "MARKET_PRICE_UPDATED": MarketPriceUpdatedEvent,
        "COMPOST_PRODUCED": CompostProducedEvent,
        "INFRA_ASSET_HIGHLIGHT": InfraAssetHighlightEvent,
        "PLANT_EXTRACTION_QUEUED": PlantExtractionQueuedEvent,
        "PLANT_EXTRACTION_STARTED": PlantExtractionStartedEvent,
        "PLANT_EXTRACTION_SUCCEEDED": PlantExtractionSucceededEvent,
        "PLANT_EXTRACTION_FAILED": PlantExtractionFailedEvent,
    }
)
