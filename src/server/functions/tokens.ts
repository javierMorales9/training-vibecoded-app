import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  assertSameOrigin,
  createApiToken,
  listApiTokens,
  requireWebSession,
  revokeApiToken,
} from '../auth.server'

export const listApiTokensFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireWebSession()
    return listApiTokens()
  },
)

export const createApiTokenFn = createServerFn({ method: 'POST' })
  .validator(
    z.strictObject({
      name: z.string().trim().min(1).max(80),
      canRead: z.boolean(),
      canWriteWorkouts: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return createApiToken(data)
  })

export const revokeApiTokenFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({ id: z.uuid() }))
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return { revoked: revokeApiToken(data.id) }
  })
