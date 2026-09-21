import { createFileRoute } from '@tanstack/react-router'
import { getTrainingSessionHistory } from '../application/training-sessions'
import { apiTrainingSessionIdSchema } from '../server/api'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, problemResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/workout-sessions/$sessionId')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          const session = getTrainingSessionHistory(
            apiTrainingSessionIdSchema.parse(params.sessionId),
          )
          return session
            ? jsonResponse(session)
            : problemResponse(
                404,
                'WORKOUT_SESSION_NOT_FOUND',
                'Sesión no encontrada',
                'No existe una sesión finalizada con ese identificador.',
                request,
              )
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
