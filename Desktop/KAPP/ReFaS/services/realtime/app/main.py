import asyncio
import json
import logging
import os
import time
from collections import defaultdict
from datetime import datetime
from types import MappingProxyType
from typing import Literal

import jwt
import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from pydantic import BaseModel, Field, ValidationError

from app.logging_config import configure_logging
from app.metrics import (
    EVENT_BROADCAST_LATENCY_SECONDS,
    EVENTS_BROADCAST_TOTAL,
    EVENTS_CONSUMED_TOTAL,
    WS_AUTH_REJECTIONS_TOTAL,
    WS_CONNECTIONS_ACTIVE,
    WS_CONNECTIONS_TOTAL,
    WS_RATE_LIMIT_REJECTIONS_TOTAL,
)
from app.rate_limit import ws_handshake_limiter
from app.telemetry import configure_telemetry

app = FastAPI(title="FarmPlatform Realtime")
app.mount("/metrics", make_asgi_app())
logger = logging.getLogger(__name__)

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
jwt_secret = os.getenv("JWT_SECRET", "supersecretkey")
jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
ws_handshake_rate_limit_per_minute = int(os.getenv("WS_HANDSHAKE_RATE_LIMIT_PER_MINUTE", "120"))
ws_max_connections_per_tenant = int(os.getenv("WS_MAX_CONNECTIONS_PER_TENANT", "200"))
ws_allowed_origins = {
    origin.strip()
    for origin in os.getenv(
        "WS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5175",
    ).split(",")
    if origin.strip()
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ws_allowed_origins) if "*" not in ws_allowed_origins else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
security_headers_enabled = os.getenv("SECURITY_HEADERS_ENABLED", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
hsts_enabled = os.getenv("HSTS_ENABLED", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
hsts_max_age_seconds = int(os.getenv("HSTS_MAX_AGE_SECONDS", "31536000"))
EVENTS_CHANNEL = "events"
connections: dict[str, set[WebSocket]] = defaultdict(set)


def _is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if "*" in ws_allowed_origins:
        return True
    return origin in ws_allowed_origins


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


EVENT_MODELS = MappingProxyType(
    {
        "MARKET_PRICE_UPDATED": MarketPriceUpdatedEvent,
        "COMPOST_PRODUCED": CompostProducedEvent,
        "INFRA_ASSET_HIGHLIGHT": InfraAssetHighlightEvent,
    }
)


def validate_event(event: dict) -> BaseEventModel:
    if not isinstance(event, dict):
        raise ValueError("Invalid event structure")

    event_type = event.get("type")
    if not isinstance(event_type, str):
        raise ValueError("Invalid event type")

    model = EVENT_MODELS.get(event_type)
    if model is None:
        raise ValueError(f"Unsupported event type: {event_type}")

    try:
        return model.model_validate(event)
    except ValidationError as exc:
        raise ValueError(f"Invalid event structure: {exc}") from exc


def _extract_websocket_token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    if query_token:
        return query_token

    authorization = websocket.headers.get("authorization")
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


async def _authenticate_websocket_tenant(websocket: WebSocket, websocket_tenant_id: str) -> str | None:
    token = _extract_websocket_token(websocket)
    if not token:
        WS_AUTH_REJECTIONS_TOTAL.inc()
        logger.warning(
            "WebSocket authentication failed: missing token",
            extra={
                "traceId": "n/a",
                "tenantId": websocket_tenant_id,
                "eventType": "WS_AUTH",
                "service": "realtime",
            },
        )
        await websocket.close(code=1008)
        return None

    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[jwt_algorithm])
    except jwt.PyJWTError:
        WS_AUTH_REJECTIONS_TOTAL.inc()
        logger.warning(
            "WebSocket authentication failed: invalid token",
            extra={
                "traceId": "n/a",
                "tenantId": websocket_tenant_id,
                "eventType": "WS_AUTH",
                "service": "realtime",
            },
        )
        await websocket.close(code=1008)
        return None

    claim_tenant_id = payload.get("tenantId") or payload.get("tenant_id")
    if not isinstance(claim_tenant_id, str) or not claim_tenant_id:
        WS_AUTH_REJECTIONS_TOTAL.inc()
        logger.warning(
            "WebSocket authentication failed: missing tenant claim",
            extra={
                "traceId": "n/a",
                "tenantId": websocket_tenant_id,
                "eventType": "WS_AUTH",
                "service": "realtime",
            },
        )
        await websocket.close(code=1008)
        return None

    if claim_tenant_id != websocket_tenant_id:
        WS_AUTH_REJECTIONS_TOTAL.inc()
        logger.warning(
            "WebSocket authentication failed: tenant mismatch",
            extra={
                "traceId": "n/a",
                "tenantId": websocket_tenant_id,
                "eventType": "WS_AUTH",
                "service": "realtime",
            },
        )
        await websocket.close(code=1008)
        return None

    return claim_tenant_id


async def _broadcast_event(validated_event: BaseEventModel) -> None:
    event_dict = validated_event.model_dump(mode="json")
    event_tenant_id = validated_event.tenantId

    for websocket_tenant_id, tenant_sockets in list(connections.items()):
        if event_tenant_id != websocket_tenant_id:
            continue

        for ws in list(tenant_sockets):
            try:
                await ws.send_json(event_dict)
                EVENTS_BROADCAST_TOTAL.labels(
                    event_type=event_dict["type"],
                    tenant_id=validated_event.tenantId,
                ).inc()
                logger.info(
                    "Broadcasted validated event",
                    extra={
                        "traceId": validated_event.traceId,
                        "tenantId": validated_event.tenantId,
                        "eventType": event_dict["type"],
                        "service": "realtime",
                    },
                )
            except Exception:
                connections[websocket_tenant_id].discard(ws)


async def _consume_events() -> None:
    client = redis.from_url(redis_url)
    pubsub = client.pubsub()
    await pubsub.subscribe(EVENTS_CHANNEL)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            raw_data = message.get("data")
            if isinstance(raw_data, bytes):
                raw_data = raw_data.decode("utf-8")
            try:
                event_dict = json.loads(raw_data)
            except json.JSONDecodeError:
                continue

            try:
                validated_event = validate_event(event_dict)
            except ValueError:
                continue

            event_process_start = time.perf_counter()
            event_type = event_dict.get("type", "UNKNOWN")
            EVENTS_CONSUMED_TOTAL.labels(
                event_type=event_type,
                tenant_id=validated_event.tenantId,
            ).inc()

            await _broadcast_event(validated_event)

            EVENT_BROADCAST_LATENCY_SECONDS.labels(event_type=event_type).observe(
                time.perf_counter() - event_process_start
            )
    finally:
        await pubsub.unsubscribe(EVENTS_CHANNEL)
        await pubsub.close()
        await client.close()


@app.on_event("startup")
async def startup() -> None:
    configure_logging()
    configure_telemetry("realtime")
    logger.info(
        "Realtime service startup",
        extra={
            "traceId": "system",
            "tenantId": "system",
            "eventType": "SERVICE_STARTUP",
            "service": "realtime",
        },
    )
    app.state.consumer_task = asyncio.create_task(_consume_events())


@app.on_event("shutdown")
async def shutdown() -> None:
    task = getattr(app.state, "consumer_task", None)
    if task:
        task.cancel()

    logger.info(
        "Realtime service shutdown",
        extra={
            "traceId": "system",
            "tenantId": "system",
            "eventType": "SERVICE_SHUTDOWN",
            "service": "realtime",
        },
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "realtime"}


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)

    if security_headers_enabled:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'self'"

        forwarded_proto = request.headers.get("x-forwarded-proto", "")
        is_https = request.url.scheme == "https" or "https" in forwarded_proto.lower().split(",")
        if hsts_enabled and is_https:
            response.headers["Strict-Transport-Security"] = f"max-age={hsts_max_age_seconds}; includeSubDomains"

    return response


