ALTER TABLE real.tasks
    ADD COLUMN IF NOT EXISTS completion_note TEXT NULL;