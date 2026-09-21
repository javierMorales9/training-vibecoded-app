import { createFileRoute } from '@tanstack/react-router'
import { getCurrentCapabilityLevels } from '../application/assessments'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/current-capability-levels')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          return jsonResponse(getCurrentCapabilityLevels())
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