@app.websocket("/ws/{tenant_id}")
async def websocket_endpoint(websocket: WebSocket, tenant_id: str) -> None:
    client_host = websocket.client.host if websocket.client else "unknown"
    origin = websocket.headers.get("origin")

    if not _is_origin_allowed(origin):
        WS_CONNECTIONS_TOTAL.labels(result="rejected", tenant_id=tenant_id).inc()
        logger.warning(
            "WebSocket rejected due to invalid origin",
            extra={
                "traceId": "n/a",
                "tenantId": tenant_id,
                "eventType": "WS_ORIGIN_REJECT",
                "service": "realtime",
                "origin": origin or "missing",
                "clientHost": client_host,
            },
        )
        await websocket.close(code=1008)
        return

    handshake_key = f"{tenant_id}:{client_host}"
    allowed, retry_after = ws_handshake_limiter.allow(
        key=handshake_key,
        limit=ws_handshake_rate_limit_per_minute,
        window_seconds=60,
    )
    if not allowed:
        WS_CONNECTIONS_TOTAL.labels(result="rejected", tenant_id=tenant_id).inc()
        WS_RATE_LIMIT_REJECTIONS_TOTAL.labels(reason="handshake_rate", tenant_id=tenant_id).inc()
        logger.warning(
            "WebSocket rejected due to handshake rate limit",
            extra={
                "traceId": "n/a",
                "tenantId": tenant_id,
                "eventType": "WS_RATE_LIMIT",
                "service": "realtime",
                "clientHost": client_host,
                "retryAfterSeconds": retry_after,
            },
        )
        await websocket.close(code=1008)
        return

    authenticated_tenant = await _authenticate_websocket_tenant(websocket, tenant_id)
    if not authenticated_tenant:
        WS_CONNECTIONS_TOTAL.labels(result="rejected", tenant_id=tenant_id).inc()
        return

    tenant_connections = len(connections.get(authenticated_tenant, set()))
    if tenant_connections >= ws_max_connections_per_tenant:
        WS_CONNECTIONS_TOTAL.labels(result="rejected", tenant_id=authenticated_tenant).inc()
        WS_RATE_LIMIT_REJECTIONS_TOTAL.labels(reason="max_connections", tenant_id=authenticated_tenant).inc()
        logger.warning(
            "WebSocket rejected due to tenant max connections",
            extra={
                "traceId": "n/a",
                "tenantId": authenticated_tenant,
                "eventType": "WS_RATE_LIMIT",
                "service": "realtime",
                "activeConnections": tenant_connections,
                "maxConnections": ws_max_connections_per_tenant,
            },
        )
        await websocket.close(code=1008)
        return

    await websocket.accept()
    WS_CONNECTIONS_TOTAL.labels(result="accepted", tenant_id=authenticated_tenant).inc()
    WS_CONNECTIONS_ACTIVE.labels(tenant_id=authenticated_tenant).inc()
    connections[authenticated_tenant].add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        WS_CONNECTIONS_ACTIVE.labels(tenant_id=authenticated_tenant).dec()
        connections[authenticated_tenant].discard(websocket)
