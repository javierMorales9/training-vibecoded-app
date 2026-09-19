import { createFileRoute } from '@tanstack/react-router'
import { getCapabilityLevelDefinitions } from '../application/catalog'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, collectionResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/capability-level-definitions')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          return collectionResponse(getCapabilityLevelDefinitions(), {})
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
