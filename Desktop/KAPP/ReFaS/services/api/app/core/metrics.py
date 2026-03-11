from prometheus_client import Counter, Histogram

EVENTS_PUBLISHED_TOTAL = Counter(
    "events_published_total",
    "Total number of events published by API",
    ["event_type", "tenant_id"],
)

API_RATE_LIMIT_REJECTIONS_TOTAL = Counter(
    "api_rate_limit_rejections_total",
    "Total number of API rate limit rejections",
    ["endpoint", "tenant_id"],
)

EVENT_PUBLISH_LATENCY_SECONDS = Histogram(
    "event_publish_latency_seconds",
    "Time spent publishing events to Redis",
    ["event_type"],
)

AI_REQUESTS_TOTAL = Counter(
    "ai_requests_total",
    "Total AI requests",
)

AI_LATENCY_SECONDS = Histogram(
    "ai_latency_seconds",
    "AI request latency",
)

RAG_CONTEXT_ITEMS = Histogram(
    "rag_context_items",
    "Number of context items retrieved",
)
