import { createFileRoute } from '@tanstack/react-router'
import { getCatalogVariant } from '../application/catalog'
import { apiVariantIdSchema } from '../server/api'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, problemResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/exercise-variants/$variantId')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          const variant = getCatalogVariant(
            apiVariantIdSchema.parse(params.variantId),
            { api: true },
          )
          return variant
            ? jsonResponse(variant)
            : problemResponse(
                404,
                'VARIANT_NOT_FOUND',
                'Variante no encontrada',
                'No existe una variante activa con ese identificador.',
                request,
              )
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
