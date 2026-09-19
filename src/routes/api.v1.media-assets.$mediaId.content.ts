import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse } from '../server/http'
import { serveMedia } from '../server/media'

export const Route = createFileRoute('/api/v1/media-assets/$mediaId/content')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          return await serveMedia(z.uuid().parse(params.mediaId), request)
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
