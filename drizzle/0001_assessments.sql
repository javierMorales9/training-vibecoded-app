CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  cancelled_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (status = 'IN_PROGRESS' AND completed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'CANCELLED' AND completed_at IS NULL AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS assessments_one_in_progress_idx
  ON assessments(status) WHERE status = 'IN_PROGRESS';

CREATE INDEX IF NOT EXISTS assessments_status_started_idx
  ON assessments(status, started_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS assessment_capabilities (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK (
    capability IN ('PUSH_UP', 'VERTICAL_PUSH', 'PULL_UP', 'SQUAT', 'ABDOMINAL')
  ),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')),
  previous_maximum_level INTEGER CHECK (previous_maximum_level BETWEEN 1 AND 5),
  starting_level INTEGER NOT NULL CHECK (starting_level BETWEEN 1 AND 5),
  maximum_level INTEGER CHECK (maximum_level BETWEEN 1 AND 5),
  started_at INTEGER,
  completed_at INTEGER,
  UNIQUE(assessment_id, capability),
  UNIQUE(assessment_id, position),
  CHECK (
    (status = 'NOT_STARTED' AND started_at IS NULL AND completed_at IS NULL AND maximum_level IS NULL)
    OR (status = 'IN_PROGRESS' AND started_at IS NOT NULL AND completed_at IS NULL AND maximum_level IS NULL)
    OR (status = 'COMPLETED' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND maximum_level IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS assessment_capabilities_assessment_position_idx
  ON assessment_capabilities(assessment_id, position);

CREATE TABLE IF NOT EXISTS assessment_level_results (
  id TEXT PRIMARY KEY,
  assessment_capability_id TEXT NOT NULL
    REFERENCES assessment_capabilities(id) ON DELETE CASCADE,
  capability_level_definition_id TEXT NOT NULL
    REFERENCES capability_level_definitions(id) ON DELETE RESTRICT,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  exercise_variant_id TEXT NOT NULL
    REFERENCES exercise_variants(id) ON DELETE RESTRICT,
  exercise_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  instructions_snapshot TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('PASSED', 'FAILED')),
  answered_at INTEGER NOT NULL,
  UNIQUE(assessment_capability_id, level)
);

CREATE INDEX IF NOT EXISTS assessment_level_results_capability_level_idx
  ON assessment_level_results(assessment_capability_id, level);

CREATE TABLE IF NOT EXISTS assessment_level_measurements (
  id TEXT PRIMARY KEY,
  assessment_level_result_id TEXT NOT NULL
    REFERENCES assessment_level_results(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  metric_kind TEXT NOT NULL CHECK (metric_kind IN ('REPETITIONS', 'DURATION')),
  scope TEXT NOT NULL CHECK (scope IN ('TOTAL', 'PER_SIDE', 'PER_HAND', 'PER_LEG')),
  required_value INTEGER NOT NULL CHECK (required_value > 0),
  actual_value INTEGER CHECK (actual_value >= 0),
  UNIQUE(assessment_level_result_id, position)
);

CREATE VIEW IF NOT EXISTS current_capability_levels AS
WITH latest AS (
  SELECT id
  FROM assessments
  WHERE status = 'COMPLETED'
  ORDER BY completed_at DESC, id DESC
  LIMIT 1
)
SELECT
  c.capability,
  c.maximum_level,
  c.assessment_id,
  a.completed_at
FROM assessment_capabilities c
JOIN latest ON latest.id = c.assessment_id
JOIN assessments a ON a.id = c.assessment_id
WHERE c.status = 'COMPLETED';
