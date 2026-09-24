ALTER TABLE training_session_units ADD COLUMN paused_at INTEGER;
ALTER TABLE training_session_units ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0;
