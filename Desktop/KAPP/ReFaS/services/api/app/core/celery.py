import os
from logging import getLogger

from celery import Celery

from app.core.logging_config import configure_logging

configure_logging()
logger = getLogger(__name__)

celery = Celery(
    "farmplatform",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)


@celery.task(name="health.ping")
def ping(trace_id: str = "worker-health") -> str:
    logger.info(
        "Worker ping",
        extra={
            "traceId": trace_id,
            "tenantId": "system",
            "eventType": "WORKER_HEALTH_PING",
            "service": "worker",
        },
    )
    return "pong"
