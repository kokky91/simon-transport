import logging

from app.core.event_bus import publish_event
from app.services.event_factory import market_price_updated

logger = logging.getLogger(__name__)


def publish_market_price_update(tenant_id: str, crop_id: str, new_price: float, trace_id: str) -> dict:
    event = market_price_updated(tenant_id=tenant_id, crop_id=crop_id, new_price=new_price, trace_id=trace_id)
    logger.info(
        "Publishing event",
        extra={
            "traceId": trace_id,
            "tenantId": tenant_id,
            "eventType": event["type"],
            "service": "api",
        },
    )
    publish_event(event)
    return event
