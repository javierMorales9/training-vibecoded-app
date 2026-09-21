-- Older drafts allowed several unlabeled-by-unit targets. Preserve them as
-- per-unit targets in their original order before enforcing the new modes.
UPDATE workout_block_item_targets
SET unit_index = position
WHERE workout_block_item_id IN (
  SELECT workout_block_item_id
  FROM workout_block_item_targets
  GROUP BY workout_block_item_id
  HAVING COUNT(*) > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS workout_block_item_targets_common_unique
  ON workout_block_item_targets(workout_block_item_id)
  WHERE unit_index IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workout_block_item_targets_unit_unique
  ON workout_block_item_targets(workout_block_item_id, unit_index)
  WHERE unit_index IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS workout_block_item_targets_no_mixed_insert
BEFORE INSERT ON workout_block_item_targets
WHEN EXISTS (
  SELECT 1
  FROM workout_block_item_targets existing
  WHERE existing.workout_block_item_id = NEW.workout_block_item_id
    AND (
      (NEW.unit_index IS NULL AND existing.unit_index IS NOT NULL)
      OR (NEW.unit_index IS NOT NULL AND existing.unit_index IS NULL)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'common and unit-specific targets cannot be mixed');
END;

CREATE TRIGGER IF NOT EXISTS workout_block_item_targets_no_mixed_update
BEFORE UPDATE OF workout_block_item_id, unit_index ON workout_block_item_targets
WHEN EXISTS (
  SELECT 1
  FROM workout_block_item_targets existing
  WHERE existing.workout_block_item_id = NEW.workout_block_item_id
    AND existing.id <> OLD.id
    AND (
      (NEW.unit_index IS NULL AND existing.unit_index IS NOT NULL)
      OR (NEW.unit_index IS NOT NULL AND existing.unit_index IS NULL)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'common and unit-specific targets cannot be mixed');
END;
