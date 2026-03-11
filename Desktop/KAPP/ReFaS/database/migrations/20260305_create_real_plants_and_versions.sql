CREATE TABLE IF NOT EXISTS real.plants (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    scientific_name_normalized TEXT NOT NULL,
    active_version_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plants_tenant_scientific_name
    ON real.plants (tenant_id, scientific_name_normalized);

CREATE INDEX IF NOT EXISTS idx_real_plants_tenant_active
    ON real.plants (tenant_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS real.plant_versions (
    id UUID PRIMARY KEY,
    plant_id UUID NOT NULL REFERENCES real.plants(id),
    tenant_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by TEXT NULL,
    source_document_id UUID NULL REFERENCES real.plant_documents(id),
    source_generation_id UUID NULL REFERENCES real.plant_ai_generations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_versions_plant_version
    ON real.plant_versions (plant_id, version_number);

CREATE INDEX IF NOT EXISTS idx_real_plant_versions_tenant_plant_created
    ON real.plant_versions (tenant_id, plant_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_real_plants_active_version'
          AND table_schema = 'real'
          AND table_name = 'plants'
    ) THEN
        ALTER TABLE real.plants
            ADD CONSTRAINT fk_real_plants_active_version
            FOREIGN KEY (active_version_id)
            REFERENCES real.plant_versions(id);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION real.prevent_plant_versions_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'real.plant_versions is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_plant_versions_update ON real.plant_versions;
CREATE TRIGGER trg_prevent_plant_versions_update
BEFORE UPDATE ON real.plant_versions
FOR EACH ROW
EXECUTE FUNCTION real.prevent_plant_versions_mutation();

DROP TRIGGER IF EXISTS trg_prevent_plant_versions_delete ON real.plant_versions;
CREATE TRIGGER trg_prevent_plant_versions_delete
BEFORE DELETE ON real.plant_versions
FOR EACH ROW
EXECUTE FUNCTION real.prevent_plant_versions_mutation();
