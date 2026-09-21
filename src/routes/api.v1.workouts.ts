import { createFileRoute } from '@tanstack/react-router'
import { workoutInputSchema } from '../contracts/workout'
import { createWorkout } from '../application/workouts'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, rawJsonResponse } from '../server/http'
import { executeIdempotent, workoutEtag } from '../server/workout-api'

export const Route = createFileRoute('/api/v1/workouts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const principal = authenticateApiRequest(request, 'workouts:write')
          const body = workoutInputSchema.parse(await request.json())
          const result = executeIdempotent(
            {
              tokenId: principal.tokenId,
              key: request.headers.get('idempotency-key'),
              method: 'POST',
              path: '/api/v1/workouts',
              body,
            },
            () => {
              const workout = createWorkout(body)
              if (!workout) throw new Error('WORKOUT_CREATE_FAILED')
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
