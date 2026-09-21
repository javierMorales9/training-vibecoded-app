import { v7 as uuidv7 } from 'uuid'
import type Database from 'better-sqlite3'
import { workoutInputSchema } from '../contracts/workout'
import type { WorkoutInputData } from '../contracts/workout'
import { capabilityLabels, capabilities } from '../domain/assessment'
import type { Capability } from '../domain/assessment'
import {
  estimateWorkoutDurationMs,
  expectedItemCount,
  trainingMethodLabels,
} from '../domain/workout'
import type {
  TrainingMethod,
  WorkoutBlockInput,
  WorkoutValidationIssue,
} from '../domain/workout'
import { getDatabase } from '../infrastructure/db/database'

interface WorkoutRow {
  id: string
  name: string
  notes: string | null
  status: 'PENDING' | 'CONSUMED'
  queue_position: number | null
  version: number
  created_at: number
  updated_at: number
  consumed_at: number | null
}

interface BlockRow {
  id: string
  workout_id: string
  position: number
  name: string | null
  instructions: string | null
  method: TrainingMethod
  unit_count: number | null
  between_units_rest_ms: number | null
  after_block_rest_ms: number | null
  pyramid_duration_ms: number | null
  pyramid_initial_reps: number | null
  pyramid_rest_ms_per_rep: number | null
}

interface ItemRow {
  id: string
  workout_block_id: string
  position: number
  selection_kind: 'EXPLICIT_VARIANT' | 'CAPABILITY_RELATIVE'
  exercise_variant_id: string | null
  capability: Capability | null
  level_offset: -1 | 0 | 1 | null
  variant_name: string | null
  exercise_name: string | null
}

interface TargetRow {
  workout_block_item_id: string
  position: number
  unit_index: number | null
  label: string
  metric_kind: 'REPETITIONS' | 'DURATION'
  scope: 'TOTAL' | 'PER_SIDE' | 'PER_HAND' | 'PER_LEG'
  minimum_value: number
  maximum_value: number
}

export class WorkoutNotFoundError extends Error {
  constructor() {
    super('El entrenamiento ya no existe o ha dejado de estar pendiente.')
  }
}
export class WorkoutVersionError extends Error {
  constructor() {
    super('El entrenamiento o la cola han cambiado. Recarga antes de guardar.')
  }
}
export class WorkoutQueueConflictError extends Error {
  constructor() {
    super('El orden no contiene exactamente los entrenamientos pendientes.')
  }
}

function iso(value: number | null) {
  return value === null ? null : new Date(value).toISOString()
}

function queueVersion(sqlite: Database.Database) {
  return (
    sqlite
      .prepare(
        'SELECT workout_queue_version AS version FROM app_settings WHERE id = 1',
      )
      .get() as { version: number }
  ).version
}

function incrementQueueVersion(sqlite: Database.Database) {
  sqlite
    .prepare(
      `UPDATE app_settings
       SET workout_queue_version = workout_queue_version + 1, updated_at = ?
       WHERE id = 1`,
    )
    .run(Date.now())
  return queueVersion(sqlite)
}

