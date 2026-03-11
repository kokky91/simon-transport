CREATE TABLE IF NOT EXISTS real.extraction_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_real_extraction_jobs_status
        CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'deadletter')),
    CONSTRAINT uq_real_extraction_jobs_resource
        UNIQUE (resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_real_extraction_jobs_status_created
    ON real.extraction_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_real_extraction_jobs_status_next_attempt
    ON real.extraction_jobs (status, next_attempt_at);
