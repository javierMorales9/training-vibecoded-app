import { v7 as uuidv7 } from 'uuid'
import type Database from 'better-sqlite3'
import { getDatabase } from '../infrastructure/db/database'
import { capabilityLabels } from '../domain/assessment'
import type {
  TrainingSession,
  TrainingSessionItemSnapshot,
  TrainingSessionUnit,
} from '../domain/training-session'
import type { WorkoutBlockInput, WorkoutTarget } from '../domain/workout'
import { validateWorkout, getWorkoutInputForExecution } from './workouts'

type SessionRow = {
  id: string
  workout_id: string
  workout_name_snapshot: string
  status: TrainingSession['status']
  phase: TrainingSession['phase']
  current_unit_position: number | null
  started_at: number
  completed_at: number | null
  cancelled_at: number | null
  cancel_reason: string | null
  completion_ratio: number | null
  total_work_ms: number
  total_rest_ms: number
}

type UnitRow = {
  id: string
  position: number
  block_position: number
  method: TrainingSessionUnit['method']
  block_name_snapshot: string
  instructions_snapshot: string | null
  items_snapshot_json: string
  planned_work_ms: number | null
  planned_rest_ms: number
  status: TrainingSessionUnit['status']
  started_at: number | null
  completed_at: number | null
  rest_started_at: number | null
  rest_completed_at: number | null
}

interface VariantSnapshotRow {
  id: string
  name: string
  exercise_name: string
  description: string
}

export class ActiveTrainingSessionError extends Error {
  constructor() {
    super(
      'Ya hay un entrenamiento activo. Termínalo o cancélalo antes de iniciar otro.',
    )
  }
}

export class TrainingSessionNotFoundError extends Error {
  constructor() {
    super('La sesión de entrenamiento ya no existe.')
  }
}

export class TrainingSessionTransitionError extends Error {
  constructor() {
    super('Esta acción ya no está disponible para la sesión actual.')
  }
}

function iso(value: number | null) {
  return value === null ? null : new Date(value).toISOString()
}

function mediaUrl(row: {
  id: string
  kind: string
  external_url: string | null
}) {
  return row.kind === 'VIDEO' && row.external_url
    ? row.external_url
    : `/media/${row.id}`
}

function targetsForUnit(targets: WorkoutTarget[], unitIndex: number) {
  return targets.filter(
    (target) => target.unitIndex === null || target.unitIndex === unitIndex,
  )
}

function snapshotVariant(
  sqlite: Database.Database,
  variantId: string,
  targets: WorkoutTarget[],
): TrainingSessionItemSnapshot {
  const variant = sqlite
    .prepare(
      `SELECT id, name, exercise_name, description
       FROM exercise_variants WHERE id = ? AND is_active = 1`,
    )
    .get(variantId) as VariantSnapshotRow | undefined
  if (!variant)
    throw new Error('Una variante del entrenamiento ya no está disponible.')
  const media = sqlite
    .prepare(
      `SELECT id, kind, external_url, mime_type, alt_text, position
       FROM media_assets WHERE exercise_variant_id = ? ORDER BY position`,
    )
    .all(variantId) as Array<{
    id: string
    kind: 'IMAGE' | 'VIDEO'
    external_url: string | null
    mime_type: string | null
    alt_text: string | null
    position: number
  }>
  return {
    variantId,
    exerciseName: variant.exercise_name,
    variantName: variant.name,
    description: variant.description,
    media: media.map((item) => ({
      id: item.id,
      kind: item.kind,
      url: mediaUrl(item),
      mimeType: item.mime_type,
      altText: item.alt_text ?? `${variant.exercise_name} — ${variant.name}`,
      position: item.position,
    })),
    targets,
  }
}