function getInputFromRows(sqlite: Database.Database, workout: WorkoutRow) {
  const blocks = sqlite
    .prepare(
      'SELECT * FROM workout_blocks WHERE workout_id = ? ORDER BY position',
    )
    .all(workout.id) as BlockRow[]
  const itemStatement = sqlite.prepare(
    `SELECT i.*, v.name AS variant_name, v.exercise_name
     FROM workout_block_items i
     LEFT JOIN exercise_variants v ON v.id = i.exercise_variant_id
     WHERE i.workout_block_id = ? ORDER BY i.position`,
  )
  const targetStatement = sqlite.prepare(
    `SELECT * FROM workout_block_item_targets
     WHERE workout_block_item_id = ? ORDER BY position`,
  )

  return {
    name: workout.name,
    notes: workout.notes,
    blocks: blocks.map((block) => {
      const items = (itemStatement.all(block.id) as ItemRow[]).map((item) => ({
        selection:
          item.selection_kind === 'EXPLICIT_VARIANT'
            ? {
                kind: 'EXPLICIT_VARIANT' as const,
                exerciseVariantId: item.exercise_variant_id,
              }
            : {
                kind: 'CAPABILITY_RELATIVE' as const,
                capability: item.capability,
                levelOffset: item.level_offset,
              },
        targets: (targetStatement.all(item.id) as TargetRow[]).map(
          (target) => ({
            unitIndex: target.unit_index,
            label: target.label,
            metricKind: target.metric_kind,
            scope: target.scope,
            minimumValue: target.minimum_value,
            maximumValue: target.maximum_value,
          }),
        ),
        display:
          item.selection_kind === 'EXPLICIT_VARIANT'
            ? {
                exerciseName: item.exercise_name,
                variantName: item.variant_name,
              }
            : {
                capabilityLabel: item.capability
                  ? capabilityLabels[item.capability]
                  : null,
                offsetLabel:
                  item.level_offset === null
                    ? null
                    : item.level_offset === 0
                      ? 'Nivel actual'
                      : `Nivel actual ${item.level_offset > 0 ? '+' : '−'} 1`,
              },
      }))
      const common = {
        name: block.name,
        instructions: block.instructions,
        afterBlockRestMs: block.after_block_rest_ms,
        items,
      }
      if (block.method === 'PYRAMID') {
        return {
          ...common,
          method: block.method,
          pyramidDurationMs: block.pyramid_duration_ms,
          pyramidInitialReps: block.pyramid_initial_reps,
          pyramidRestMsPerRep: block.pyramid_rest_ms_per_rep,
        }
      }
      return {
        ...common,
        method: block.method,
        unitCount: block.unit_count,
        betweenUnitsRestMs: block.between_units_rest_ms,
      }
    }),
  }
}

function inputForValidation(input: ReturnType<typeof getInputFromRows>) {
  return {
    name: input.name,
    notes: input.notes,
    blocks: input.blocks.map((block) => ({
      ...block,
      items: block.items.map(({ display: _display, ...item }) => item),
    })),
  }
}

