from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BaseEventModel(BaseModel):
    version: Literal[1]
    timestamp: datetime
    traceId: str = Field(min_length=1)
    tenantId: str = Field(min_length=1)


class MarketPriceUpdatedPayload(BaseModel):
    cropId: str = Field(min_length=1)
    newPrice: float


class MarketPriceUpdatedEvent(BaseEventModel):
    type: Literal["MARKET_PRICE_UPDATED"]
    payload: MarketPriceUpdatedPayload


class CompostProducedPayload(BaseModel):
    entityId: str = Field(min_length=1)
    resource: str = Field(min_length=1)
    producedAmount: int = Field(ge=1)
    totalStored: int = Field(ge=0)


class CompostProducedEvent(BaseEventModel):
    type: Literal["COMPOST_PRODUCED"]
    payload: CompostProducedPayload


class InfraAssetHighlightPayload(BaseModel):
    assetId: str = Field(min_length=1)
    assetType: Literal["field", "building"]
    intensity: float = Field(default=1.0, ge=0, le=1)


class InfraAssetHighlightEvent(BaseEventModel):
    type: Literal["INFRA_ASSET_HIGHLIGHT"]
    payload: InfraAssetHighlightPayload


class PlantExtractionQueuedPayload(BaseModel):
    documentId: str = Field(min_length=1)
    jobId: str = Field(min_length=1)


class PlantExtractionQueuedEvent(BaseEventModel):
    type: Literal["PLANT_EXTRACTION_QUEUED"]
    payload: PlantExtractionQueuedPayload


class PlantExtractionStartedPayload(BaseModel):
    documentId: str = Field(min_length=1)
    jobId: str = Field(min_length=1)


class PlantExtractionStartedEvent(BaseEventModel):
    type: Literal["PLANT_EXTRACTION_STARTED"]
    payload: PlantExtractionStartedPayload


class PlantExtractionSucceededPayload(BaseModel):
    documentId: str = Field(min_length=1)
    jobId: str = Field(min_length=1)


class PlantExtractionSucceededEvent(BaseEventModel):
    type: Literal["PLANT_EXTRACTION_SUCCEEDED"]
    payload: PlantExtractionSucceededPayload


class PlantExtractionFailedPayload(BaseModel):
    documentId: str = Field(min_length=1)
    jobId: str = Field(min_length=1)
    status: Literal["failed", "deadletter"]
    retryCount: int = Field(ge=0)
    maxRetries: int = Field(ge=1)
    error: str = Field(min_length=1, max_length=2000)


class PlantExtractionFailedEvent(BaseEventModel):
    type: Literal["PLANT_EXTRACTION_FAILED"]
    payload: PlantExtractionFailedPayload
