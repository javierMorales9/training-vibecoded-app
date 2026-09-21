import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { getDatabase } from '../infrastructure/db/database'

export class ApiContractError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    message: string,
  ) {
    super(message)
  }
}

export function workoutEtag(workoutId: string, version: number) {
  return `"workout-${workoutId}-v${version}"`
}

export function queueEtag(version: number) {
  return `"workout-queue-v${version}"`
}

export function requireIfMatch(request: Request, expected: string) {
  const value = request.headers.get('if-match')
  if (!value) {
    throw new ApiContractError(
      428,
      'PRECONDITION_REQUIRED',
      'Precondición necesaria',
      'Esta operación requiere la cabecera If-Match.',
    )
  }
  if (value !== expected) {
    throw new ApiContractError(
      412,
      'VERSION_MISMATCH',
      'Versión desactualizada',
      'El recurso ha cambiado desde que se leyó.',
    )
  }
}

interface IdempotentResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

export function executeIdempotent(
  input: {
    tokenId: string
    key: string | null
    method: string
    path: string
    body: unknown
  },
  operation: () => IdempotentResponse,
) {
  if (!input.key) {
    throw new ApiContractError(
      428,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Clave de idempotencia necesaria',
      'Esta operación requiere la cabecera Idempotency-Key.',
    )
  }
  if (input.key.length > 128) {
    throw new ApiContractError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
      'Clave de idempotencia inválida',
      'Idempotency-Key no puede superar 128 caracteres.',
    )
  }
  const sqlite = getDatabase().sqlite
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        method: input.method,
        path: input.path,
        body: input.body,
      }),
    )
    .digest('hex')
  return sqlite.transaction(() => {
    const now = Date.now()
    sqlite
      .prepare('DELETE FROM api_idempotency_keys WHERE expires_at <= ?')
      .run(now)
    const existing = sqlite
      .prepare(
        `SELECT request_hash, status_code, response_body, response_headers
         FROM api_idempotency_keys
         WHERE api_token_id = ? AND idempotency_key = ?`,
      )
      .get(input.tokenId, input.key) as
      | {
          request_hash: string
          status_code: number
          response_body: string
          response_headers: string
        }
      | undefined
    if (existing) {
      if (existing.request_hash !== hash) {
        throw new ApiContractError(
          409,
          'IDEMPOTENCY_KEY_REUSED',
          'Clave de idempotencia reutilizada',
          'La clave ya se utilizó con otra petición.',
        )
      }
      return {
        status: existing.status_code,
        body: JSON.parse(existing.response_body) as unknown,
        headers: JSON.parse(existing.response_headers) as Record<
          string,
          string
        >,
        replayed: true,
      }
    }
    const response = operation()
    sqlite
      .prepare(
        `INSERT INTO api_idempotency_keys(
           id, api_token_id, idempotency_key, request_hash, status_code,
           response_body, response_headers, created_at, expires_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv7(),
        input.tokenId,
        input.key,
        hash,
        response.status,
        JSON.stringify(response.body),
        JSON.stringify(response.headers),
        now,
        now + 24 * 60 * 60 * 1000,
      )
    return { ...response, replayed: false }
  })()
}
