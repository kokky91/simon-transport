CREATE TABLE IF NOT EXISTS game_commands (
    id UUID PRIMARY KEY,
    world_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_game_commands_unprocessed
    ON game_commands (tenant_id, world_id, processed, created_at);
