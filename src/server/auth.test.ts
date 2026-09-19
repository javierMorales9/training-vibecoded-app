import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from './config'
import {
  ApiAuthenticationError,
  authenticateApiRequest,
  createApiToken,
  revokeApiToken,
} from './auth.server'

let testDirectory: string

beforeAll(() => {
  testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-auth-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = path.join(testDirectory, 'training.sqlite')
  resetConfigForTests()
  closeDatabase()
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testDirectory, { recursive: true, force: true })
})

describe('API tokens', () => {
  it('authenticates a read token without storing its plaintext', () => {
    const created = createApiToken({
      name: 'test reader',
      canRead: true,
      canWriteWorkouts: false,
    })
    const principal = authenticateApiRequest(
      new Request('http://localhost/api', {
        headers: { authorization: `Bearer ${created.token}` },
      }),
    )
    expect(principal).toMatchObject({
      tokenId: created.id,
      canRead: true,
      canWriteWorkouts: false,
    })
  })

  it('rejects revoked tokens', () => {
    const created = createApiToken({
      name: 'revoked',
      canRead: true,
      canWriteWorkouts: false,
    })
    expect(revokeApiToken(created.id)).toBe(true)
    expect(() =>
      authenticateApiRequest(
        new Request('http://localhost/api', {
          headers: { authorization: `Bearer ${created.token}` },
        }),
      ),
    ).toThrow(ApiAuthenticationError)
  })

  it('enforces token scopes', () => {
    const created = createApiToken({
      name: 'reader',
      canRead: true,
      canWriteWorkouts: false,
    })
    expect(() =>
      authenticateApiRequest(
        new Request('http://localhost/api', {
          headers: { authorization: `Bearer ${created.token}` },
        }),
        'workouts:write',
      ),
    ).toThrow('FORBIDDEN')
  })
})
