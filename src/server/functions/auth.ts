import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  assertSameOrigin,
  authenticateWebPassword,
  clearWebSession,
  getWebAuthState,
  requireWebSession,
} from '../auth.server'

export const getAuthStateFn = createServerFn({ method: 'GET' }).handler(() =>
  getWebAuthState(),
)

export const loginFn = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().min(1).max(512) }))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const valid = await authenticateWebPassword(data.password)
    return { valid }
  })

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  await requireWebSession()
  assertSameOrigin()
  await clearWebSession()
  return { ok: true }
})