export function validateWorkout(
  input: WorkoutInputData,
  sqlite: Database.Database = getDatabase().sqlite,
) {
  const issues: WorkoutValidationIssue[] = []
  if (!input.blocks.length) {
    issues.push({
      path: 'blocks',
      code: 'BLOCK_REQUIRED',
      message: 'Añade al menos un bloque.',
    })
  }
  const currentLevels = new Map(
    (
      sqlite
        .prepare(
          'SELECT capability, maximum_level FROM current_capability_levels',
        )
        .all() as Array<{ capability: Capability; maximum_level: number }>
    ).map((row) => [row.capability, row.maximum_level]),
  )
  const variantExists = sqlite.prepare(
    'SELECT 1 FROM exercise_variants WHERE id = ? AND is_active = 1',
  )
  const relativeDefinitionExists = sqlite.prepare(
    `SELECT 1 FROM capability_level_definitions
     WHERE capability = ? AND level = ?`,
  )

  input.blocks.forEach((block, blockIndex) => {
    const base = `blocks.${blockIndex}`
    const requiredItems = expectedItemCount(block.method)
    if (block.items.length !== requiredItems) {
      issues.push({
        path: `${base}.items`,
        code: 'INVALID_ITEM_COUNT',
        message:
          block.method === 'SUPERSET'
            ? 'Un superset necesita exactamente dos variantes.'
            : 'Este bloque necesita exactamente una variante.',
      })
    }
    if (block.method === 'PYRAMID') {
      if (block.pyramidDurationMs === null)
        issues.push({
          path: `${base}.pyramidDurationMs`,
          code: 'REQUIRED',
          message: 'Indica la duración de la pirámide.',
        })
      if (block.pyramidInitialReps === null)
        issues.push({
          path: `${base}.pyramidInitialReps`,
          code: 'REQUIRED',
          message: 'Indica las repeticiones iniciales.',
        })
      if (block.pyramidRestMsPerRep === null)
        issues.push({
          path: `${base}.pyramidRestMsPerRep`,
          code: 'REQUIRED',
          message: 'Indica el descanso por repetición.',
        })
    } else {
      if (block.unitCount === null)
        issues.push({
          path: `${base}.unitCount`,
          code: 'REQUIRED',
          message:
            block.method === 'SUPERSET'
              ? 'Indica el número de supersets.'
              : 'Indica el número de series.',
        })
      if (block.betweenUnitsRestMs === null)
        issues.push({
          path: `${base}.betweenUnitsRestMs`,
          code: 'REQUIRED',
          message: 'Indica el descanso entre unidades.',
        })
    }

    block.items.forEach((item, itemIndex) => {
      const itemPath = `${base}.items.${itemIndex}`
      if (item.selection.kind === 'EXPLICIT_VARIANT') {
        if (!item.selection.exerciseVariantId) {
          issues.push({
            path: `${itemPath}.selection.exerciseVariantId`,
            code: 'VARIANT_REQUIRED',
            message: 'Selecciona una variante.',
          })
        } else if (!variantExists.get(item.selection.exerciseVariantId)) {
          issues.push({
            path: `${itemPath}.selection.exerciseVariantId`,
            code: 'VARIANT_NOT_FOUND',
            message: 'La variante seleccionada ya no está disponible.',
          })
        }
      } else if (
        item.selection.capability === null ||
        item.selection.levelOffset === null
      ) {
        issues.push({
          path: `${itemPath}.selection`,
          code: 'RELATIVE_SELECTION_INCOMPLETE',
          message: 'Completa la capacidad y el nivel relativo.',
        })
      } else {
        const current = currentLevels.get(item.selection.capability)
        if (current === undefined) {
          issues.push({
            path: `${itemPath}.selection`,
            code: 'CURRENT_LEVEL_UNAVAILABLE',
            message: `No hay un nivel actual para ${capabilityLabels[item.selection.capability]}.`,
          })
        } else {
          const level = Math.min(
            5,
            Math.max(1, current + item.selection.levelOffset),
          )
          if (!relativeDefinitionExists.get(item.selection.capability, level)) {
            issues.push({
              path: `${itemPath}.selection`,
              code: 'LEVEL_DEFINITION_UNAVAILABLE',
              message: 'No existe una variante para resolver ese nivel.',
            })
          }
        }
      }

      if (block.method === 'PYRAMID') {
        if (item.targets.length) {
          issues.push({
            path: `${itemPath}.targets`,
            code: 'PYRAMID_TARGET_NOT_ALLOWED',
            message: 'La pirámide genera sus repeticiones durante la sesión.',
          })
        }
      } else if (!item.targets.length) {
        issues.push({
          path: `${itemPath}.targets`,
          code: 'TARGET_REQUIRED',
          message: 'Añade un objetivo de repeticiones o duración.',
        })
      } else {
        const commonTargets = item.targets.filter(
          (target) => target.unitIndex === null,
        )
        const unitTargets = item.targets.filter(
          (target) => target.unitIndex !== null,
        )
        if (commonTargets.length && unitTargets.length) {
          issues.push({
            path: `${itemPath}.targets`,
            code: 'MIXED_TARGET_MODE',
            message:
              'Usa un objetivo común o uno por serie, pero no ambos a la vez.',
          })
        } else if (commonTargets.length !== 1 && !unitTargets.length) {
          issues.push({
            path: `${itemPath}.targets`,
            code: 'INVALID_COMMON_TARGET',
            message: 'Define un único objetivo común.',
          })
        } else if (unitTargets.length) {
          const indexes = unitTargets.map((target) => target.unitIndex)
          const expectedIndexes = Array.from(
            { length: block.unitCount ?? 0 },
            (_value, index) => index,
          )
          if (
            indexes.length !== expectedIndexes.length ||
            expectedIndexes.some((index) => !indexes.includes(index))
          ) {
            issues.push({
              path: `${itemPath}.targets`,
              code: 'INCOMPLETE_UNIT_TARGETS',
              message:
                block.method === 'SUPERSET'
                  ? 'Define un objetivo para cada ronda.'
                  : 'Define un objetivo para cada serie.',
            })
          }
        }
      }
    })
  })
  return { startable: issues.length === 0, issues }
}

