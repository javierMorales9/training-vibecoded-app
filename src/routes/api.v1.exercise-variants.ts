import { createFileRoute } from '@tanstack/react-router'
import { listCatalogVariants } from '../application/catalog'
import { authenticateApiRequest } from '../server/auth.server'
import { parseCatalogQuery } from '../server/api'
import { apiErrorResponse, collectionResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/exercise-variants')({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          authenticateApiRequest(request)
          const result = listCatalogVariants(
            parseCatalogQuery(new URL(request.url)),
            { api: true },
          )
          return collectionResponse(result.items, { page: result.page })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
