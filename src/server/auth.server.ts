import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createMiddleware } from '@tanstack/react-start'
import {
  getRequest,
  getRequestHeader,
  useSession,
} from '@tanstack/react-start/server'
import { v7 as uuidv7 } from 'uuid'
import { getConfig } from './config'
import { getDatabase } from '../infrastructure/db/database'

interface WebSessionData {
  authenticated: boolean
  passwordVersion: string
}

interface TokenRow {
  id: string
  name: string
  token_prefix: string
  secret_hash: string
  can_read: number
  can_write_workouts: number
  revoked_at: number | null
  last_used_at: number | null
}

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex')

function passwordVersion() {
  return digest(`password-version:${getConfig().appPassword}`).slice(0, 24)
}

function sessionConfig() {
  const config = getConfig()
  return {
    name: 'training-session',
    password: config.sessionSecret,
    maxAge: 30 * 24 * 60 * 60,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax' as const,
      path: '/',
    },
  }
}

export async function getWebAuthState() {
  const session = await useSession<WebSessionData>(sessionConfig())
  const authenticated =
    session.data.authenticated === true &&
    session.data.passwordVersion === passwordVersion()
  return { authenticated }
}

export async function authenticateWebPassword(password: string) {
  const expected = Buffer.from(getConfig().appPassword, 'utf8')
  const received = Buffer.from(password, 'utf8')
  const paddedExpected = Buffer.alloc(
    Math.max(expected.length, received.length),
  )
  const paddedReceived = Buffer.alloc(paddedExpected.length)
  expected.copy(paddedExpected)
  received.copy(paddedReceived)
  const valid =
    timingSafeEqual(paddedExpected, paddedReceived) &&
    expected.length === received.length
  if (!valid) return false

  const session = await useSession<WebSessionData>(sessionConfig())
  await session.update({
    authenticated: true,
    passwordVersion: passwordVersion(),
  })
  return true
}

export async function clearWebSession() {
  const session = await useSession<WebSessionData>(sessionConfig())
  await session.clear()
}

export async function requireWebSession() {
  const state = await getWebAuthState()
  if (!state.authenticated) throw new Error('UNAUTHORIZED')
  return state
}

export function assertSameOrigin() {
  const origin = getRequestHeader('origin')
  if (!origin) return
  if (new URL(origin).origin !== getConfig().appOrigin)
    throw new Error('INVALID_ORIGIN')
}

export const webAuthMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const auth = await requireWebSession()
    return next({ context: { auth } })
  },
)

export function listApiTokens() {
  return (
    getDatabase()
      .sqlite.prepare(
        `
        SELECT id, name, token_prefix, can_read, can_write_workouts, created_at, last_used_at, revoked_at
        FROM api_tokens ORDER BY created_at DESC
      `,
      )
      .all() as Array<{
      id: string
      name: string
      token_prefix: string
      can_read: number
      can_write_workouts: number
      created_at: number
      last_used_at: number | null
      revoked_at: number | null
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.token_prefix,
    canRead: Boolean(row.can_read),
    canWriteWorkouts: Boolean(row.can_write_workouts),
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at
      ? new Date(row.last_used_at).toISOString()
      : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  }))
}

export function createApiToken(input: {
  name: string
  canRead: boolean
  canWriteWorkouts: boolean
}) {
  const secret = randomBytes(32).toString('base64url')
  const prefix = secret.slice(0, 10)
  const token = `trn_${prefix}_${secret}`
  const now = Date.now()
  const id = uuidv7()
  getDatabase()
    .sqlite.prepare(
      `
      INSERT INTO api_tokens(
        id, name, token_prefix, secret_hash, can_read, can_write_workouts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      input.name,
      prefix,
      digest(token),
      input.canRead ? 1 : 0,
      input.canWriteWorkouts ? 1 : 0,
      now,
    )
  return { id, token, prefix }
}

export function revokeApiToken(id: string) {
  const result = getDatabase()
    .sqlite.prepare(
      'UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
    )
    .run(Date.now(), id)
  return result.changes > 0
}

export interface ApiPrincipal {
  tokenId: string
  tokenName: string
  canRead: boolean
  canWriteWorkouts: boolean
}

export function authenticateApiRequest(
  request: Request,
  permission: 'read' | 'workouts:write' = 'read',
): ApiPrincipal {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const prefix = token?.match(/^trn_([A-Za-z0-9_-]{10})_/)?.[1]
  if (!token || !prefix) throw new ApiAuthenticationError('INVALID_TOKEN')

  const row = getDatabase()
    .sqlite.prepare(
      `
      SELECT id, name, token_prefix, secret_hash, can_read, can_write_workouts, revoked_at, last_used_at
      FROM api_tokens WHERE token_prefix = ? AND revoked_at IS NULL
    `,
    )
    .get(prefix) as TokenRow | undefined
  if (!row) throw new ApiAuthenticationError('INVALID_TOKEN')

  const actual = Buffer.from(digest(token), 'hex')
  const expected = Buffer.from(row.secret_hash, 'hex')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiAuthenticationError('INVALID_TOKEN')
  }

  const principal = {
    tokenId: row.id,
    tokenName: row.name,
    canRead: Boolean(row.can_read),
    canWriteWorkouts: Boolean(row.can_write_workouts),
  }
  if (permission === 'read' && !principal.canRead)
    throw new ApiAuthenticationError('FORBIDDEN')
  if (permission === 'workouts:write' && !principal.canWriteWorkouts) {
    throw new ApiAuthenticationError('FORBIDDEN')
  }

  if (!row.last_used_at || Date.now() - row.last_used_at > 5 * 60 * 1000) {
    getDatabase()
      .sqlite.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
      .run(Date.now(), row.id)
  }
  return principal
}

export async function hasWebSessionForRequest() {
  getRequest()
  return (await getWebAuthState()).authenticated
}

export class ApiAuthenticationError extends Error {
  constructor(readonly reason: 'INVALID_TOKEN' | 'FORBIDDEN') {
    super(reason)
  }
}
