-- Add vertical height dimension (Z-axis) for 3D visualization of fields and buildings

-- Add to real.fields
ALTER TABLE real.fields
    ADD COLUMN IF NOT EXISTS z_height_m NUMERIC(6,2) NOT NULL DEFAULT 1.0;

-- Add to sim.fields
ALTER TABLE sim.fields
    ADD COLUMN IF NOT EXISTS z_height_m NUMERIC(6,2) NOT NULL DEFAULT 1.0;

-- Add to real.buildings
ALTER TABLE real.buildings
    ADD COLUMN IF NOT EXISTS z_height_m NUMERIC(6,2) NOT NULL DEFAULT 2.0;

-- Add to sim.buildings
ALTER TABLE sim.buildings
    ADD COLUMN IF NOT EXISTS z_height_m NUMERIC(6,2) NOT NULL DEFAULT 2.0;
