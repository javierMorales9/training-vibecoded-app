ALTER TABLE training_sessions ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS training_sessions_history_order
  ON training_sessions(status, started_at DESC, id DESC);
