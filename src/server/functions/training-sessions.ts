import { createServerFn } from '@tanstack/react-start'
import {
  cancelTrainingSessionSchema,
  completeTrainingWorkSchema,
  listTrainingSessionsInputSchema,
  startTrainingSessionSchema,
  trainingSessionIdSchema,
  updateTrainingSessionNotesSchema,
} from '../../contracts/training-session'
import {
  beginTrainingUnit,
  cancelTrainingSession,
  completeTrainingWork,
  getActiveTrainingSession,
  getTrainingSession,
  getTrainingSessionHistory,
  listTrainingSessions,
  repeatTrainingSession,
  startTrainingSession,
  updateTrainingSessionNotes,
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

export const listTrainingSessionsFn = createServerFn({ method: 'GET' })
  .validator(listTrainingSessionsInputSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return listTrainingSessions(data)
  })

export const getTrainingSessionHistoryFn = createServerFn({ method: 'GET' })
  .validator(trainingSessionIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getTrainingSessionHistory(data.sessionId)
  })

export const repeatTrainingSessionFn = createServerFn({ method: 'POST' })
  .validator(trainingSessionIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return repeatTrainingSession(data.sessionId)
  })

export const updateTrainingSessionNotesFn = createServerFn({ method: 'POST' })
  .validator(updateTrainingSessionNotesSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return updateTrainingSessionNotes(data.sessionId, data.notes)
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
