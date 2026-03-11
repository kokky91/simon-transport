CREATE TABLE IF NOT EXISTS real.plant_ai_generations (
    id UUID PRIMARY KEY,
    plant_document_id UUID NOT NULL REFERENCES real.plant_documents(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    prompt_hash_sha256 TEXT NOT NULL,
    ai_status TEXT NOT NULL,
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(6, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_plant_ai_generations_document_created
    ON real.plant_ai_generations (plant_document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_plant_ai_generations_model_created
    ON real.plant_ai_generations (model_name, created_at DESC);
