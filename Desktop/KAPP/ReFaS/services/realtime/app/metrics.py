from prometheus_client import Counter, Gauge, Histogram

WS_CONNECTIONS_ACTIVE = Gauge(
    "ws_connections_active",
    "Current active websocket connections",
    ["tenant_id"],
)

WS_CONNECTIONS_TOTAL = Counter(
    "ws_connections_total",
    "Total websocket connection attempts",
    ["result", "tenant_id"],
)

WS_AUTH_REJECTIONS_TOTAL = Counter(
    "ws_auth_rejections_total",
    "Total websocket authentication rejections",
)

WS_RATE_LIMIT_REJECTIONS_TOTAL = Counter(
    "ws_rate_limit_rejections_total",
    "Total websocket rate-limit rejections",
    ["reason", "tenant_id"],
)

EVENTS_CONSUMED_TOTAL = Counter(
    "events_consumed_total",
    "Total events consumed from Redis",
    ["event_type", "tenant_id"],
)

EVENTS_BROADCAST_TOTAL = Counter(
    "events_broadcast_total",
    "Total events broadcast to websocket clients",
    ["event_type", "tenant_id"],
)

EVENT_BROADCAST_LATENCY_SECONDS = Histogram(
    "event_broadcast_latency_seconds",
    "Time spent broadcasting events to websocket clients",
    ["event_type"],
)
