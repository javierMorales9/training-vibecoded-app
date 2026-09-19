import { createFileRoute } from '@tanstack/react-router'
import { getCatalogOptions } from '../application/catalog'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/exercise-catalog-options')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          return jsonResponse(getCatalogOptions())
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
