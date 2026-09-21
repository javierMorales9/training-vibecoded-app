import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { getDatabase } from '../infrastructure/db/database'
import {
  exerciseTypeLabels,
  exerciseTypes,
  normalizeCatalogSearch,
} from '../domain/catalog'
import type {
  CatalogMedia,
  CatalogVariantDetail,
  CatalogVariantSummary,
  ExerciseType,
} from '../domain/catalog'
import { listCatalogInputSchema } from '../contracts/catalog'
import type { ListCatalogInput } from '../contracts/catalog'

interface VariantRow {
  id: string
  slug: string
  name: string
  exercise_name: string
  exercise_type: ExerciseType
  body_group: string
  difficulty_min: number | null
  difficulty_max: number | null
  is_primary_progression: 0 | 1
  description?: string
  source_page_start?: number | null
  source_page_end?: number | null
  cover_id: string | null
  cover_kind: 'IMAGE' | 'VIDEO' | null
  cover_alt_text: string | null
  cover_mime_type: string | null
  media_count: number
  image_count: number
  video_count: number
}

interface MediaRow {
  id: string
  position: number
  kind: 'IMAGE' | 'VIDEO'
  storage_kind: 'LOCAL' | 'S3' | 'EXTERNAL_URL'
  storage_key: string | null
  external_url: string | null
  mime_type: string | null
  alt_text: string | null
}

interface CursorPayload {
  version: 1
  fingerprint: string
  name: string
  id: string
}

function normalizeFilters(input: ListCatalogInput) {
  return {
    q: normalizeCatalogSearch(input.q),
    exerciseTypes: [...new Set(input.exerciseTypes)].sort(),
    difficultyMin: input.difficultyMin,
    difficultyMax: input.difficultyMax,
    primaryProgression: input.primaryProgression,
  }
}

function filterFingerprint(input: ListCatalogInput) {
  return createHash('sha256')
    .update(JSON.stringify(normalizeFilters(input)))
    .digest('base64url')
    .slice(0, 16)
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(cursor: string, input: ListCatalogInput): CursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as CursorPayload
    if (
      parsed.version !== 1 ||
      parsed.fingerprint !== filterFingerprint(input) ||
      !parsed.name ||
      !parsed.id
    ) {
      throw new Error('invalid')
    }
    return parsed
  } catch {
    throw new CatalogCursorError()
  }
}

function mediaUrl(
  row: Pick<MediaRow, 'id' | 'kind' | 'external_url'>,
  api = false,
) {
  if (row.kind === 'VIDEO' && row.external_url) return row.external_url
  return api ? `/api/v1/media-assets/${row.id}/content` : `/media/${row.id}`
}

function summaryFromRow(row: VariantRow, api = false): CatalogVariantSummary {
  const cover = row.cover_id
    ? {
        id: row.cover_id,
        position: 0,
        kind: row.cover_kind ?? 'IMAGE',
        url: mediaUrl(
          {
            id: row.cover_id,
            kind: row.cover_kind ?? 'IMAGE',
            external_url: null,
          },
          api,
        ),
        altText: row.cover_alt_text ?? `${row.exercise_name} — ${row.name}`,
        mimeType: row.cover_mime_type,
      }
    : null

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    exerciseName: row.exercise_name,
    exerciseType: row.exercise_type,
    exerciseTypeLabel: exerciseTypeLabels[row.exercise_type],
    bodyGroup: row.body_group,
    difficultyMin: row.difficulty_min,
    difficultyMax: row.difficulty_max,
    isPrimaryProgression: Boolean(row.is_primary_progression),
    cover,
    mediaCount: row.media_count,
    imageCount: row.image_count,
    videoCount: row.video_count,
  }
}

