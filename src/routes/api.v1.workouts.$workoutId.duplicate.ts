import { createFileRoute } from '@tanstack/react-router'
import { workoutIdSchema } from '../contracts/workout'
import { duplicateWorkout } from '../application/workouts'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, rawJsonResponse } from '../server/http'
import { executeIdempotent, workoutEtag } from '../server/workout-api'

export const Route = createFileRoute('/api/v1/workouts/$workoutId/duplicate')({
  server: {
    handlers: {
      POST: ({ request, params }) => {
        try {
          const principal = authenticateApiRequest(request, 'workouts:write')
          const { workoutId } = workoutIdSchema.parse(params)
          const path = `/api/v1/workouts/${workoutId}/duplicate`
          const result = executeIdempotent(
            {
              tokenId: principal.tokenId,
              key: request.headers.get('idempotency-key'),
              method: 'POST',
              path,
              body: null,
            },
            () => {
              const workout = duplicateWorkout(workoutId)
              if (!workout) throw new Error('WORKOUT_DUPLICATE_FAILED')
              return {
                status: 201,
                body: { data: workout },
                headers: {
                  location: `/api/v1/workouts/${workout.id}`,
                  etag: workoutEtag(workout.id, workout.version),
                },
              }
            },
          )
          return rawJsonResponse(result.body, {
            status: result.status,
            headers: {
              ...result.headers,
              ...(result.replayed ? { 'idempotency-replayed': 'true' } : {}),
            },
          })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
