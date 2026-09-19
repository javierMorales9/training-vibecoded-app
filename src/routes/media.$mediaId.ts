import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getWebAuthState } from '../server/auth.server'
import { problemResponse } from '../server/http'
import { serveMedia } from '../server/media'

export const Route = createFileRoute('/media/$mediaId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await getWebAuthState()).authenticated)
          return problemResponse(
            401,
            'UNAUTHORIZED',
            'Sesión necesaria',
            'Inicia sesión para consultar este medio.',
            request,
          )
        const parsed = z.uuid().safeParse(params.mediaId)
        return parsed.success
          ? serveMedia(parsed.data, request)
          : problemResponse(
              404,
              'MEDIA_NOT_FOUND',
              'Medio no encontrado',
              'El identificador no es válido.',
              request,
            )
      },
    },
  },
})
