ALTER TABLE real.plant_ai_generations
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_real_plant_ai_generations_one_active
    ON real.plant_ai_generations (plant_document_id)
    WHERE is_active = TRUE;
