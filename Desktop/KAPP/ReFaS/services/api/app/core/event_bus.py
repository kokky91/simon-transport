import json
import logging
import time

import redis
from pydantic import BaseModel
from pydantic import ValidationError

from app.core.metrics import EVENT_PUBLISH_LATENCY_SECONDS, EVENTS_PUBLISHED_TOTAL
from app.core.config import settings
from app.schemas.event_registry import EVENT_MODELS

r = redis.Redis.from_url(settings.REDIS_URL)
logger = logging.getLogger(__name__)


def validate_event(event: dict) -> BaseModel:
    if not isinstance(event, dict):
        raise ValueError("Invalid event structure")

    event_type = event.get("type")
    if event_type not in EVENT_MODELS:
        raise ValueError(f"Unsupported event type: {event_type}")

    model = EVENT_MODELS[event_type]

    try:
        return model.model_validate(event)
    except ValidationError as exc:
        raise ValueError(f"Invalid event structure: {exc}") from exc


def publish_event(event: dict) -> None:
    validated_event = validate_event(event)
    event_dict = validated_event.model_dump(mode="json")
    publish_start = time.perf_counter()
    r.publish("events", json.dumps(event_dict))
    publish_duration = time.perf_counter() - publish_start

    EVENTS_PUBLISHED_TOTAL.labels(
        event_type=event_dict["type"],
        tenant_id=event_dict["tenantId"],
    ).inc()
    EVENT_PUBLISH_LATENCY_SECONDS.labels(event_type=event_dict["type"]).observe(publish_duration)

    logger.info(
        "Event published to Redis",
        extra={
            "traceId": event_dict["traceId"],
            "tenantId": event_dict["tenantId"],
            "eventType": event_dict["type"],
            "service": "api",
        },
    )
