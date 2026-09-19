import { createFileRoute } from '@tanstack/react-router'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, rawJsonResponse } from '../server/http'
import { openApiDocument } from '../server/openapi'

export const Route = createFileRoute('/api/v1/openapi.json')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          return rawJsonResponse(openApiDocument)
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
