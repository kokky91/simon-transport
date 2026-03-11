ALTER TABLE real.farms
    ADD COLUMN IF NOT EXISTS width_m NUMERIC(12, 2) NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS height_m NUMERIC(12, 2) NOT NULL DEFAULT 1000;

CREATE TABLE IF NOT EXISTS real.fields (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    farm_id UUID NOT NULL REFERENCES real.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    x_m NUMERIC(12, 2) NOT NULL,
    y_m NUMERIC(12, 2) NOT NULL,
    width_m NUMERIC(12, 2) NOT NULL,
    height_m NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (x_m >= 0),
    CHECK (y_m >= 0),
    CHECK (width_m > 0),
    CHECK (height_m > 0)
);

CREATE TABLE IF NOT EXISTS real.buildings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    farm_id UUID NOT NULL REFERENCES real.farms(id) ON DELETE CASCADE,
    field_id UUID NULL REFERENCES real.fields(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    x_m NUMERIC(12, 2) NOT NULL,
    y_m NUMERIC(12, 2) NOT NULL,
    width_m NUMERIC(12, 2) NOT NULL,
    height_m NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (x_m >= 0),
    CHECK (y_m >= 0),
    CHECK (width_m > 0),
    CHECK (height_m > 0)
);

CREATE TABLE IF NOT EXISTS sim.fields (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    run_id UUID NULL REFERENCES sim.runs(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL,
    name TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    x_m NUMERIC(12, 2) NOT NULL,
    y_m NUMERIC(12, 2) NOT NULL,
    width_m NUMERIC(12, 2) NOT NULL,
    height_m NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim.buildings (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    run_id UUID NULL REFERENCES sim.runs(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL,
    field_id UUID NULL,
    type TEXT NOT NULL,
    x_m NUMERIC(12, 2) NOT NULL,
    y_m NUMERIC(12, 2) NOT NULL,
    width_m NUMERIC(12, 2) NOT NULL,
    height_m NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_fields_tenant_farm
    ON real.fields (tenant_id, farm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_buildings_tenant_farm
    ON real.buildings (tenant_id, farm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_fields_tenant_run
    ON sim.fields (tenant_id, run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sim_buildings_tenant_run
    ON sim.buildings (tenant_id, run_id, created_at DESC);
