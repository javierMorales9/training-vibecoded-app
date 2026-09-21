ALTER TABLE workout_block_item_targets
  ADD COLUMN unit_index INTEGER
  CHECK (unit_index IS NULL OR unit_index >= 0);

CREATE INDEX IF NOT EXISTS workout_block_item_targets_unit_idx
  ON workout_block_item_targets(workout_block_item_id, unit_index);
