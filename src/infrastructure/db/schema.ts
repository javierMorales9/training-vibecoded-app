import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  timezone: text('timezone').notNull(),
  soundEnabled: integer('sound_enabled', { mode: 'boolean' }).notNull(),
  defaultRestMs: integer('default_rest_ms').notNull(),
  workoutQueueVersion: integer('workout_queue_version').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    secretHash: text('secret_hash').notNull(),
    canRead: integer('can_read', { mode: 'boolean' }).notNull(),
    canWriteWorkouts: integer('can_write_workouts', {
      mode: 'boolean',
    }).notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [uniqueIndex('api_tokens_prefix_unique').on(table.tokenPrefix)],
)

export const exerciseVariants = sqliteTable(
  'exercise_variants',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    exerciseName: text('exercise_name').notNull(),
    exerciseType: text('exercise_type').notNull(),
    bodyGroup: text('body_group').notNull(),
    difficultyMin: integer('difficulty_min'),
    difficultyMax: integer('difficulty_max'),
    description: text('description').notNull(),
    sourcePageStart: integer('source_page_start'),
    sourcePageEnd: integer('source_page_end'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('exercise_variants_slug_unique').on(table.slug)],
)

export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  exerciseVariantId: text('exercise_variant_id')
    .notNull()
    .references(() => exerciseVariants.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind').notNull(),
  storageKind: text('storage_kind').notNull(),
  storageKey: text('storage_key'),
  externalUrl: text('external_url'),
  mimeType: text('mime_type'),
  altText: text('alt_text'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const capabilityLevelDefinitions = sqliteTable(
  'capability_level_definitions',
  {
    id: text('id').primaryKey(),
    capability: text('capability').notNull(),
    level: integer('level').notNull(),
    exerciseVariantId: text('exercise_variant_id')
      .notNull()
      .references(() => exerciseVariants.id, { onDelete: 'restrict' }),
    instructions: text('instructions'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
)

export const capabilityLevelRequirements = sqliteTable(
  'capability_level_requirements',
  {
    id: text('id').primaryKey(),
    capabilityLevelDefinitionId: text('capability_level_definition_id')
      .notNull()
      .references(() => capabilityLevelDefinitions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    metricKind: text('metric_kind').notNull(),
    scope: text('scope').notNull(),
    requiredValue: integer('required_value').notNull(),
  },
)

export const assessments = sqliteTable('assessments', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  cancelledAt: integer('cancelled_at'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const assessmentCapabilities = sqliteTable('assessment_capabilities', {
  id: text('id').primaryKey(),
  assessmentId: text('assessment_id')
    .notNull()
    .references(() => assessments.id, { onDelete: 'cascade' }),
  capability: text('capability').notNull(),
  position: integer('position').notNull(),
  status: text('status').notNull(),
  previousMaximumLevel: integer('previous_maximum_level'),
  startingLevel: integer('starting_level').notNull(),
  maximumLevel: integer('maximum_level'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
})

export const assessmentLevelResults = sqliteTable('assessment_level_results', {
  id: text('id').primaryKey(),
  assessmentCapabilityId: text('assessment_capability_id')
    .notNull()
    .references(() => assessmentCapabilities.id, { onDelete: 'cascade' }),
  capabilityLevelDefinitionId: text('capability_level_definition_id')
    .notNull()
    .references(() => capabilityLevelDefinitions.id, {
      onDelete: 'restrict',
    }),
  level: integer('level').notNull(),
  exerciseVariantId: text('exercise_variant_id')
    .notNull()
    .references(() => exerciseVariants.id, { onDelete: 'restrict' }),
  exerciseNameSnapshot: text('exercise_name_snapshot').notNull(),
  variantNameSnapshot: text('variant_name_snapshot').notNull(),
  instructionsSnapshot: text('instructions_snapshot'),
  outcome: text('outcome').notNull(),
  answeredAt: integer('answered_at').notNull(),
})

export const assessmentLevelMeasurements = sqliteTable(
  'assessment_level_measurements',
  {
    id: text('id').primaryKey(),
    assessmentLevelResultId: text('assessment_level_result_id')
      .notNull()
      .references(() => assessmentLevelResults.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    metricKind: text('metric_kind').notNull(),
    scope: text('scope').notNull(),
    requiredValue: integer('required_value').notNull(),
    actualValue: integer('actual_value'),
  },
)

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  notes: text('notes'),
  status: text('status').notNull(),
  queuePosition: integer('queue_position'),
  version: integer('version').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  consumedAt: integer('consumed_at'),
})

export const workoutBlocks = sqliteTable('workout_blocks', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  name: text('name'),
  instructions: text('instructions'),
  method: text('method').notNull(),
  unitCount: integer('unit_count'),
  betweenUnitsRestMs: integer('between_units_rest_ms'),
  afterBlockRestMs: integer('after_block_rest_ms'),
  pyramidDurationMs: integer('pyramid_duration_ms'),
  pyramidInitialReps: integer('pyramid_initial_reps'),
  pyramidRestMsPerRep: integer('pyramid_rest_ms_per_rep'),
})

export const workoutBlockItems = sqliteTable('workout_block_items', {
  id: text('id').primaryKey(),
  workoutBlockId: text('workout_block_id')
    .notNull()
    .references(() => workoutBlocks.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  selectionKind: text('selection_kind').notNull(),
  exerciseVariantId: text('exercise_variant_id').references(
    () => exerciseVariants.id,
    { onDelete: 'restrict' },
  ),
  capability: text('capability'),
  levelOffset: integer('level_offset'),
})

export const workoutBlockItemTargets = sqliteTable(
  'workout_block_item_targets',
  {
    id: text('id').primaryKey(),
    workoutBlockItemId: text('workout_block_item_id')
      .notNull()
      .references(() => workoutBlockItems.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    unitIndex: integer('unit_index'),
    label: text('label').notNull(),
    metricKind: text('metric_kind').notNull(),
    scope: text('scope').notNull(),
    minimumValue: integer('minimum_value').notNull(),
    maximumValue: integer('maximum_value').notNull(),
  },
)

export const trainingSessions = sqliteTable('training_sessions', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'restrict' }),
  workoutNameSnapshot: text('workout_name_snapshot').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  status: text('status').notNull(),
  phase: text('phase').notNull(),
  currentUnitPosition: integer('current_unit_position'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  cancelledAt: integer('cancelled_at'),
  cancelReason: text('cancel_reason'),
  notes: text('notes'),
  completionRatio: real('completion_ratio'),
  totalWorkMs: integer('total_work_ms').notNull(),
  totalRestMs: integer('total_rest_ms').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const trainingSessionUnits = sqliteTable('training_session_units', {
  id: text('id').primaryKey(),
  trainingSessionId: text('training_session_id')
    .notNull()
    .references(() => trainingSessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  blockPosition: integer('block_position').notNull(),
  method: text('method').notNull(),
  blockNameSnapshot: text('block_name_snapshot').notNull(),
  instructionsSnapshot: text('instructions_snapshot'),
  itemsSnapshotJson: text('items_snapshot_json').notNull(),
  plannedWorkMs: integer('planned_work_ms'),
  plannedRestMs: integer('planned_rest_ms').notNull(),
  status: text('status').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  restStartedAt: integer('rest_started_at'),
  restCompletedAt: integer('rest_completed_at'),
  actualResultJson: text('actual_result_json'),
})
