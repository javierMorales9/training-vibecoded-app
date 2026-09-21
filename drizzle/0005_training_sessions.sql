CREATE TABLE IF NOT EXISTS training_sessions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE RESTRICT,
  workout_name_snapshot TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  phase TEXT NOT NULL CHECK (phase IN ('READY', 'WORKING', 'RESTING', 'COMPLETED', 'CANCELLED')),
  current_unit_position INTEGER,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  cancelled_at INTEGER,
  cancel_reason TEXT,
  completion_ratio REAL,
  total_work_ms INTEGER NOT NULL DEFAULT 0,
  total_rest_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status = 'ACTIVE' AND phase IN ('READY', 'WORKING', 'RESTING') AND completed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'COMPLETED' AND phase = 'COMPLETED' AND completed_at IS NOT NULL)
    OR (status = 'CANCELLED' AND phase = 'CANCELLED' AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_one_active
  ON training_sessions(status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS training_sessions_status_updated_idx
  ON training_sessions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS training_session_units (
  id TEXT PRIMARY KEY,
  training_session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  block_position INTEGER NOT NULL CHECK (block_position >= 0),
  method TEXT NOT NULL CHECK (method IN ('NORMAL_SETS', 'PYRAMID', 'SUPERSET')),
  block_name_snapshot TEXT NOT NULL,
  instructions_snapshot TEXT,
  items_snapshot_json TEXT NOT NULL,
  planned_work_ms INTEGER,
  planned_rest_ms INTEGER NOT NULL DEFAULT 0 CHECK (planned_rest_ms >= 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'WORKING', 'COMPLETED')),
  started_at INTEGER,
  completed_at INTEGER,
  rest_started_at INTEGER,
  rest_completed_at INTEGER,
  actual_result_json TEXT,
  UNIQUE(training_session_id, position)
);

CREATE INDEX IF NOT EXISTS training_session_units_session_position_idx
  ON training_session_units(training_session_id, position);
