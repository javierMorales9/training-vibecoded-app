import { createServerFn } from '@tanstack/react-start'
import {
  reorderQueueSchema,
  updateWorkoutSchema,
  versionedWorkoutSchema,
  workoutIdSchema,
  workoutInputSchema,
} from '../../contracts/workout'
import {
  createWorkout,
  deleteWorkout,
  duplicateWorkout,
  getCapabilitiesForWorkout,
  getWorkout,
  getWorkoutValidation,
  listWorkoutQueue,
  reorderWorkoutQueue,
  updateWorkout,
} from '../../application/workouts'
import { assertSameOrigin, requireWebSession } from '../auth.server'

export const listWorkoutQueueFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireWebSession()
    return listWorkoutQueue()
  },
)

export const getWorkoutFn = createServerFn({ method: 'GET' })
  .validator(workoutIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getWorkout(data.workoutId)
  })

export const getWorkoutValidationFn = createServerFn({ method: 'GET' })
  .validator(workoutIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getWorkoutValidation(data.workoutId)
  })

export const getWorkoutCapabilitiesFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireWebSession()
  return getCapabilitiesForWorkout()
})

export const createWorkoutFn = createServerFn({ method: 'POST' })
  .validator(workoutInputSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return createWorkout(data)
  })

export const updateWorkoutFn = createServerFn({ method: 'POST' })
  .validator(updateWorkoutSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return updateWorkout(data.workoutId, data.version, data.workout)
  })

export const duplicateWorkoutFn = createServerFn({ method: 'POST' })
  .validator(workoutIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return duplicateWorkout(data.workoutId)
  })

export const deleteWorkoutFn = createServerFn({ method: 'POST' })
  .validator(versionedWorkoutSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return { deleted: deleteWorkout(data.workoutId, data.version) }
  })

export const reorderWorkoutQueueFn = createServerFn({ method: 'POST' })
  .validator(reorderQueueSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return reorderWorkoutQueue(data.version, data.workoutIds)
  })
