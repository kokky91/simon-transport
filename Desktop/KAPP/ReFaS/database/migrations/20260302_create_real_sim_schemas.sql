CREATE SCHEMA IF NOT EXISTS real;
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS real.farms (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    location TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS real.tasks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    farm_id UUID NOT NULL REFERENCES real.farms(id),
    task_type TEXT NOT NULL,
    status TEXT NOT NULL,
    cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS real.harvests (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    farm_id UUID NOT NULL REFERENCES real.farms(id),
    crop_type TEXT NOT NULL,
    quantity_kg NUMERIC(14, 3) NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL,
    harvested_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim.runs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    snapshot_id TEXT NOT NULL,
    source_world_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim.commands (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    run_id UUID NOT NULL REFERENCES sim.runs(id),
    command_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error TEXT NULL,
    available_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS sim.results (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    run_id UUID NOT NULL REFERENCES sim.runs(id),
    metric_key TEXT NOT NULL,
    metric_value NUMERIC(16, 4) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim.events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    run_id UUID NOT NULL REFERENCES sim.runs(id),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_tasks_tenant_created
    ON real.tasks (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_harvests_tenant_harvested
    ON real.harvests (tenant_id, harvested_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_runs_tenant_status
    ON sim.runs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_commands_ready
    ON sim.commands (tenant_id, processed, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_sim_results_tenant_run
    ON sim.results (tenant_id, run_id, created_at DESC);
