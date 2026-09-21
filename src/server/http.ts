import { randomUUID } from 'node:crypto'
import { ApiAuthenticationError } from './auth.server'
import { CatalogCursorError } from '../application/catalog'
import { AssessmentCursorError } from '../application/assessments'
import { TrainingSessionCursorError } from '../application/training-sessions'
import {
  WorkoutNotFoundError,
  WorkoutQueueConflictError,
  WorkoutVersionError,
} from '../application/workouts'
import { ApiContractError } from './workout-api'
import { ZodError } from 'zod'

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('x-request-id', headers.get('x-request-id') ?? randomUUID())
  return new Response(JSON.stringify({ data }), { ...init, headers })
}

export function rawJsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('x-request-id', headers.get('x-request-id') ?? randomUUID())
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function collectionResponse(
  data: unknown[],
  meta: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('x-request-id', headers.get('x-request-id') ?? randomUUID())
  return new Response(JSON.stringify({ data, meta }), { ...init, headers })
}

export function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  request: Request,
  errors?: Array<{ path: string; code: string; message: string }>,
) {
  const requestId = randomUUID()
  return new Response(
    JSON.stringify({
      type: `https://training.local/problems/${code.toLowerCase()}`,
      title,
      status,
      detail,
      instance: new URL(request.url).pathname,
      code,
      requestId,
      ...(errors ? { errors } : {}),
    }),
    {
      status,
      headers: {
        'content-type': 'application/problem+json; charset=utf-8',
        'x-request-id': requestId,
        ...(status === 401
          ? { 'www-authenticate': 'Bearer realm="training-api"' }
          : {}),
      },
    },
  )
}

export function apiErrorResponse(error: unknown, request: Request) {
  if (error instanceof ApiContractError) {
    return problemResponse(
      error.status,
      error.code,
      error.title,
      error.message,
      request,
    )
  }
  if (error instanceof WorkoutNotFoundError) {
    return problemResponse(
      404,
      'WORKOUT_NOT_FOUND',
      'Entrenamiento no encontrado',
      'No existe un entrenamiento pendiente con ese identificador.',
      request,
    )
  }
  if (error instanceof WorkoutVersionError) {
    return problemResponse(
      412,
      'VERSION_MISMATCH',
      'Versión desactualizada',
      'El recurso ha cambiado desde que se leyó.',
      request,
    )
  }
  if (error instanceof WorkoutQueueConflictError) {
    return problemResponse(
      409,
      'WORKOUT_QUEUE_CONFLICT',
      'Conflicto en la cola',
      'El orden debe contener exactamente todos los pendientes actuales.',
      request,
    )
  }
  if (error instanceof ApiAuthenticationError) {
    if (error.reason === 'FORBIDDEN') {
      return problemResponse(
        403,
        'INSUFFICIENT_SCOPE',
        'Permiso insuficiente',
        'El token no tiene el permiso necesario.',
        request,
      )
    }
    return problemResponse(
      401,
      'INVALID_TOKEN',
      'Token inválido',
      'Falta un Bearer token válido.',
      request,
    )
  }
  if (
    error instanceof CatalogCursorError ||
    error instanceof AssessmentCursorError ||
    error instanceof TrainingSessionCursorError
  ) {
    return problemResponse(
      400,
      error.code,
      'Cursor inválido',
      error.message,
      request,
    )
  }
  if (error instanceof SyntaxError) {
    return problemResponse(
      400,
      'BAD_REQUEST',
      'Petición inválida',
      error.message,
      request,
    )
  }
  if (error instanceof ZodError) {
    return problemResponse(
      422,
      'VALIDATION_ERROR',
      'Datos no válidos',
      'Hay parámetros que no cumplen el contrato.',
      request,
      error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    )
  }
  return problemResponse(
    500,
    'INTERNAL_ERROR',
    'Error interno',
    'No se pudo completar la petición.',
    request,
  )
}