function resolveVariantId(
  sqlite: Database.Database,
  selection: WorkoutBlockInput['items'][number]['selection'],
) {
  if (selection.kind === 'EXPLICIT_VARIANT') {
    if (!selection.exerciseVariantId) throw new Error('Falta una variante.')
    return selection.exerciseVariantId
  }
  if (!selection.capability || selection.levelOffset === null)
    throw new Error('Falta una selección relativa.')
  const current = sqlite
    .prepare(
      `SELECT maximum_level FROM current_capability_levels WHERE capability = ?`,
    )
    .get(selection.capability) as { maximum_level: number } | undefined
  if (!current)
    throw new Error(
      `No hay un nivel actual para ${capabilityLabels[selection.capability]}.`,
    )
  const level = Math.min(
    5,
    Math.max(1, current.maximum_level + selection.levelOffset),
  )
  const definition = sqlite
    .prepare(
      `SELECT exercise_variant_id FROM capability_level_definitions
       WHERE capability = ? AND level = ?`,
    )
    .get(selection.capability, level) as
    { exercise_variant_id: string } | undefined
  if (!definition)
    throw new Error('No se pudo resolver una variante para este nivel.')
  return definition.exercise_variant_id
}

function makeUnits(sqlite: Database.Database, blocks: WorkoutBlockInput[]) {
  const units: Array<{
    id: string
    position: number
    blockPosition: number
    method: TrainingSessionUnit['method']
    blockName: string
    instructions: string | null
    items: TrainingSessionItemSnapshot[]
    plannedWorkMs: number | null
    plannedRestMs: number
  }> = []
  blocks.forEach((block, blockPosition) => {
    const count = block.method === 'PYRAMID' ? 1 : (block.unitCount ?? 0)
    for (let unitIndex = 0; unitIndex < count; unitIndex += 1) {
      const isLastInBlock = unitIndex === count - 1
      const isLastBlock = blockPosition === blocks.length - 1
      units.push({
        id: uuidv7(),
        position: units.length,
        blockPosition,
        method: block.method,
        blockName: block.name || `Bloque ${blockPosition + 1}`,
        instructions: block.instructions,
        items: block.items.map((item) =>
          snapshotVariant(
            sqlite,
            resolveVariantId(sqlite, item.selection),
            block.method === 'PYRAMID'
              ? []
              : targetsForUnit(item.targets, unitIndex),
          ),
        ),
        plannedWorkMs:
          block.method === 'PYRAMID' ? block.pyramidDurationMs : null,
        plannedRestMs:
          isLastBlock && isLastInBlock
            ? 0
            : isLastInBlock
              ? (block.afterBlockRestMs ?? 0)
              : block.method === 'PYRAMID'
                ? 0
                : (block.betweenUnitsRestMs ?? 0),
      })
    }
  })
  return units
}

function readSession(
  sqlite: Database.Database,
  sessionId: string,
): TrainingSession | null {
  const session = sqlite
    .prepare('SELECT * FROM training_sessions WHERE id = ?')
    .get(sessionId) as SessionRow | undefined
  if (!session) return null
  const units = sqlite
    .prepare(
      `SELECT * FROM training_session_units
       WHERE training_session_id = ? ORDER BY position`,
    )
    .all(sessionId) as UnitRow[]
  return {
    id: session.id,
    workoutId: session.workout_id,
    workoutName: session.workout_name_snapshot,
    status: session.status,
    phase: session.phase,
    currentUnitPosition: session.current_unit_position,
    startedAt: new Date(session.started_at).toISOString(),
    completedAt: iso(session.completed_at),
    cancelledAt: iso(session.cancelled_at),
    cancelReason: session.cancel_reason,
    completionRatio: session.completion_ratio,
    totalWorkMs: session.total_work_ms,
    totalRestMs: session.total_rest_ms,
    units: units.map((unit) => ({
      id: unit.id,
      position: unit.position,
      blockPosition: unit.block_position,
      method: unit.method,
      blockName: unit.block_name_snapshot,
      instructions: unit.instructions_snapshot,
      items: JSON.parse(
        unit.items_snapshot_json,
      ) as TrainingSessionItemSnapshot[],
      plannedWorkMs: unit.planned_work_ms,
      plannedRestMs: unit.planned_rest_ms,
      status: unit.status,
      startedAt: iso(unit.started_at),
      completedAt: iso(unit.completed_at),
      restStartedAt: iso(unit.rest_started_at),
      restCompletedAt: iso(unit.rest_completed_at),
    })),
  }
}

