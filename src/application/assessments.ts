import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import type Database from 'better-sqlite3'
import { getDatabase } from '../infrastructure/db/database'
import { getCatalogVariant } from './catalog'
import {
  calculateStartingLevel,
  capabilities,
  capabilityLabels,
  nextLevelAfterResult,
} from '../domain/assessment'
import type {
  AssessmentOutcome,
  AssessmentStatus,
  Capability,
  CapabilityAssessmentStatus,
  MeasurementScope,
  MetricKind,
} from '../domain/assessment'
import { listAssessmentsInputSchema } from '../contracts/assessment'
import type {
  ListAssessmentsInput,
  RecordAssessmentResultInput,
} from '../contracts/assessment'

interface AssessmentRow {
  id: string
  status: AssessmentStatus
  started_at: number
  completed_at: number | null
  cancelled_at: number | null
  notes: string | null
  created_at: number
  updated_at: number
}

interface CapabilityRow {
  id: string
  assessment_id: string
  capability: Capability
  position: number
  status: CapabilityAssessmentStatus
  previous_maximum_level: number | null
  starting_level: number
  maximum_level: number | null
  started_at: number | null
  completed_at: number | null
}

interface ResultRow {
  id: string
  assessment_capability_id: string
  capability_level_definition_id: string
  level: number
  exercise_variant_id: string
  exercise_name_snapshot: string
  variant_name_snapshot: string
  instructions_snapshot: string | null
  outcome: AssessmentOutcome
  answered_at: number
}

interface MeasurementRow {
  id: string
  assessment_level_result_id: string
  position: number
  label: string
  metric_kind: MetricKind
  scope: MeasurementScope
  required_value: number
  actual_value: number | null
}

interface DefinitionRow {
  id: string
  capability: Capability
  level: number
  exercise_variant_id: string
  instructions: string | null
  exercise_name: string
  variant_name: string
}

interface RequirementRow {
  position: number
  label: string
  metric_kind: MetricKind
  scope: MeasurementScope
  required_value: number
}

interface AssessmentCursor {
  version: 1
  fingerprint: string
  startedAt: number
  id: string
}

export class AssessmentNotFoundError extends Error {}
export class AssessmentConflictError extends Error {}
export class AssessmentTransitionError extends Error {}
export class AssessmentCursorError extends Error {
  readonly code = 'INVALID_CURSOR'
  constructor() {
    super('El cursor no es válido para estos filtros.')
  }
}

function iso(value: number | null) {
  return value === null ? null : new Date(value).toISOString()
}

function cursorFingerprint(input: ListAssessmentsInput) {
  return createHash('sha256')
    .update(JSON.stringify([...new Set(input.statuses)].sort()))
    .digest('base64url')
    .slice(0, 16)
}

function encodeCursor(payload: AssessmentCursor) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(cursor: string, input: ListAssessmentsInput) {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as AssessmentCursor
    if (
      parsed.version !== 1 ||
      parsed.fingerprint !== cursorFingerprint(input) ||
      !Number.isInteger(parsed.startedAt) ||
      !parsed.id
    ) {
      throw new Error('invalid')
    }
    return parsed
  } catch {
    throw new AssessmentCursorError()
  }
}

function capabilitySummary(row: CapabilityRow) {
  return {
    capability: row.capability,
    capabilityLabel: capabilityLabels[row.capability],
    position: row.position,
    status: row.status,
    previousMaximumLevel: row.previous_maximum_level,
    startingLevel: row.starting_level,
    maximumLevel: row.maximum_level,
  }
}

function getCapabilityRows(sqlite: Database.Database, assessmentId: string) {
  return sqlite
    .prepare(
      `SELECT * FROM assessment_capabilities
       WHERE assessment_id = ? ORDER BY position`,
    )
    .all(assessmentId) as CapabilityRow[]
}

