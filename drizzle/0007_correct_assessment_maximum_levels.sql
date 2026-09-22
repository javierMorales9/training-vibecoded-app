-- A capability's maximum is the highest level actually passed, never the
-- first level at which it failed. Recompute historical completed assessments
-- from their immutable level results so current levels and history agree.
UPDATE assessment_capabilities
SET maximum_level = COALESCE((
  SELECT MAX(result.level)
  FROM assessment_level_results AS result
  WHERE result.assessment_capability_id = assessment_capabilities.id
    AND result.outcome = 'PASSED'
), 1)
WHERE status = 'COMPLETED';