function updateTotals(
  sqlite: Database.Database,
  sessionId: string,
  now: number,
) {
  const totals = sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
           THEN completed_at - started_at ELSE 0 END), 0) AS work,
         COALESCE(SUM(CASE WHEN rest_started_at IS NOT NULL AND rest_completed_at IS NOT NULL
           THEN rest_completed_at - rest_started_at ELSE 0 END), 0) AS rest
       FROM training_session_units WHERE training_session_id = ?`,
    )
    .get(sessionId) as { work: number; rest: number }
  sqlite
    .prepare(
      `UPDATE training_sessions
       SET total_work_ms = ?, total_rest_ms = ?, updated_at = ? WHERE id = ?`,
    )
    .run(totals.work, totals.rest, now, sessionId)
}

export function getActiveTrainingSession() {
  const sqlite = getDatabase().sqlite
  const row = sqlite
    .prepare(`SELECT id FROM training_sessions WHERE status = 'ACTIVE' LIMIT 1`)
    .get() as { id: string } | undefined
  return row ? readSession(sqlite, row.id) : null
}

export function getTrainingSession(sessionId: string) {
  return readSession(getDatabase().sqlite, sessionId)
}

export function startTrainingSession(workoutId: string) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    if (
      sqlite
        .prepare(`SELECT 1 FROM training_sessions WHERE status = 'ACTIVE'`)
        .get()
    )
      throw new ActiveTrainingSessionError()
    const source = getWorkoutInputForExecution(workoutId, sqlite)
    if (!source) throw new TrainingSessionNotFoundError()
    const validation = validateWorkout(source.input, sqlite)
    if (!validation.startable)
      throw new Error(
        validation.issues[0]?.message ??
          'El entrenamiento no se puede iniciar.',
      )
    const units = makeUnits(sqlite, source.input.blocks)
    const now = Date.now()
    const sessionId = uuidv7()
    sqlite
      .prepare(
        `INSERT INTO training_sessions(
          id, workout_id, workout_name_snapshot, snapshot_json, status, phase,
          current_unit_position, started_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'ACTIVE', 'READY', ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        workoutId,
        source.workout.name,
        JSON.stringify({ blocks: source.input.blocks }),
        units[0]?.position ?? null,
        now,
        now,
        now,
      )
    const insertUnit = sqlite.prepare(
      `INSERT INTO training_session_units(
        id, training_session_id, position, block_position, method,
        block_name_snapshot, instructions_snapshot, items_snapshot_json,
        planned_work_ms, planned_rest_ms, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    )
    units.forEach((unit) =>
      insertUnit.run(
        unit.id,
        sessionId,
        unit.position,
        unit.blockPosition,
        unit.method,
        unit.blockName,
        unit.instructions,
        JSON.stringify(unit.items),
        unit.plannedWorkMs,
        unit.plannedRestMs,
      ),
    )
    sqlite
      .prepare(
        `UPDATE workouts
         SET status = 'CONSUMED', queue_position = NULL, consumed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
      .run(now, now, workoutId)
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position + 1000000
         WHERE status = 'PENDING' AND queue_position > ?`,
      )
      .run(source.workout.queue_position)
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position - 1000001
         WHERE status = 'PENDING' AND queue_position > 1000000`,
      )
      .run()
    sqlite
      .prepare(
        `UPDATE app_settings SET workout_queue_version = workout_queue_version + 1, updated_at = ?
         WHERE id = 1`,
      )
      .run(now)
    return readSession(sqlite, sessionId)
  })()
}

export function beginTrainingUnit(sessionId: string) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const session = readSession(sqlite, sessionId)
    if (!session) throw new TrainingSessionNotFoundError()
    if (
      session.status !== 'ACTIVE' ||
      !['READY', 'RESTING'].includes(session.phase)
    )
      throw new TrainingSessionTransitionError()
    const now = Date.now()
    const unit = session.units.find(
      (candidate) => candidate.position === session.currentUnitPosition,
    )
    if (!unit || unit.status !== 'PENDING')
      throw new TrainingSessionTransitionError()
    if (session.phase === 'RESTING')
      sqlite
        .prepare(
          `UPDATE training_session_units SET rest_completed_at = ?
           WHERE training_session_id = ? AND rest_started_at IS NOT NULL AND rest_completed_at IS NULL`,
        )
        .run(now, sessionId)
    sqlite
      .prepare(
        `UPDATE training_session_units SET status = 'WORKING', started_at = ?
         WHERE id = ? AND status = 'PENDING'`,
      )
      .run(now, unit.id)
    sqlite
      .prepare(
        `UPDATE training_sessions SET phase = 'WORKING', updated_at = ? WHERE id = ?`,
      )
      .run(now, sessionId)
    updateTotals(sqlite, sessionId, now)
    return readSession(sqlite, sessionId)
  })()
}

