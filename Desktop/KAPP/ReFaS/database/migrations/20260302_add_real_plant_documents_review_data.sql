ALTER TABLE real.plant_documents
    ADD COLUMN IF NOT EXISTS ai_prefill JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS reviewed_data JSONB NOT NULL DEFAULT '{}'::jsonb;
