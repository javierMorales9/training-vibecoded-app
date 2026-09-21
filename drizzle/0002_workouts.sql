CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONSUMED')),
  queue_position INTEGER,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK (
    (status = 'PENDING' AND queue_position IS NOT NULL AND queue_position >= 0 AND consumed_at IS NULL)
    OR (status = 'CONSUMED' AND queue_position IS NULL AND consumed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS workouts_pending_position_unique
  ON workouts(queue_position) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS workouts_status_position_idx
  ON workouts(status, queue_position);

CREATE TABLE IF NOT EXISTS workout_blocks (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  name TEXT,
  instructions TEXT,
  method TEXT NOT NULL CHECK (method IN ('NORMAL_SETS', 'PYRAMID', 'SUPERSET')),
  unit_count INTEGER CHECK (unit_count > 0),
  between_units_rest_ms INTEGER CHECK (between_units_rest_ms >= 0),
  after_block_rest_ms INTEGER CHECK (after_block_rest_ms >= 0),
  pyramid_duration_ms INTEGER CHECK (pyramid_duration_ms > 0),
  pyramid_initial_reps INTEGER CHECK (pyramid_initial_reps > 0),
  pyramid_rest_ms_per_rep INTEGER CHECK (pyramid_rest_ms_per_rep > 0),
  UNIQUE(workout_id, position),
  CHECK (
    (method IN ('NORMAL_SETS', 'SUPERSET')
      AND pyramid_duration_ms IS NULL
      AND pyramid_initial_reps IS NULL
      AND pyramid_rest_ms_per_rep IS NULL)
    OR (method = 'PYRAMID'
      AND unit_count IS NULL
      AND between_units_rest_ms IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS workout_block_items (
  id TEXT PRIMARY KEY,
  workout_block_id TEXT NOT NULL REFERENCES workout_blocks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  selection_kind TEXT NOT NULL CHECK (
    selection_kind IN ('EXPLICIT_VARIANT', 'CAPABILITY_RELATIVE')
  ),
  exercise_variant_id TEXT REFERENCES exercise_variants(id) ON DELETE RESTRICT,
  capability TEXT CHECK (
    capability IN ('PUSH_UP', 'VERTICAL_PUSH', 'PULL_UP', 'SQUAT', 'ABDOMINAL')
  ),
  level_offset INTEGER CHECK (level_offset IN (-1, 0, 1)),
  UNIQUE(workout_block_id, position),
  CHECK (
    (selection_kind = 'EXPLICIT_VARIANT' AND capability IS NULL AND level_offset IS NULL)
    OR (selection_kind = 'CAPABILITY_RELATIVE' AND exercise_variant_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS workout_block_item_targets (
  id TEXT PRIMARY KEY,
  workout_block_item_id TEXT NOT NULL
    REFERENCES workout_block_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  metric_kind TEXT NOT NULL CHECK (metric_kind IN ('REPETITIONS', 'DURATION')),
  scope TEXT NOT NULL CHECK (scope IN ('TOTAL', 'PER_SIDE', 'PER_HAND', 'PER_LEG')),
  minimum_value INTEGER NOT NULL CHECK (minimum_value > 0),
  maximum_value INTEGER NOT NULL CHECK (maximum_value > 0),
  UNIQUE(workout_block_item_id, position),
  CHECK (minimum_value <= maximum_value)
);

ALTER TABLE api_idempotency_keys
  ADD COLUMN response_headers TEXT NOT NULL DEFAULT '{}';
