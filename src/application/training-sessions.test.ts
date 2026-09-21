import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from '../server/config'
import { createWorkout, newBlock } from './workouts'
import {
  ActiveTrainingSessionError,
  beginTrainingUnit,
  cancelTrainingSession,
  completeTrainingWork,
  getActiveTrainingSession,
  startTrainingSession,
} from './training-sessions'

const testDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'training-session-'),
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

function workout(
  method: 'NORMAL_SETS' | 'SUPERSET' | 'PYRAMID' = 'NORMAL_SETS',
) {
  const variant = getDatabase()
    .sqlite.prepare(
      `SELECT id FROM exercise_variants WHERE is_active = 1 LIMIT 1`,
    )
    .get() as { id: string }
  const block = newBlock(method)
  block.items.forEach((item) => {
    item.selection = { kind: 'EXPLICIT_VARIANT', exerciseVariantId: variant.id }
  })
  const created = createWorkout({
    name: 'Sesión',
    notes: null,
    blocks: [block],
  })
  if (!created) throw new Error('Expected workout')
  return created
}

describe('training sessions', () => {
  it('starts atomically, consumes the workout and persists work/rest transitions', () => {
    const created = workout()
    const session = startTrainingSession(created.id)
    expect(session?.phase).toBe('READY')
    expect(session?.units).toHaveLength(3)
    expect(getActiveTrainingSession()?.id).toBe(session?.id)

    const working = beginTrainingUnit(session!.id)
    expect(working?.phase).toBe('WORKING')
    const resting = completeTrainingWork(session!.id, null)
    expect(resting?.phase).toBe('RESTING')
    expect(resting?.units[0].status).toBe('COMPLETED')
    expect(resting?.units[0].restStartedAt).not.toBeNull()
    const nextWorking = beginTrainingUnit(session!.id)
    expect(nextWorking?.phase).toBe('WORKING')
    expect(nextWorking?.units[0].restCompletedAt).not.toBeNull()
  })

  it('treats a superset as one unit and blocks a second active session', () => {
    const created = workout('SUPERSET')
    const session = startTrainingSession(created.id)
    expect(session?.units).toHaveLength(3)
    expect(session?.units[0].items).toHaveLength(2)
    expect(() => startTrainingSession(created.id)).toThrow(
      ActiveTrainingSessionError,
    )
    beginTrainingUnit(session!.id)
    expect(completeTrainingWork(session!.id, null)?.phase).toBe('RESTING')
  })

  it('preserves pyramid configuration and calculates partial cancellation', () => {
    const created = workout('PYRAMID')
    const session = startTrainingSession(created.id)
    expect(session?.units[0].plannedWorkMs).toBe(420000)
    beginTrainingUnit(session!.id)
    const cancelled = cancelTrainingSession(session!.id, 'Sin energía')
    expect(cancelled?.status).toBe('CANCELLED')
    expect(cancelled?.completionRatio).toBeGreaterThanOrEqual(0)
    expect(getActiveTrainingSession()).toBeNull()
  })
})
