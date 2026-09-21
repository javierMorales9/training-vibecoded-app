import { createServerFn } from '@tanstack/react-start'
import {
  cancelTrainingSessionSchema,
  completeTrainingWorkSchema,
  startTrainingSessionSchema,
  trainingSessionIdSchema,
} from '../../contracts/training-session'
import {
  beginTrainingUnit,
  cancelTrainingSession,
  completeTrainingWork,
  getActiveTrainingSession,
  getTrainingSession,
  startTrainingSession,
} from '../../application/training-sessions'
import { assertSameOrigin, requireWebSession } from '../auth.server'

export const getActiveTrainingSessionFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireWebSession()
  return getActiveTrainingSession()
})

export const getTrainingSessionFn = createServerFn({ method: 'GET' })
  .validator(trainingSessionIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getTrainingSession(data.sessionId)
  })

export const startTrainingSessionFn = createServerFn({ method: 'POST' })
  .validator(startTrainingSessionSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return startTrainingSession(data.workoutId)
  })

export const beginTrainingUnitFn = createServerFn({ method: 'POST' })
  .validator(trainingSessionIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return beginTrainingUnit(data.sessionId)
  })

export const completeTrainingWorkFn = createServerFn({ method: 'POST' })
  .validator(completeTrainingWorkSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return completeTrainingWork(data.sessionId, data.actualResult)
  })

export const cancelTrainingSessionFn = createServerFn({ method: 'POST' })
  .validator(cancelTrainingSessionSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return cancelTrainingSession(data.sessionId, data.reason)
  })
