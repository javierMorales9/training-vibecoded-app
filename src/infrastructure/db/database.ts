import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { getConfig } from '../../server/config'
import * as schema from './schema'

export interface DatabaseContext {
  sqlite: Database.Database
  db: BetterSQLite3Database<typeof schema>
}

let singleton: DatabaseContext | undefined

function applyMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)
  const migrationsDirectory = path.resolve(process.cwd(), 'drizzle')
  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const applied = sqlite.prepare('SELECT 1 FROM app_migrations WHERE name = ?')
  const record = sqlite.prepare(
    'INSERT INTO app_migrations(name, applied_at) VALUES (?, ?)',
  )

  for (const name of migrations) {
    if (applied.get(name)) continue
    const sql = fs.readFileSync(path.join(migrationsDirectory, name), 'utf8')
    sqlite.transaction(() => {
      sqlite.exec(sql)
      record.run(name, Date.now())
    })()
  }
}

interface SeedMedia {
  id: string
  position: number
  kind: string
  storageKind: string
  storageKey: string | null
  externalUrl: string | null
  mimeType: string | null
  altText: string | null
}

interface SeedVariant {
  id: string
  slug: string
  name: string
  exerciseName: string
  exerciseType: string
  bodyGroup: string
  difficultyMin: number | null
  difficultyMax: number | null
  description: string
  sourcePageStart: number
  sourcePageEnd: number
  media: SeedMedia[]
}

interface SeedRequirement {
  id: string
  position: number
  label: string
  metricKind: string
  scope: string
  requiredValue: number
}

interface SeedDefinition {
  id: string
  capability: string
  level: number
  exerciseVariantId: string
  instructions: string
  requirements: SeedRequirement[]
}

function seedCatalog(sqlite: Database.Database) {
  const seedPath = path.resolve(process.cwd(), 'seed', 'catalog.json')
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as {
    variants: SeedVariant[]
    capabilityDefinitions: SeedDefinition[]
  }
  const now = Date.now()

  const upsertVariant = sqlite.prepare(`
    INSERT INTO exercise_variants(
      id, slug, name, exercise_name, exercise_type, body_group, difficulty_min, difficulty_max,
      description, source_page_start, source_page_end, is_active, created_at, updated_at
    ) VALUES (
      @id, @slug, @name, @exerciseName, @exerciseType, @bodyGroup, @difficultyMin, @difficultyMax,
      @description, @sourcePageStart, @sourcePageEnd, 1, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      exercise_name = excluded.exercise_name,
      exercise_type = excluded.exercise_type,
      body_group = excluded.body_group,
      difficulty_min = excluded.difficulty_min,
      difficulty_max = excluded.difficulty_max,
      description = excluded.description,
      source_page_start = excluded.source_page_start,
      source_page_end = excluded.source_page_end,
      is_active = 1,
      updated_at = excluded.updated_at
  `)
  const upsertMedia = sqlite.prepare(`
    INSERT INTO media_assets(
      id, exercise_variant_id, position, kind, storage_kind, storage_key, external_url,
      mime_type, alt_text, created_at, updated_at
    ) VALUES (
      @id, @exerciseVariantId, @position, @kind, @storageKind, @storageKey, @externalUrl,
      @mimeType, @altText, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      exercise_variant_id = excluded.exercise_variant_id,
      position = excluded.position,
      kind = excluded.kind,
      storage_kind = excluded.storage_kind,
      storage_key = excluded.storage_key,
      external_url = excluded.external_url,
      mime_type = excluded.mime_type,
      alt_text = excluded.alt_text,
      updated_at = excluded.updated_at
  `)
  const upsertDefinition = sqlite.prepare(`
    INSERT INTO capability_level_definitions(
      id, capability, level, exercise_variant_id, instructions, created_at, updated_at
    ) VALUES (@id, @capability, @level, @exerciseVariantId, @instructions, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      capability = excluded.capability,
      level = excluded.level,
      exercise_variant_id = excluded.exercise_variant_id,
      instructions = excluded.instructions,
      updated_at = excluded.updated_at
  `)
  const upsertRequirement = sqlite.prepare(`
    INSERT INTO capability_level_requirements(
      id, capability_level_definition_id, position, label, metric_kind, scope, required_value
    ) VALUES (
      @id, @capabilityLevelDefinitionId, @position, @label, @metricKind, @scope, @requiredValue
    )
    ON CONFLICT(id) DO UPDATE SET
      capability_level_definition_id = excluded.capability_level_definition_id,
      position = excluded.position,
      label = excluded.label,
      metric_kind = excluded.metric_kind,
      scope = excluded.scope,
      required_value = excluded.required_value
  `)

  sqlite.transaction(() => {
    sqlite
      .prepare(
        `
        INSERT INTO app_settings(
          id, timezone, sound_enabled, default_rest_ms, workout_queue_version, created_at, updated_at
        ) VALUES (1, 'Europe/Madrid', 1, 60000, 1, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `,
      )
      .run(now, now)

    for (const variant of seed.variants) {
      upsertVariant.run({ ...variant, createdAt: now, updatedAt: now })
      for (const media of variant.media) {
        upsertMedia.run({
          ...media,
          exerciseVariantId: variant.id,
          createdAt: now,
          updatedAt: now,
        })
      }
    }

    for (const definition of seed.capabilityDefinitions) {
      upsertDefinition.run({ ...definition, createdAt: now, updatedAt: now })
      for (const requirement of definition.requirements) {
        upsertRequirement.run({
          ...requirement,
          capabilityLevelDefinitionId: definition.id,
        })
      }
    }
  })()
}

export function createDatabase(
  databasePath: string,
  options: { seed?: boolean } = {},
) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  applyMigrations(sqlite)
  if (options.seed !== false) seedCatalog(sqlite)
  return { sqlite, db: drizzle({ client: sqlite, schema }) }
}

export function getDatabase(): DatabaseContext {
  singleton ??= createDatabase(getConfig().databasePath)
  return singleton
}

export function closeDatabase() {
  if (!singleton) return
  singleton.sqlite.pragma('wal_checkpoint(TRUNCATE)')
  singleton.sqlite.close()
  singleton = undefined
}
