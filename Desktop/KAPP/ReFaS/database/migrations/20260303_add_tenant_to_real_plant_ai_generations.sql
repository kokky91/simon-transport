ALTER TABLE real.plant_ai_generations
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE real.plant_ai_generations g
SET tenant_id = d.tenant_id
FROM real.plant_documents d
WHERE g.plant_document_id = d.id
  AND g.tenant_id IS NULL;

ALTER TABLE real.plant_ai_generations
    ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_real_plant_documents_id_tenant'
    ) THEN
        ALTER TABLE real.plant_documents
            ADD CONSTRAINT uq_real_plant_documents_id_tenant UNIQUE (id, tenant_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_real_plant_ai_generations_document_tenant'
    ) THEN
        ALTER TABLE real.plant_ai_generations
            ADD CONSTRAINT fk_real_plant_ai_generations_document_tenant
            FOREIGN KEY (plant_document_id, tenant_id)
            REFERENCES real.plant_documents(id, tenant_id)
            ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_real_plant_ai_generations_tenant_document_created
    ON real.plant_ai_generations (tenant_id, plant_document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_plant_ai_generations_tenant_model_created
    ON real.plant_ai_generations (tenant_id, model_name, created_at DESC);