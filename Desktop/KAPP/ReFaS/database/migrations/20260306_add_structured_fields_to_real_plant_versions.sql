ALTER TABLE real.plant_versions
    ADD COLUMN IF NOT EXISTS scientific_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS genus TEXT NULL,
    ADD COLUMN IF NOT EXISTS species TEXT NULL,
    ADD COLUMN IF NOT EXISTS family TEXT NULL,
    ADD COLUMN IF NOT EXISTS common_name_nl TEXT NULL,
    ADD COLUMN IF NOT EXISTS common_name_en TEXT NULL,
    ADD COLUMN IF NOT EXISTS plant_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS growth_form TEXT NULL,
    ADD COLUMN IF NOT EXISTS origin_region TEXT NULL,
    ADD COLUMN IF NOT EXISTS is_native BOOLEAN NULL,

    ADD COLUMN IF NOT EXISTS temperature_min_c DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS temperature_max_c DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS frost_tolerance_c DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS rainfall_min_mm_year INTEGER NULL,
    ADD COLUMN IF NOT EXISTS rainfall_max_mm_year INTEGER NULL,
    ADD COLUMN IF NOT EXISTS drought_tolerance TEXT NULL,
    ADD COLUMN IF NOT EXISTS sun_requirement TEXT NULL,
    ADD COLUMN IF NOT EXISTS wind_tolerance TEXT NULL,
    ADD COLUMN IF NOT EXISTS elevation_min_m INTEGER NULL,
    ADD COLUMN IF NOT EXISTS elevation_max_m INTEGER NULL,

    ADD COLUMN IF NOT EXISTS soil_ph_min DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS soil_ph_max DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS drainage_requirement TEXT NULL,
    ADD COLUMN IF NOT EXISTS root_depth_cm INTEGER NULL,
    ADD COLUMN IF NOT EXISTS root_spread_cm INTEGER NULL,
    ADD COLUMN IF NOT EXISTS nitrogen_fixing BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS nitrogen_contribution_kg_per_ha_year DOUBLE PRECISION NULL,

    ADD COLUMN IF NOT EXISTS spacing_row_cm INTEGER NULL,
    ADD COLUMN IF NOT EXISTS spacing_plant_cm INTEGER NULL,
    ADD COLUMN IF NOT EXISTS plants_per_m2 DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS plants_per_hectare INTEGER NULL,

    ADD COLUMN IF NOT EXISTS growth_rate TEXT NULL,
    ADD COLUMN IF NOT EXISTS days_to_germination INTEGER NULL,
    ADD COLUMN IF NOT EXISTS days_to_first_harvest INTEGER NULL,
    ADD COLUMN IF NOT EXISTS months_to_productive INTEGER NULL,
    ADD COLUMN IF NOT EXISTS productive_lifespan_years INTEGER NULL,
    ADD COLUMN IF NOT EXISTS total_lifespan_years INTEGER NULL,
    ADD COLUMN IF NOT EXISTS harvest_frequency TEXT NULL,

    ADD COLUMN IF NOT EXISTS yield_min_kg_per_plant DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS yield_max_kg_per_plant DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS yield_min_kg_per_ha DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS yield_max_kg_per_ha DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS primary_product TEXT NULL,
    ADD COLUMN IF NOT EXISTS market_value_per_kg DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS economic_category TEXT NULL,

    ADD COLUMN IF NOT EXISTS propagation_method TEXT NULL,
    ADD COLUMN IF NOT EXISTS planting_season TEXT NULL,
    ADD COLUMN IF NOT EXISTS harvest_season TEXT NULL,
    ADD COLUMN IF NOT EXISTS pruning_required BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS irrigation_required BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS fertilization_need TEXT NULL,
    ADD COLUMN IF NOT EXISTS pest_susceptibility TEXT NULL,
    ADD COLUMN IF NOT EXISTS disease_susceptibility TEXT NULL,

    ADD COLUMN IF NOT EXISTS agroforestry_role TEXT NULL,
    ADD COLUMN IF NOT EXISTS carbon_sequestration_estimate DOUBLE PRECISION NULL,
    ADD COLUMN IF NOT EXISTS erosion_control BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS pollinator_value TEXT NULL,
    ADD COLUMN IF NOT EXISTS biodiversity_score DOUBLE PRECISION NULL,

    ADD COLUMN IF NOT EXISTS source_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS source_reference TEXT NULL,
    ADD COLUMN IF NOT EXISTS ai_model_used TEXT NULL,
    ADD COLUMN IF NOT EXISTS review_status TEXT NULL,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP NULL,

    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID NULL;

CREATE TABLE IF NOT EXISTS real.plant_version_climate_zones (
    id UUID PRIMARY KEY,
    plant_version_id UUID NOT NULL REFERENCES real.plant_versions(id) ON DELETE CASCADE,
    climate_zone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS real.plant_version_soil_types (
    id UUID PRIMARY KEY,
    plant_version_id UUID NOT NULL REFERENCES real.plant_versions(id) ON DELETE CASCADE,
    soil_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS real.plant_version_secondary_products (
    id UUID PRIMARY KEY,
    plant_version_id UUID NOT NULL REFERENCES real.plant_versions(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS real.plant_version_companions_good (
    id UUID PRIMARY KEY,
    plant_version_id UUID NOT NULL REFERENCES real.plant_versions(id) ON DELETE CASCADE,
    companion_plant_id UUID NOT NULL REFERENCES real.plants(id)
);

CREATE TABLE IF NOT EXISTS real.plant_version_companions_bad (
    id UUID PRIMARY KEY,
    plant_version_id UUID NOT NULL REFERENCES real.plant_versions(id) ON DELETE CASCADE,
    companion_plant_id UUID NOT NULL REFERENCES real.plants(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_version_climate_zone
    ON real.plant_version_climate_zones (plant_version_id, climate_zone);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_version_soil_type
    ON real.plant_version_soil_types (plant_version_id, soil_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_version_secondary_product
    ON real.plant_version_secondary_products (plant_version_id, product_name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_version_companion_good
    ON real.plant_version_companions_good (plant_version_id, companion_plant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_real_plant_version_companion_bad
    ON real.plant_version_companions_bad (plant_version_id, companion_plant_id);

CREATE INDEX IF NOT EXISTS idx_real_plant_versions_tenant_scientific_name
    ON real.plant_versions (tenant_id, scientific_name, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_real_plant_versions_review_status
    ON real.plant_versions (tenant_id, review_status, created_at DESC);
