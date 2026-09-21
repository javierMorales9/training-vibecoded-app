import { z } from 'zod'

export const trainingSessionIdSchema = z.strictObject({
  sessionId: z.uuid(),
})

export const startTrainingSessionSchema = z.strictObject({
  workoutId: z.uuid(),
})

export const completeTrainingWorkSchema = z.strictObject({
  sessionId: z.uuid(),
  actualResult: z.string().trim().max(500).nullable().default(null),
})

export const cancelTrainingSessionSchema = z.strictObject({
  sessionId: z.uuid(),
  reason: z.string().trim().max(500).nullable().default(null),
})