export function listAssessments(rawInput: ListAssessmentsInput) {
  const input = listAssessmentsInputSchema.parse(rawInput)
  const sqlite = getDatabase().sqlite
  const where: string[] = []
  const params: Array<string | number> = []
  if (input.statuses.length) {
    where.push(`status IN (${input.statuses.map(() => '?').join(', ')})`)
    params.push(...input.statuses)
  }
  if (input.cursor) {
    const cursor = decodeCursor(input.cursor, input)
    where.push('(started_at < ? OR (started_at = ? AND id < ?))')
    params.push(cursor.startedAt, cursor.startedAt, cursor.id)
  }
  params.push(input.limit + 1)
  const rows = sqlite
    .prepare(
      `SELECT * FROM assessments
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY started_at DESC, id DESC LIMIT ?`,
    )
    .all(...params) as AssessmentRow[]
  const hasMore = rows.length > input.limit
  const visible = rows.slice(0, input.limit)
  const capabilityStatement = sqlite.prepare(
    `SELECT * FROM assessment_capabilities
     WHERE assessment_id = ? ORDER BY position`,
  )
  const items = visible.map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    notes: row.notes,
    capabilities: (capabilityStatement.all(row.id) as CapabilityRow[]).map(
      capabilitySummary,
    ),
  }))
  const last = visible.at(-1)
  return {
    items,
    page: {
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              version: 1,
              fingerprint: cursorFingerprint(input),
              startedAt: last.started_at,
              id: last.id,
            })
          : null,
    },
  }
}

function getDefinition(
  sqlite: Database.Database,
  capability: Capability,
  level: number,
) {
  const definition = sqlite
    .prepare(
      `SELECT d.id, d.capability, d.level, d.exercise_variant_id, d.instructions,
              v.exercise_name, v.name AS variant_name
       FROM capability_level_definitions d
       JOIN exercise_variants v ON v.id = d.exercise_variant_id
       WHERE d.capability = ? AND d.level = ?`,
    )
    .get(capability, level) as DefinitionRow | undefined
  if (!definition)
    throw new AssessmentTransitionError(
      `No existe la definición de ${capability} para el nivel ${level}.`,
    )
  return definition
}

function getRequirements(sqlite: Database.Database, definitionId: string) {
  return sqlite
    .prepare(
      `SELECT position, label, metric_kind, scope, required_value
       FROM capability_level_requirements
       WHERE capability_level_definition_id = ? ORDER BY position`,
    )
    .all(definitionId) as RequirementRow[]
}

function currentLevelForCapability(
  sqlite: Database.Database,
  capability: CapabilityRow,
) {
  const row = sqlite
    .prepare(
      `SELECT MAX(level) AS last_level
       FROM assessment_level_results WHERE assessment_capability_id = ?`,
    )
    .get(capability.id) as { last_level: number | null }
  return row.last_level === null
    ? capability.starting_level
    : row.last_level + 1
}

export function getAssessmentDetail(
  assessmentId: string,
  options: { api?: boolean } = {},
) {
  const sqlite = getDatabase().sqlite
  const assessment = sqlite
    .prepare('SELECT * FROM assessments WHERE id = ?')
    .get(assessmentId) as AssessmentRow | undefined
  if (!assessment) return null
  const capabilityRows = getCapabilityRows(sqlite, assessmentId)
  const resultStatement = sqlite.prepare(
    `SELECT * FROM assessment_level_results
     WHERE assessment_capability_id = ? ORDER BY level`,
  )
  const measurementStatement = sqlite.prepare(
    `SELECT * FROM assessment_level_measurements
     WHERE assessment_level_result_id = ? ORDER BY position`,
  )
  const capabilityDetails = capabilityRows.map((capability) => ({
    ...capabilitySummary(capability),
    startedAt: iso(capability.started_at),
    completedAt: iso(capability.completed_at),
    results: (resultStatement.all(capability.id) as ResultRow[]).map(
      (result) => ({
        id: result.id,
        level: result.level,
        exerciseVariantId: result.exercise_variant_id,
        exerciseName: result.exercise_name_snapshot,
        variantName: result.variant_name_snapshot,
        instructions: result.instructions_snapshot,
        outcome: result.outcome,
        answeredAt: iso(result.answered_at),
        measurements: (
          measurementStatement.all(result.id) as MeasurementRow[]
        ).map((measurement) => ({
          position: measurement.position,
          label: measurement.label,
          metricKind: measurement.metric_kind,
          scope: measurement.scope,
          requiredValue: measurement.required_value,
          actualValue: measurement.actual_value,
        })),
      }),
    ),
  }))
  const activeCapability = capabilityRows.find(
    (capability) => capability.status === 'IN_PROGRESS',
  )
  let currentStep = null
  if (assessment.status === 'IN_PROGRESS' && activeCapability) {
    const level = currentLevelForCapability(sqlite, activeCapability)
    const definition = getDefinition(sqlite, activeCapability.capability, level)
    currentStep = {
      capability: activeCapability.capability,
      capabilityLabel: capabilityLabels[activeCapability.capability],
      position: activeCapability.position,
      level,
      definitionId: definition.id,
      instructions: definition.instructions,
      requirements: getRequirements(sqlite, definition.id).map(
        (requirement) => ({
          position: requirement.position,
          label: requirement.label,
          metricKind: requirement.metric_kind,
          scope: requirement.scope,
          requiredValue: requirement.required_value,
        }),
      ),
      variant: getCatalogVariant(definition.exercise_variant_id, options),
    }
  }
  return {
    id: assessment.id,
    status: assessment.status,
    startedAt: iso(assessment.started_at),
    completedAt: iso(assessment.completed_at),
    cancelledAt: iso(assessment.cancelled_at),
    notes: assessment.notes,
    capabilities: capabilityDetails,
    currentStep,
  }
}