export function completeTrainingWork(
  sessionId: string,
  actualResult: string | null,
) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const session = readSession(sqlite, sessionId)
    if (!session) throw new TrainingSessionNotFoundError()
    if (session.status !== 'ACTIVE' || session.phase !== 'WORKING')
      throw new TrainingSessionTransitionError()
    const current = session.units.find(
      (unit) => unit.position === session.currentUnitPosition,
    )
    if (!current || current.status !== 'WORKING')
      throw new TrainingSessionTransitionError()
    const now = Date.now()
    sqlite
      .prepare(
        `UPDATE training_session_units
         SET status = 'COMPLETED', completed_at = ?, actual_result_json = ? WHERE id = ?`,
      )
      .run(
        now,
        actualResult ? JSON.stringify({ note: actualResult }) : null,
        current.id,
      )
    const next = session.units.find(
      (unit) => unit.position === current.position + 1,
    )
    if (!next) {
      sqlite
        .prepare(
          `UPDATE training_sessions
           SET status = 'COMPLETED', phase = 'COMPLETED', completed_at = ?,
               completion_ratio = 1, current_unit_position = NULL, updated_at = ? WHERE id = ?`,
        )
        .run(now, now, sessionId)
    } else if (current.plannedRestMs > 0) {
      sqlite
        .prepare(
          `UPDATE training_session_units SET rest_started_at = ? WHERE id = ?`,
        )
        .run(now, current.id)
      sqlite
        .prepare(
          `UPDATE training_sessions SET phase = 'RESTING', current_unit_position = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(next.position, now, sessionId)
    } else {
      sqlite
        .prepare(
          `UPDATE training_sessions SET phase = 'READY', current_unit_position = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(next.position, now, sessionId)
    }
    updateTotals(sqlite, sessionId, now)
    return readSession(sqlite, sessionId)
  })()
}

export function cancelTrainingSession(
  sessionId: string,
  reason: string | null,
) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const session = readSession(sqlite, sessionId)
    if (!session) throw new TrainingSessionNotFoundError()
    if (session.status !== 'ACTIVE') throw new TrainingSessionTransitionError()
    const now = Date.now()
    const completed = session.units.filter(
      (unit) => unit.status === 'COMPLETED',
    ).length
    const working = session.units.find((unit) => unit.status === 'WORKING')
    const partial =
      working?.method === 'PYRAMID' &&
      working.startedAt &&
      working.plannedWorkMs
        ? Math.min(
            1,
            Math.max(
              0,
              (now - Date.parse(working.startedAt)) / working.plannedWorkMs,
            ),
          )
        : 0
    const ratio = session.units.length
      ? Math.min(1, (completed + partial) / session.units.length)
      : 0
    if (working) {
      sqlite
        .prepare(
          `UPDATE training_session_units SET completed_at = ?
           WHERE id = ? AND completed_at IS NULL`,
        )
        .run(now, working.id)
    }
    sqlite
      .prepare(
        `UPDATE training_session_units SET rest_completed_at = ?
         WHERE training_session_id = ? AND rest_started_at IS NOT NULL AND rest_completed_at IS NULL`,
      )
      .run(now, sessionId)
    sqlite
      .prepare(
        `UPDATE training_sessions
         SET status = 'CANCELLED', phase = 'CANCELLED', cancelled_at = ?, cancel_reason = ?,
             completion_ratio = ?, current_unit_position = NULL, updated_at = ? WHERE id = ?`,
      )
      .run(now, reason, ratio, now, sessionId)
    updateTotals(sqlite, sessionId, now)
    return readSession(sqlite, sessionId)
  })()
}
