import { createFileRoute } from '@tanstack/react-router'
import { getCatalogHealth } from '../application/catalog'

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: () => Response.json({ status: 'ok', catalog: getCatalogHealth() }),
    },
  },
})
