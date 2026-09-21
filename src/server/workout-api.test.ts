import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from './config'
import { createWorkout, listWorkoutQueue } from '../application/workouts'
import {
  ApiContractError,
  executeIdempotent,
  queueEtag,
  requireIfMatch,
  workoutEtag,
} from './workout-api'

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-api-'))
const databasePath = path.join(testDirectory, 'training.sqlite')

beforeEach(() => {
  closeDatabase()
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true })
  }
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = databasePath
  resetConfigForTests()
  getDatabase()
    .sqlite.prepare(
      `INSERT INTO api_tokens(
         id, name, token_prefix, secret_hash, can_read, can_write_workouts, created_at
       ) VALUES ('token-id', 'Test', 'prefix1234', 'hash', 1, 1, ?)`,
    )
    .run(Date.now())
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testDirectory, { recursive: true, force: true })
})

describe('workout API mechanics', () => {
  it('builds opaque ETags and enforces If-Match', () => {
    expect(queueEtag(4)).toBe('"workout-queue-v4"')
    expect(workoutEtag('abc', 2)).toBe('"workout-abc-v2"')
    const request = new Request('http://localhost/api', {
      headers: { 'if-match': queueEtag(4) },
    })
    expect(() => requireIfMatch(request, queueEtag(4))).not.toThrow()
    expect(() =>
      requireIfMatch(new Request('http://localhost/api'), queueEtag(4)),
    ).toThrow(ApiContractError)
  })

  it('replays an idempotent creation without duplicating rows', () => {
    const body = { name: 'API', notes: null, blocks: [] }
    const execute = () =>
      executeIdempotent(
        {
          tokenId: 'token-id',
          key: 'same-key',
          method: 'POST',
          path: '/api/v1/workouts',
          body,
        },
        () => {
          const workout = createWorkout(body)
          return {
            status: 201,
            body: { data: workout },
            headers: { location: `/api/v1/workouts/${workout?.id}` },
          }
        },
      )
    const first = execute()
    const second = execute()
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.body).toEqual(first.body)
    expect(listWorkoutQueue().items).toHaveLength(1)
  })

  it('rejects an idempotency key reused with another body', () => {
    const base = {
      tokenId: 'token-id',
      key: 'reused-key',
      method: 'POST',
      path: '/api/v1/workouts',
    }
    executeIdempotent({ ...base, body: { name: 'Uno' } }, () => ({
      status: 201,
      body: { ok: true },
      headers: {},
    }))
    expect(() =>
      executeIdempotent({ ...base, body: { name: 'Dos' } }, () => ({
        status: 201,
        body: { ok: true },
        headers: {},
      })),
    ).toThrowError(/otra petición/)
  })
})
