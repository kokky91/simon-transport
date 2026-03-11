ALTER TABLE real.plant_versions
    ADD COLUMN IF NOT EXISTS prompt_version TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_real_plant_versions_prompt_version
    ON real.plant_versions (tenant_id, prompt_version, created_at DESC);
