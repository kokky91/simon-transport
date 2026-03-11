CREATE TABLE IF NOT EXISTS real.plant_documents (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    plant_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    extracted_text TEXT NULL,
    ai_summary TEXT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_plant_documents_tenant_uploaded
    ON real.plant_documents (tenant_id, uploaded_at DESC);
