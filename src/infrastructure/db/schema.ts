import {
  integer,
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