function workoutSummary(
  workout: WorkoutRow,
  input: WorkoutInputData,
  sqlite: Database.Database,
) {
  const validation = validateWorkout(input, sqlite)
  const methods = [...new Set(input.blocks.map((block) => block.method))]
  return {
    id: workout.id,
    name: workout.name,
    notes: workout.notes,
    queuePosition: workout.queue_position,
    version: workout.version,
    createdAt: iso(workout.created_at),
    updatedAt: iso(workout.updated_at),
    blockCount: input.blocks.length,
    methods,
    methodLabels: methods.map((method) => trainingMethodLabels[method]),
    estimatedDurationMs: estimateWorkoutDurationMs(input.blocks),
    startable: validation.startable,
    issueCount: validation.issues.length,
  }
}

export function getWorkout(workoutId: string) {
  const sqlite = getDatabase().sqlite
  const workout = sqlite
    .prepare(`SELECT * FROM workouts WHERE id = ? AND status = 'PENDING'`)
    .get(workoutId) as WorkoutRow | undefined
  if (!workout) return null
  const enrichedInput = getInputFromRows(sqlite, workout)
  const input = inputForValidation(enrichedInput)
  return {
    id: workout.id,
    version: workout.version,
    status: workout.status,
    queuePosition: workout.queue_position,
    createdAt: iso(workout.created_at),
    updatedAt: iso(workout.updated_at),
    name: enrichedInput.name,
    notes: enrichedInput.notes,
    blocks: enrichedInput.blocks,
    summary: workoutSummary(workout, input, sqlite),
    validation: validateWorkout(input, sqlite),
  }
}

export function listWorkoutQueue() {
  const sqlite = getDatabase().sqlite
  const rows = sqlite
    .prepare(
      `SELECT * FROM workouts WHERE status = 'PENDING'
       ORDER BY queue_position`,
    )
    .all() as WorkoutRow[]
  return {
    version: queueVersion(sqlite),
    items: rows.map((row) => {
      const input = inputForValidation(getInputFromRows(sqlite, row))
      return workoutSummary(row, input, sqlite)
    }),
  }
}

