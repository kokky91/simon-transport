ALTER TABLE real.users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'ai_reviewer';

CREATE INDEX IF NOT EXISTS idx_real_users_role
    ON real.users (role);