const summarySelect = `
  SELECT
    v.id, v.slug, v.name, v.exercise_name, v.exercise_type, v.body_group,
    v.difficulty_min, v.difficulty_max, v.description, v.source_page_start, v.source_page_end,
    EXISTS (
      SELECT 1 FROM capability_level_definitions d
      WHERE d.exercise_variant_id = v.id
    ) AS is_primary_progression,
    (
      SELECT m.id FROM media_assets m
      WHERE m.exercise_variant_id = v.id AND m.kind = 'IMAGE'
      ORDER BY m.position LIMIT 1
    ) AS cover_id,
    'IMAGE' AS cover_kind,
    (
      SELECT m.alt_text FROM media_assets m
      WHERE m.exercise_variant_id = v.id AND m.kind = 'IMAGE'
      ORDER BY m.position LIMIT 1
    ) AS cover_alt_text,
    (
      SELECT m.mime_type FROM media_assets m
      WHERE m.exercise_variant_id = v.id AND m.kind = 'IMAGE'
      ORDER BY m.position LIMIT 1
    ) AS cover_mime_type,
    (SELECT COUNT(*) FROM media_assets m WHERE m.exercise_variant_id = v.id) AS media_count,
    (SELECT COUNT(*) FROM media_assets m WHERE m.exercise_variant_id = v.id AND m.kind = 'IMAGE') AS image_count,
    (SELECT COUNT(*) FROM media_assets m WHERE m.exercise_variant_id = v.id AND m.kind = 'VIDEO') AS video_count
  FROM exercise_variants v
`

export class CatalogCursorError extends Error {
  readonly code = 'INVALID_CURSOR'
  constructor() {
    super('El cursor no es válido para estos filtros.')
  }
}

export function listCatalogVariants(
  rawInput: ListCatalogInput,
  options: { api?: boolean } = {},
) {
  const input = listCatalogInputSchema.parse(rawInput)
  const sqlite = getDatabase().sqlite
  const where = ['v.is_active = 1']
  const params: Array<string | number> = []
  const normalizedQuery = normalizeCatalogSearch(input.q)
  const hasSearchInput = input.q.trim().length > 0
  if (input.exerciseTypes.length) {
    where.push(
      `v.exercise_type IN (${input.exerciseTypes.map(() => '?').join(', ')})`,
    )
    params.push(...input.exerciseTypes)
  }
  if (input.difficultyMin !== null || input.difficultyMax !== null) {
    where.push('v.difficulty_min IS NOT NULL AND v.difficulty_max IS NOT NULL')
    if (input.difficultyMin !== null) {
      where.push('v.difficulty_max >= ?')
      params.push(input.difficultyMin)
    }
    if (input.difficultyMax !== null) {
      where.push('v.difficulty_min <= ?')
      params.push(input.difficultyMax)
    }
  }
  if (input.primaryProgression !== null) {
    where.push(`${input.primaryProgression ? '' : 'NOT '}EXISTS (
      SELECT 1 FROM capability_level_definitions d
      WHERE d.exercise_variant_id = v.id
    )`)
  }

  const rows = sqlite
    .prepare(
      `${summarySelect}
       WHERE ${where.join(' AND ')}
       ORDER BY v.name COLLATE NOCASE ASC, v.id ASC`,
    )
    .all(...params) as VariantRow[]
  // This single-user catalog is small. Filtering normalized text here lets a
  // query ignore accents, hyphens and spaces without maintaining a second index.
  const matchingRows = hasSearchInput
    ? normalizedQuery
      ? rows.filter((row) =>
          normalizeCatalogSearch(
            `${row.name} ${row.exercise_name} ${row.description ?? ''}`,
          ).includes(normalizedQuery),
        )
      : []
    : rows
  const cursor = input.cursor ? decodeCursor(input.cursor, input) : null
  const cursorStart = cursor
    ? matchingRows.findIndex(
        (row) => row.name === cursor.name && row.id === cursor.id,
      ) + 1
    : 0
  const pageRows = matchingRows.slice(cursorStart)
  const hasMore = pageRows.length > input.limit
  const visibleRows = pageRows.slice(0, input.limit)
  const last = visibleRows.at(-1)

  return {
    items: visibleRows.map((row) => summaryFromRow(row, options.api)),
    page: {
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              version: 1,
              fingerprint: filterFingerprint(input),
              name: last.name,
              id: last.id,
            })
          : null,
    },
  }
}

export function getCatalogVariant(
  variantId: string,
  options: { api?: boolean } = {},
) {
  const sqlite = getDatabase().sqlite
  const row = sqlite
    .prepare(
      `${summarySelect}
       WHERE v.id = ? AND v.is_active = 1`,
    )
    .get(variantId) as VariantRow | undefined
  if (!row) return null

  const mediaRows = sqlite
    .prepare(
      `
      SELECT id, position, kind, storage_kind, storage_key, external_url, mime_type, alt_text
      FROM media_assets
      WHERE exercise_variant_id = ?
      ORDER BY position
    `,
    )
    .all(variantId) as MediaRow[]
  const media: CatalogMedia[] = mediaRows.map((mediaRow) => ({
    id: mediaRow.id,
    position: mediaRow.position,
    kind: mediaRow.kind,
    url: mediaUrl(mediaRow, options.api),
    altText: mediaRow.alt_text ?? `${row.exercise_name} — ${row.name}`,
    mimeType: mediaRow.mime_type,
  }))

  return {
    ...summaryFromRow(row, options.api),
    description: row.description ?? '',
    sourcePageStart: row.source_page_start ?? null,
    sourcePageEnd: row.source_page_end ?? null,
    media,
  } satisfies CatalogVariantDetail
}

