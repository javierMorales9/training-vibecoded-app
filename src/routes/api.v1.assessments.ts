import { createFileRoute } from '@tanstack/react-router'
import { listAssessments } from '../application/assessments'
import { parseAssessmentsQuery } from '../server/api'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, collectionResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/assessments')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          const result = listAssessments(
            parseAssessmentsQuery(new URL(request.url)),
          )
          return collectionResponse(result.items, { page: result.page })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
