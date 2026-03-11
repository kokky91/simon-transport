CREATE TABLE IF NOT EXISTS real.users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_users_email
    ON real.users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_real_users_tenant
    ON real.users (tenant_id, created_at DESC);