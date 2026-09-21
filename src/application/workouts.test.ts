import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from '../server/config'
import type { WorkoutInputData } from '../contracts/workout'
import {
  WorkoutQueueConflictError,
  WorkoutVersionError,
  createWorkout,
  deleteWorkout,
  duplicateWorkout,
  getWorkout,
  listWorkoutQueue,
  newBlock,
  reorderWorkoutQueue,
  updateWorkout,
} from './workouts'

const testDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'training-workout-'),
)
const databasePath = path.join(testDirectory, 'training.sqlite')

beforeEach(() => {
  closeDatabase()
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true })
  }
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = databasePath
  resetConfigForTests()
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testDirectory, { recursive: true, force: true })
})

function validWorkout(name: string): WorkoutInputData {
  const variant = getDatabase()
    .sqlite.prepare(
      `SELECT id FROM exercise_variants WHERE is_active = 1 ORDER BY name LIMIT 1`,
    )
    .get() as { id: string }
  const block = newBlock('NORMAL_SETS')
  block.items[0].selection = {
    kind: 'EXPLICIT_VARIANT',
    exerciseVariantId: variant.id,
  }
  return { name, notes: null, blocks: [block] }
}

describe('workout planning', () => {
  it('uses seven-minute pyramids and one-minute rests by default', () => {
    const normalSets = newBlock('NORMAL_SETS')
    const pyramid = newBlock('PYRAMID')
    if (normalSets.method === 'PYRAMID' || pyramid.method !== 'PYRAMID') {
      throw new Error('Unexpected block method')
    }
    expect(normalSets.afterBlockRestMs).toBe(60000)
    expect(normalSets.betweenUnitsRestMs).toBe(60000)
    expect(pyramid.afterBlockRestMs).toBe(60000)
    expect(pyramid.pyramidDurationMs).toBe(420000)
  })

  it('appends creates and inserts duplicates immediately after the source', () => {
    const first = createWorkout(validWorkout('Primero'))
    const second = createWorkout(validWorkout('Segundo'))
    if (!first || !second) throw new Error('Expected workouts')
    const copy = duplicateWorkout(first.id)
    expect(copy?.name).toBe('Primero (copia)')
    expect(listWorkoutQueue().items.map((item) => item.name)).toEqual([
      'Primero',
      'Primero (copia)',
      'Segundo',
    ])
  })

  it('distinguishes a saveable draft from a startable workout', () => {
    const draft = createWorkout({
      name: 'Borrador',
      notes: null,
      blocks: [newBlock('SUPERSET')],
    })
    expect(draft?.validation.startable).toBe(false)
    expect(
      draft?.validation.issues.some(
        (issue) => issue.code === 'VARIANT_REQUIRED',
      ),
    ).toBe(true)
    expect(draft?.blocks[0].items).toHaveLength(2)
  })

  it('keeps relative selections saveable without a current assessment', () => {
    const block = newBlock('PYRAMID')
    block.items[0].selection = {
      kind: 'CAPABILITY_RELATIVE',
      capability: 'PULL_UP',
      levelOffset: 1,
    }
    const workout = createWorkout({
      name: 'Relativo',
      notes: null,
      blocks: [block],
    })
    expect(workout?.validation.startable).toBe(false)
    expect(workout?.validation.issues[0].code).toBe('CURRENT_LEVEL_UNAVAILABLE')
  })

  it('rejects stale workout versions without replacing the aggregate', () => {
    const created = createWorkout(validWorkout('Original'))
    if (!created) throw new Error('Expected workout')
    updateWorkout(created.id, created.version, validWorkout('Actualizado'))
    expect(() =>
      updateWorkout(created.id, created.version, validWorkout('Pisado')),
    ).toThrow(WorkoutVersionError)
    expect(getWorkout(created.id)?.name).toBe('Actualizado')
  })

  it('reorders atomically and rejects incomplete queue payloads', () => {
    const first = createWorkout(validWorkout('Uno'))
    const second = createWorkout(validWorkout('Dos'))
    const queue = listWorkoutQueue()
    if (!first || !second) throw new Error('Expected workouts')
    expect(() => reorderWorkoutQueue(queue.version, [second.id])).toThrow(
      WorkoutQueueConflictError,
    )
    expect(listWorkoutQueue().items.map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ])
    const reordered = reorderWorkoutQueue(queue.version, [second.id, first.id])
    expect(reordered.items.map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ])
  })

  it('requires the current workout version when deleting', () => {
    const created = createWorkout(validWorkout('Borrar'))
    if (!created) throw new Error('Expected workout')
    expect(() => deleteWorkout(created.id, created.version + 1)).toThrow(
      WorkoutVersionError,
    )
    expect(getWorkout(created.id)).not.toBeNull()
    expect(deleteWorkout(created.id, created.version)).toBe(true)
  })

  it('derives block names from their exercises and only keeps rests between blocks', () => {
    const input = validWorkout('Nombres automáticos')
    const firstBlock = input.blocks[0]
    firstBlock.name = 'Este nombre se ignora'
    firstBlock.afterBlockRestMs = 90000
    const secondBlock = structuredClone(firstBlock)
    secondBlock.afterBlockRestMs = 120000
    input.blocks.push(secondBlock)

    const created = createWorkout(input)
    const selection = firstBlock.items[0].selection
    if (selection.kind !== 'EXPLICIT_VARIANT' || !selection.exerciseVariantId)
      throw new Error('Expected an explicit variant')
    const variant = getDatabase()
      .sqlite.prepare(
        'SELECT exercise_name, name FROM exercise_variants WHERE id = ?',
      )
      .get(selection.exerciseVariantId) as {
      exercise_name: string
      name: string
    }
    const expectedName =
      variant.exercise_name === variant.name
        ? variant.name
        : `${variant.exercise_name} · ${variant.name}`
    expect(created?.blocks[0].name).not.toBe('Este nombre se ignora')
    expect(created?.blocks[0].name).toBe(expectedName)
    expect(created?.blocks[0].afterBlockRestMs).toBe(90000)
    expect(created?.blocks[1].afterBlockRestMs).toBe(0)
  })

  it('persists one common target for every set', () => {
    const input = validWorkout('Objetivo común')
    input.blocks[0].items[0].targets = [
      {
        unitIndex: null,
        label: 'Objetivo',
        metricKind: 'REPETITIONS',
        scope: 'TOTAL',
        minimumValue: 8,
        maximumValue: 12,
      },
    ]

    const created = createWorkout(input)
    expect(created?.validation.startable).toBe(true)
    expect(created?.blocks[0].items[0].targets).toEqual(
      input.blocks[0].items[0].targets,
    )
  })

  it('persists and validates one target per set', () => {
    const input = validWorkout('Objetivos por serie')
    const block = input.blocks[0]
    if (block.method === 'PYRAMID') throw new Error('Expected normal sets')
    block.unitCount = 3
    block.items[0].targets = [8, 10, 12].map((repetitions, unitIndex) => ({
      unitIndex,
      label: 'Objetivo',
      metricKind: 'REPETITIONS' as const,
      scope: 'TOTAL' as const,
      minimumValue: repetitions,
      maximumValue: repetitions,
    }))

    const created = createWorkout(input)
    expect(created?.validation.startable).toBe(true)
    expect(
      created?.blocks[0].items[0].targets.map((target) => target.unitIndex),
    ).toEqual([0, 1, 2])
  })
})