export function getCurrentCapabilityLevels() {
  const rows = getDatabase()
    .sqlite.prepare(
      `SELECT capability, maximum_level, assessment_id, completed_at
       FROM current_capability_levels`,
    )
    .all() as Array<{
    capability: Capability
    maximum_level: number
    assessment_id: string
    completed_at: number
  }>
  const byCapability = new Map(rows.map((row) => [row.capability, row]))
  return capabilities.map((capability) => {
    const row = byCapability.get(capability)
    return {
      capability,
      capabilityLabel: capabilityLabels[capability],
      level: row?.maximum_level ?? null,
      assessmentId: row?.assessment_id ?? null,
      completedAt: row ? iso(row.completed_at) : null,
    }
  })
}

export function startAssessment() {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const existing = sqlite
      .prepare(`SELECT id FROM assessments WHERE status = 'IN_PROGRESS'`)
      .get() as { id: string } | undefined
    if (existing) return getAssessmentDetail(existing.id)

    const previous = new Map(
      (
        sqlite
          .prepare(
            `SELECT capability, maximum_level FROM current_capability_levels`,
          )
          .all() as Array<{
          capability: Capability
          maximum_level: number
        }>
      ).map((row) => [row.capability, row.maximum_level]),
    )
    const now = Date.now()
    const assessmentId = uuidv7()
    sqlite
      .prepare(
        `INSERT INTO assessments(
           id, status, started_at, completed_at, cancelled_at, notes, created_at, updated_at
         ) VALUES (?, 'IN_PROGRESS', ?, NULL, NULL, NULL, ?, ?)`,
      )
      .run(assessmentId, now, now, now)
    const insertCapability = sqlite.prepare(
      `INSERT INTO assessment_capabilities(
         id, assessment_id, capability, position, status, previous_maximum_level,
         starting_level, maximum_level, started_at, completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
    )
    capabilities.forEach((capability, index) => {
      const isFirst = index === 0
      const previousMaximum = previous.get(capability) ?? null
      insertCapability.run(
        uuidv7(),
        assessmentId,
        capability,
        index + 1,
        isFirst ? 'IN_PROGRESS' : 'NOT_STARTED',
        previousMaximum,
        calculateStartingLevel(previousMaximum),
        isFirst ? now : null,
      )
    })
    return getAssessmentDetail(assessmentId)
  })()
}

export function recordAssessmentResult(input: RecordAssessmentResultInput) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const assessment = sqlite
      .prepare('SELECT * FROM assessments WHERE id = ?')
      .get(input.assessmentId) as AssessmentRow | undefined
    if (!assessment) throw new AssessmentNotFoundError()
    if (assessment.status !== 'IN_PROGRESS')
      throw new AssessmentTransitionError('La evaluación ya ha terminado.')
    const capability = sqlite
      .prepare(
        `SELECT * FROM assessment_capabilities
         WHERE assessment_id = ? AND status = 'IN_PROGRESS'`,
      )
      .get(input.assessmentId) as CapabilityRow | undefined
    if (!capability || capability.capability !== input.capability)
      throw new AssessmentTransitionError('Esta no es la capacidad activa.')
    const expectedLevel = currentLevelForCapability(sqlite, capability)
    if (expectedLevel !== input.level)
      throw new AssessmentTransitionError('Este no es el nivel activo.')

    const definition = getDefinition(sqlite, input.capability, input.level)
    const requirements = getRequirements(sqlite, definition.id)
    const provided = new Map(
      input.measurements.map((measurement) => [
        measurement.position,
        measurement.actualValue,
      ]),
    )
    if (
      input.measurements.some(
        (measurement) =>
          !requirements.some(
            (requirement) => requirement.position === measurement.position,
          ),
      )
    ) {
      throw new AssessmentTransitionError('Hay una medición desconocida.')
    }

    const now = Date.now()
    const resultId = uuidv7()
    sqlite
      .prepare(
        `INSERT INTO assessment_level_results(
           id, assessment_capability_id, capability_level_definition_id, level,
           exercise_variant_id, exercise_name_snapshot, variant_name_snapshot,
           instructions_snapshot, outcome, answered_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        resultId,
        capability.id,
        definition.id,
        input.level,
        definition.exercise_variant_id,
        definition.exercise_name,
        definition.variant_name,
        definition.instructions,
        input.outcome,
        now,
      )
    const insertMeasurement = sqlite.prepare(
      `INSERT INTO assessment_level_measurements(
         id, assessment_level_result_id, position, label, metric_kind, scope,
         required_value, actual_value
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const requirement of requirements) {
      insertMeasurement.run(
        uuidv7(),
        resultId,
        requirement.position,
        requirement.label,
        requirement.metric_kind,
        requirement.scope,
        requirement.required_value,
        provided.get(requirement.position) ?? null,
      )
    }

    const nextLevel = nextLevelAfterResult(input.level, input.outcome)
    if (nextLevel === null) {
      sqlite
        .prepare(
          `UPDATE assessment_capabilities
           SET status = 'COMPLETED', maximum_level = ?, completed_at = ?
           WHERE id = ?`,
        )
        .run(input.level, now, capability.id)
      const nextCapability = sqlite
        .prepare(
          `SELECT * FROM assessment_capabilities
           WHERE assessment_id = ? AND status = 'NOT_STARTED'
           ORDER BY position LIMIT 1`,
        )
        .get(input.assessmentId) as CapabilityRow | undefined
      if (nextCapability) {
        sqlite
          .prepare(
            `UPDATE assessment_capabilities
             SET status = 'IN_PROGRESS', started_at = ? WHERE id = ?`,
          )
          .run(now, nextCapability.id)
      } else {
        sqlite
          .prepare(
            `UPDATE assessments
             SET status = 'COMPLETED', completed_at = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(now, now, input.assessmentId)
      }
    }
    sqlite
      .prepare('UPDATE assessments SET updated_at = ? WHERE id = ?')
      .run(now, input.assessmentId)
    return getAssessmentDetail(input.assessmentId)
  })()
}

export function cancelAssessment(assessmentId: string) {
  const sqlite = getDatabase().sqlite
  const now = Date.now()
  const result = sqlite
    .prepare(
      `UPDATE assessments
       SET status = 'CANCELLED', cancelled_at = ?, updated_at = ?
       WHERE id = ? AND status = 'IN_PROGRESS'`,
    )
    .run(now, now, assessmentId)
  if (!result.changes)
    throw new AssessmentTransitionError(
      'La evaluación no existe o ya ha terminado.',
    )
  return getAssessmentDetail(assessmentId)
}

export function updateAssessmentNotes(assessmentId: string, notes: string) {
  const result = getDatabase()
    .sqlite.prepare(
      `UPDATE assessments SET notes = ?, updated_at = ? WHERE id = ?`,
    )
    .run(notes || null, Date.now(), assessmentId)
  if (!result.changes) throw new AssessmentNotFoundError()
  return getAssessmentDetail(assessmentId)
}