export function getCatalogOptions() {
  const sqlite = getDatabase().sqlite
  const counts = new Map(
    (
      sqlite
        .prepare(
          `
          SELECT exercise_type, COUNT(*) AS count
          FROM exercise_variants
          WHERE is_active = 1
          GROUP BY exercise_type
        `,
        )
        .all() as Array<{ exercise_type: ExerciseType; count: number }>
    ).map((row) => [row.exercise_type, row.count]),
  )
  const progressionCounts = sqlite
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(EXISTS (
          SELECT 1 FROM capability_level_definitions d
          WHERE d.exercise_variant_id = v.id
        )) AS primary_count
      FROM exercise_variants v
      WHERE v.is_active = 1
    `,
    )
    .get() as { total: number; primary_count: number }
  return {
    exerciseTypes: exerciseTypes.map((value) => ({
      value,
      label: exerciseTypeLabels[value],
      count: counts.get(value) ?? 0,
    })),
    difficulty: { min: 1, max: 5 },
    progression: {
      primary: progressionCounts.primary_count,
      supplementary: progressionCounts.total - progressionCounts.primary_count,
    },
  }
}

export function getCapabilityLevelDefinitions() {
  const sqlite = getDatabase().sqlite
  const definitions = sqlite
    .prepare(
      `
      SELECT d.id, d.capability, d.level, d.exercise_variant_id, d.instructions,
             v.name AS variant_name, v.exercise_name
      FROM capability_level_definitions d
      JOIN exercise_variants v ON v.id = d.exercise_variant_id
      ORDER BY d.capability, d.level
    `,
    )
    .all() as Array<{
    id: string
    capability: Exclude<ExerciseType, 'FULL_BODY'>
    level: number
    exercise_variant_id: string
    instructions: string
    variant_name: string
    exercise_name: string
  }>
  const requirements = sqlite
    .prepare(
      `
      SELECT capability_level_definition_id, position, label, metric_kind, scope, required_value
      FROM capability_level_requirements
      ORDER BY capability_level_definition_id, position
    `,
    )
    .all() as Array<{
    capability_level_definition_id: string
    position: number
    label: string
    metric_kind: 'REPETITIONS' | 'DURATION'
    scope: string
    required_value: number
  }>

  return definitions.map((definition) => ({
    id: definition.id,
    capability: definition.capability,
    capabilityLabel: exerciseTypeLabels[definition.capability],
    level: definition.level,
    exerciseVariantId: definition.exercise_variant_id,
    exerciseName: definition.exercise_name,
    variantName: definition.variant_name,
    instructions: definition.instructions,
    requirements: requirements
      .filter(
        (requirement) =>
          requirement.capability_level_definition_id === definition.id,
      )
      .map((requirement) => ({
        position: requirement.position,
        label: requirement.label,
        metricKind: requirement.metric_kind,
        scope: requirement.scope,
        requiredValue: requirement.required_value,
      })),
  }))
}

export function getMediaAsset(mediaId: string) {
  return getDatabase()
    .sqlite.prepare(
      `
      SELECT id, position, kind, storage_kind, storage_key, external_url, mime_type, alt_text
      FROM media_assets WHERE id = ?
    `,
    )
    .get(mediaId) as MediaRow | undefined
}

export function getCatalogHealth(
  sqlite: Database.Database = getDatabase().sqlite,
) {
  return sqlite
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM exercise_variants WHERE is_active = 1) AS variants,
        (SELECT COUNT(*) FROM media_assets WHERE kind = 'IMAGE') AS images,
        (SELECT COUNT(*) FROM media_assets WHERE kind = 'VIDEO') AS videos,
        (SELECT COUNT(*) FROM capability_level_definitions) AS capabilityLevels
    `,
    )
    .get() as {
    variants: number
    images: number
    videos: number
    capabilityLevels: number
  }
}
