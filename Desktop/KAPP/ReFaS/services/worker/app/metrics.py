from prometheus_client import Counter, Gauge, Histogram

TICKS_TOTAL = Counter(
    "game_ticks_total",
    "Total game engine ticks executed by worker",
)

TICK_DURATION_SECONDS = Histogram(
    "tick_duration_seconds",
    "Game tick processing duration in seconds",
)

ACTIVE_WORLDS = Gauge(
    "active_worlds",
    "Number of active worlds processed by worker",
)

ENTITIES_PROCESSED = Gauge(
    "entities_processed",
    "Number of entities processed in latest tick",
)

EVENTS_EMITTED_TOTAL = Counter(
    "game_events_emitted_total",
    "Total game domain events emitted by worker ticks",
    ["event_type", "tenant_id"],
)

GAME_COMMANDS_PROCESSED_TOTAL = Counter(
    "game_commands_processed_total",
    "Total game commands processed successfully",
    ["command_type", "tenant_id"],
)

GAME_COMMANDS_FAILED_TOTAL = Counter(
    "game_commands_failed_total",
    "Total game commands failed during processing",
    ["command_type", "tenant_id"],
)

GAME_COMMAND_RETRY_TOTAL = Counter(
    "game_command_retry_total",
    "Total game command retries scheduled",
    ["command_type", "tenant_id"],
)

GAME_COMMANDS_DEAD_TOTAL = Counter(
    "game_commands_dead_total",
    "Total game commands moved to dead-letter state",
    ["command_type", "tenant_id"],
)

GAME_WORLD_LOCK_ACQUIRED_TOTAL = Counter(
    "game_world_lock_acquired_total",
    "Total successful world lock acquisitions",
    ["world_id", "tenant_id"],
)

GAME_WORLD_LOCK_SKIPPED_TOTAL = Counter(
    "game_world_lock_skipped_total",
    "Total tick cycles skipped due to world lock contention",
    ["world_id", "tenant_id"],
)

SIM_COMMANDS_PROCESSED_TOTAL = Counter(
    "sim_commands_processed_total",
    "Total simulation commands processed successfully",
    ["command_type", "tenant_id"],
)

SIM_COMMANDS_FAILED_TOTAL = Counter(
    "sim_commands_failed_total",
    "Total simulation commands failed",
    ["command_type", "tenant_id"],
)

SIM_RUNS_COMPLETED_TOTAL = Counter(
    "sim_runs_completed_total",
    "Total simulation runs completed",
    ["tenant_id"],
)