function insertAggregate(
  sqlite: Database.Database,
  workoutId: string,
  input: WorkoutInputData,
) {
  const insertBlock = sqlite.prepare(
    `INSERT INTO workout_blocks(
       id, workout_id, position, name, instructions, method, unit_count,
       between_units_rest_ms, after_block_rest_ms, pyramid_duration_ms,
       pyramid_initial_reps, pyramid_rest_ms_per_rep
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertItem = sqlite.prepare(
    `INSERT INTO workout_block_items(
       id, workout_block_id, position, selection_kind, exercise_variant_id,
       capability, level_offset
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertTarget = sqlite.prepare(
    `INSERT INTO workout_block_item_targets(
       id, workout_block_item_id, position, unit_index, label, metric_kind, scope,
       minimum_value, maximum_value
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  input.blocks.forEach((block, blockPosition) => {
    const blockId = uuidv7()
    insertBlock.run(
      blockId,
      workoutId,
      blockPosition,
      block.name || null,
      block.instructions || null,
      block.method,
      block.method === 'PYRAMID' ? null : block.unitCount,
      block.method === 'PYRAMID' ? null : block.betweenUnitsRestMs,
      block.afterBlockRestMs,
      block.method === 'PYRAMID' ? block.pyramidDurationMs : null,
      block.method === 'PYRAMID' ? block.pyramidInitialReps : null,
      block.method === 'PYRAMID' ? block.pyramidRestMsPerRep : null,
    )
    block.items.forEach((item, itemPosition) => {
      const itemId = uuidv7()
      const exerciseVariantId =
        item.selection.kind === 'EXPLICIT_VARIANT'
          ? item.selection.exerciseVariantId
          : null
      const capability =
        item.selection.kind === 'CAPABILITY_RELATIVE'
          ? item.selection.capability
          : null
      const levelOffset =
        item.selection.kind === 'CAPABILITY_RELATIVE'
          ? item.selection.levelOffset
          : null
      insertItem.run(
        itemId,
        blockId,
        itemPosition,
        item.selection.kind,
        exerciseVariantId,
        capability,
        levelOffset,
      )
      item.targets.forEach((target, targetPosition) => {
        insertTarget.run(
          uuidv7(),
          itemId,
          targetPosition,
          target.unitIndex,
          target.label,
          target.metricKind,
          target.scope,
          target.minimumValue,
          target.maximumValue,
        )
      })
    })
  })
}

function withDerivedBlockNames(
  input: WorkoutInputData,
  sqlite: Database.Database,
): WorkoutInputData {
  const variantName = sqlite.prepare(
    `SELECT exercise_name, name FROM exercise_variants
     WHERE id = ? AND is_active = 1`,
  )
  return {
    ...input,
    blocks: input.blocks.map((block, blockIndex) => {
      const itemNames = block.items
        .map((item) => {
          if (item.selection.kind === 'EXPLICIT_VARIANT') {
            if (!item.selection.exerciseVariantId) return null
            const variant = variantName.get(
              item.selection.exerciseVariantId,
            ) as { exercise_name: string; name: string } | undefined
            if (!variant) return null
            return variant.exercise_name === variant.name
              ? variant.name
              : `${variant.exercise_name} · ${variant.name}`
          }
          if (!item.selection.capability) return null
          const offset = item.selection.levelOffset
          const level =
            offset === null || offset === 0
              ? 'nivel actual'
              : `nivel actual ${offset > 0 ? '+' : '−'} 1`
          return `${capabilityLabels[item.selection.capability]} · ${level}`
        })
        .filter((name): name is string => Boolean(name))
      return {
        ...block,
        afterBlockRestMs:
          blockIndex === input.blocks.length - 1 ? 0 : block.afterBlockRestMs,
        name: (
          itemNames.join(' + ') || trainingMethodLabels[block.method]
        ).slice(0, 120),
      }
    }),
  }
}

export function createWorkout(rawInput: WorkoutInputData) {
  const sqlite = getDatabase().sqlite
  const input = withDerivedBlockNames(
    workoutInputSchema.parse(rawInput),
    sqlite,
  )
  return sqlite.transaction(() => {
    const position = (
      sqlite
        .prepare(
          `SELECT COALESCE(MAX(queue_position), -1) + 1 AS position
           FROM workouts WHERE status = 'PENDING'`,
        )
        .get() as { position: number }
    ).position
    const id = uuidv7()
    const now = Date.now()
    sqlite
      .prepare(
        `INSERT INTO workouts(
           id, name, notes, status, queue_position, version, created_at, updated_at
         ) VALUES (?, ?, ?, 'PENDING', ?, 1, ?, ?)`,
      )
      .run(id, input.name, input.notes || null, position, now, now)
    insertAggregate(sqlite, id, input)
    incrementQueueVersion(sqlite)
    return getWorkout(id)
  })()
}

export function updateWorkout(
  workoutId: string,
  expectedVersion: number,
  rawInput: WorkoutInputData,
) {
  const sqlite = getDatabase().sqlite
  const input = withDerivedBlockNames(
    workoutInputSchema.parse(rawInput),
    sqlite,
  )
  return sqlite.transaction(() => {
    const now = Date.now()
    const update = sqlite
      .prepare(
        `UPDATE workouts SET name = ?, notes = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND status = 'PENDING' AND version = ?`,
      )
      .run(input.name, input.notes || null, now, workoutId, expectedVersion)
    if (!update.changes) {
      const exists = sqlite
        .prepare(`SELECT 1 FROM workouts WHERE id = ? AND status = 'PENDING'`)
        .get(workoutId)
      if (!exists) throw new WorkoutNotFoundError()
      throw new WorkoutVersionError()
    }
    sqlite
      .prepare('DELETE FROM workout_blocks WHERE workout_id = ?')
      .run(workoutId)
    insertAggregate(sqlite, workoutId, input)
    incrementQueueVersion(sqlite)
    return getWorkout(workoutId)
  })()
}

export function deleteWorkout(workoutId: string, expectedVersion: number) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const row = sqlite
      .prepare(`SELECT * FROM workouts WHERE id = ? AND status = 'PENDING'`)
      .get(workoutId) as WorkoutRow | undefined
    if (!row) throw new WorkoutNotFoundError()
    if (row.version !== expectedVersion) throw new WorkoutVersionError()
    sqlite.prepare('DELETE FROM workouts WHERE id = ?').run(workoutId)
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position + 1000000
         WHERE status = 'PENDING' AND queue_position > ?`,
      )
      .run(row.queue_position)
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position - 1000001
         WHERE status = 'PENDING' AND queue_position > 1000000`,
      )
      .run()
    incrementQueueVersion(sqlite)
    return true
  })()
}

export function duplicateWorkout(workoutId: string) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    const source = sqlite
      .prepare(`SELECT * FROM workouts WHERE id = ? AND status = 'PENDING'`)
      .get(workoutId) as WorkoutRow | undefined
    if (!source || source.queue_position === null)
      throw new WorkoutNotFoundError()
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position + 1000000
         WHERE status = 'PENDING' AND queue_position > ?`,
      )
      .run(source.queue_position)
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position - 999999
         WHERE status = 'PENDING' AND queue_position > 1000000`,
      )
      .run()
    const sourceInput = inputForValidation(getInputFromRows(sqlite, source))
    const name = `${source.name} (copia)`.slice(0, 120)
    const id = uuidv7()
    const now = Date.now()
    sqlite
      .prepare(
        `INSERT INTO workouts(
           id, name, notes, status, queue_position, version, created_at, updated_at
         ) VALUES (?, ?, ?, 'PENDING', ?, 1, ?, ?)`,
      )
      .run(id, name, source.notes, source.queue_position + 1, now, now)
    insertAggregate(sqlite, id, { ...sourceInput, name })
    incrementQueueVersion(sqlite)
    return getWorkout(id)
  })()
}

export function reorderWorkoutQueue(
  expectedVersion: number,
  workoutIds: string[],
) {
  const sqlite = getDatabase().sqlite
  return sqlite.transaction(() => {
    if (queueVersion(sqlite) !== expectedVersion)
      throw new WorkoutVersionError()
    const current = (
      sqlite
        .prepare(
          `SELECT id FROM workouts WHERE status = 'PENDING' ORDER BY queue_position`,
        )
        .all() as Array<{ id: string }>
    ).map((row) => row.id)
    if (
      workoutIds.length !== current.length ||
      new Set(workoutIds).size !== workoutIds.length ||
      current.some((id) => !workoutIds.includes(id))
    ) {
      throw new WorkoutQueueConflictError()
    }
    sqlite
      .prepare(
        `UPDATE workouts SET queue_position = queue_position + 1000000
         WHERE status = 'PENDING'`,
      )
      .run()
    const updatePosition = sqlite.prepare(
      `UPDATE workouts SET queue_position = ? WHERE id = ? AND status = 'PENDING'`,
    )
    workoutIds.forEach((id, position) => updatePosition.run(position, id))
    incrementQueueVersion(sqlite)
    return listWorkoutQueue()
  })()
}

export function getWorkoutValidation(workoutId: string) {
  const workout = getWorkout(workoutId)
  if (!workout) return null
  return workout.validation
}

export function emptyWorkoutInput(
  name = 'Nuevo entrenamiento',
): WorkoutInputData {
  return { name, notes: null, blocks: [] }
}

export function newBlock(method: TrainingMethod): WorkoutBlockInput {
  const emptySelection = {
    kind: 'EXPLICIT_VARIANT' as const,
    exerciseVariantId: null,
  }
  const emptyTarget = {
    unitIndex: null,
    label: 'Objetivo',
    metricKind: 'REPETITIONS' as const,
    scope: 'TOTAL' as const,
    minimumValue: 1,
    maximumValue: 1,
  }
  const common = {
    name: null,
    instructions: null,
    afterBlockRestMs: 60000,
  }
  if (method === 'PYRAMID') {
    return {
      ...common,
      method,
      pyramidDurationMs: 420000,
      pyramidInitialReps: 1,
      pyramidRestMsPerRep: 1000,
      items: [{ selection: emptySelection, targets: [] }],
    }
  }
  return {
    ...common,
    method,
    unitCount: 3,
    betweenUnitsRestMs: 60000,
    items: Array.from({ length: method === 'SUPERSET' ? 2 : 1 }, () => ({
      selection: { ...emptySelection },
      targets: [{ ...emptyTarget }],
    })),
  }
}

export function getCapabilitiesForWorkout() {
  return capabilities.map((capability) => ({
    value: capability,
    label: capabilityLabels[capability],
  }))
}
