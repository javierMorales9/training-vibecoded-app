import { createFileRoute } from '@tanstack/react-router'
import { reorderQueueSchema } from '../contracts/workout'
import { listWorkoutQueue, reorderWorkoutQueue } from '../application/workouts'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, rawJsonResponse } from '../server/http'
import { queueEtag, requireIfMatch } from '../server/workout-api'

export const Route = createFileRoute('/api/v1/workout-queue')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          const queue = listWorkoutQueue()
          return jsonResponse(queue, {
            headers: { etag: queueEtag(queue.version) },
          })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
      PUT: async ({ request }) => {
        try {
          authenticateApiRequest(request, 'workouts:write')
          const current = listWorkoutQueue()
          requireIfMatch(request, queueEtag(current.version))
          const body = reorderQueueSchema
            .pick({ workoutIds: true })
            .parse(await request.json())
          const queue = reorderWorkoutQueue(current.version, body.workoutIds)
          return rawJsonResponse(
            { data: queue },
            { headers: { etag: queueEtag(queue.version) } },
          )
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
