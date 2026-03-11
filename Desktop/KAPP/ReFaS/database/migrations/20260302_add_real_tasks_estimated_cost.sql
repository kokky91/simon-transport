ALTER TABLE real.tasks
    ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE real.tasks
SET estimated_cost = cost_amount
WHERE estimated_cost = 0
  AND cost_amount > 0;