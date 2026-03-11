ALTER TABLE real.tasks
    ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(12, 2) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_done_requires_completed_at'
    ) THEN
        ALTER TABLE real.tasks
            ADD CONSTRAINT tasks_done_requires_completed_at
            CHECK (
                status <> 'done'
                OR completed_at IS NOT NULL
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_cancelled_requires_no_completed_at'
    ) THEN
        ALTER TABLE real.tasks
            ADD CONSTRAINT tasks_cancelled_requires_no_completed_at
            CHECK (
                status <> 'cancelled'
                OR completed_at IS NULL
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_done_requires_actual_cost'
    ) THEN
        ALTER TABLE real.tasks
            ADD CONSTRAINT tasks_done_requires_actual_cost
            CHECK (
                status <> 'done'
                OR actual_cost IS NOT NULL
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tasks_actual_cost_non_negative'
    ) THEN
        ALTER TABLE real.tasks
            ADD CONSTRAINT tasks_actual_cost_non_negative
            CHECK (
                actual_cost IS NULL
                OR actual_cost >= 0
            );
    END IF;
END $$;