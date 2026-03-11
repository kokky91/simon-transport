from typing import Annotated
import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.event_bus import publish_event
from app.core.logging_config import configure_logging
from app.core.metrics import API_RATE_LIMIT_REJECTIONS_TOTAL
from app.core.rate_limit import api_write_limiter
from app.core.telemetry import configure_telemetry
from app.core.trace import TRACE_HEADER, get_trace_id
from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.game_actions import router as game_actions_router
from app.routes.infra import router as infra_router
from app.routes.plants import router as plants_router
from app.routes.sim_runs import router as sim_runs_router
from app.routes.tasks import router as tasks_router
from app.routes.ai import router as ai_router
from app.services.market_service import publish_market_price_update
from app.services.ai.client import get_ai_readiness

app = FastAPI(title="FarmPlatform API")
app.mount("/metrics", make_asgi_app())
logger = logging.getLogger(__name__)

# OpenTelemetry FastAPI instrumentatie
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from app.core.tracing import trace
FastAPIInstrumentor.instrument_app(app)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.TRUSTED_HOSTS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=settings.CORS_ALLOWED_METHODS,
    allow_headers=settings.CORS_ALLOWED_HEADERS,
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(game_actions_router)
app.include_router(infra_router)
app.include_router(plants_router, prefix="/api")
app.include_router(sim_runs_router)
app.include_router(tasks_router)
app.include_router(ai_router)


@app.on_event("startup")
async def startup() -> None:
    configure_logging()
    configure_telemetry("api")


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    trace_id = get_trace_id(request)
    request.state.trace_id = trace_id

    response = await call_next(request)
    response.headers[TRACE_HEADER] = trace_id

    if settings.SECURITY_HEADERS_ENABLED:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'self'"

        forwarded_proto = request.headers.get("x-forwarded-proto", "")
        is_https = request.url.scheme == "https" or "https" in forwarded_proto.lower().split(",")
        if settings.HSTS_ENABLED and is_https:
            response.headers["Strict-Transport-Security"] = (
                f"max-age={settings.HSTS_MAX_AGE_SECONDS}; includeSubDomains"
            )

    return response


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@app.get("/health/ai")
def health_ai() -> dict:
    return get_ai_readiness()


@app.get("/ready/ai")
def ready_ai() -> JSONResponse:
    readiness = get_ai_readiness()
    status_code = 200 if readiness.get("ready") else 503
    return JSONResponse(status_code=status_code, content=readiness)


@app.post("/market/price-update")
def market_price_update(
    request: Request,
    crop_id: str,
    new_price: float,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    trace_id = request.state.trace_id
    client_host = request.client.host if request.client else "unknown"
    rate_key = f"{current_user.tenant_id}:{client_host}"

    allowed, retry_after = api_write_limiter.allow(
        key=rate_key,
        limit=settings.RATE_LIMIT_API_WRITE_PER_MINUTE,
        window_seconds=60,
    )

    if not allowed:
        API_RATE_LIMIT_REJECTIONS_TOTAL.labels(
            endpoint="market_price_update",
            tenant_id=current_user.tenant_id,
        ).inc()
        logger.warning(
            "API rate limit exceeded",
            extra={
                "traceId": trace_id,
                "tenantId": current_user.tenant_id,
                "eventType": "RATE_LIMIT",
                "service": "api",
            },
        )
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )

    event = publish_market_price_update(
        tenant_id=current_user.tenant_id,
        crop_id=crop_id,
        new_price=new_price,
        trace_id=trace_id,
    )
    return {"published": True, "event": event}


@app.post("/dev/publish-event")
def dev_publish_event(event: dict) -> dict:
    if settings.ENV != "development":
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        publish_event(event)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"published": True}
