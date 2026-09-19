CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
  sound_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sound_enabled IN (0, 1)),
  default_rest_ms INTEGER NOT NULL DEFAULT 60000 CHECK (default_rest_ms > 0),
  workout_queue_version INTEGER NOT NULL DEFAULT 1 CHECK (workout_queue_version > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  can_read INTEGER NOT NULL DEFAULT 1 CHECK (can_read IN (0, 1)),
  can_write_workouts INTEGER NOT NULL DEFAULT 0 CHECK (can_write_workouts IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS api_tokens_active_prefix_idx
  ON api_tokens(token_prefix) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id TEXT PRIMARY KEY,
  api_token_id TEXT NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(api_token_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS exercise_variants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_type TEXT NOT NULL CHECK (
    exercise_type IN ('PUSH_UP', 'VERTICAL_PUSH', 'PULL_UP', 'SQUAT', 'ABDOMINAL', 'FULL_BODY')
  ),
  body_group TEXT NOT NULL,
  difficulty_min INTEGER,
  difficulty_max INTEGER,
  description TEXT NOT NULL,
  source_page_start INTEGER,
  source_page_end INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (
    (difficulty_min IS NULL AND difficulty_max IS NULL)
    OR (
      difficulty_min BETWEEN 1 AND 5
      AND difficulty_max BETWEEN 1 AND 5
      AND difficulty_min <= difficulty_max
    )
  )
);

CREATE INDEX IF NOT EXISTS exercise_variants_type_name_idx
  ON exercise_variants(exercise_type, name COLLATE NOCASE, id);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  exercise_variant_id TEXT NOT NULL REFERENCES exercise_variants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('IMAGE', 'VIDEO')),
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('LOCAL', 'S3', 'EXTERNAL_URL')),
  storage_key TEXT,
  external_url TEXT,
  mime_type TEXT,
  alt_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(exercise_variant_id, position),
  CHECK (
    (storage_kind IN ('LOCAL', 'S3') AND storage_key IS NOT NULL AND external_url IS NULL)
    OR (storage_kind = 'EXTERNAL_URL' AND storage_key IS NULL AND external_url IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS media_assets_variant_position_idx
  ON media_assets(exercise_variant_id, position);

CREATE TABLE IF NOT EXISTS capability_level_definitions (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL CHECK (
    capability IN ('PUSH_UP', 'VERTICAL_PUSH', 'PULL_UP', 'SQUAT', 'ABDOMINAL')
  ),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  exercise_variant_id TEXT NOT NULL REFERENCES exercise_variants(id) ON DELETE RESTRICT,
  instructions TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(capability, level)
);

CREATE TABLE IF NOT EXISTS capability_level_requirements (
  id TEXT PRIMARY KEY,
  capability_level_definition_id TEXT NOT NULL
    REFERENCES capability_level_definitions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  label TEXT NOT NULL,
  metric_kind TEXT NOT NULL CHECK (metric_kind IN ('REPETITIONS', 'DURATION')),
  scope TEXT NOT NULL CHECK (scope IN ('TOTAL', 'PER_SIDE', 'PER_HAND', 'PER_LEG')),
  required_value INTEGER NOT NULL CHECK (required_value > 0),
  UNIQUE(capability_level_definition_id, position)
);

CREATE VIRTUAL TABLE IF NOT EXISTS exercise_variants_fts USING fts5(
  name,
  exercise_name,
  description,
  content='exercise_variants',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS exercise_variants_fts_insert
AFTER INSERT ON exercise_variants BEGIN
  INSERT INTO exercise_variants_fts(rowid, name, exercise_name, description)
  VALUES (new.rowid, new.name, new.exercise_name, new.description);
END;

CREATE TRIGGER IF NOT EXISTS exercise_variants_fts_delete
AFTER DELETE ON exercise_variants BEGIN
  INSERT INTO exercise_variants_fts(exercise_variants_fts, rowid, name, exercise_name, description)
  VALUES ('delete', old.rowid, old.name, old.exercise_name, old.description);
END;

CREATE TRIGGER IF NOT EXISTS exercise_variants_fts_update
AFTER UPDATE ON exercise_variants BEGIN
  INSERT INTO exercise_variants_fts(exercise_variants_fts, rowid, name, exercise_name, description)
  VALUES ('delete', old.rowid, old.name, old.exercise_name, old.description);
  INSERT INTO exercise_variants_fts(rowid, name, exercise_name, description)
  VALUES (new.rowid, new.name, new.exercise_name, new.description);
END;

INSERT INTO exercise_variants_fts(exercise_variants_fts) VALUES ('rebuild');
