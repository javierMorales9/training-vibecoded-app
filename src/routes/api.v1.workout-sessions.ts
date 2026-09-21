import { createFileRoute } from '@tanstack/react-router'
import { listTrainingSessions } from '../application/training-sessions'
import { parseTrainingSessionsQuery } from '../server/api'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, collectionResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/workout-sessions')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          const result = listTrainingSessions(
            parseTrainingSessionsQuery(new URL(request.url)),
          )
          return collectionResponse(result.items, { page: result.page })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
