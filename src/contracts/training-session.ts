import { z } from 'zod'
import { exerciseTypes } from '../domain/catalog'

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

export const listTrainingSessionsInputSchema = z.object({
  statuses: z
    .array(z.enum(['COMPLETED', 'CANCELLED']))
    .max(2)
    .default([]),
  exerciseTypes: z
    .array(z.enum(exerciseTypes))
    .max(exerciseTypes.length)
    .default([]),
  startedFrom: z.number().int().nullable().default(null),
  startedTo: z.number().int().nullable().default(null),
  cursor: z.string().max(2048).nullable().default(null),
  limit: z.number().int().min(1).max(100).default(30),
})

export const updateTrainingSessionNotesSchema = z.strictObject({
  sessionId: z.uuid(),
  notes: z.string().trim().max(2000),
})

export type ListTrainingSessionsInput = z.infer<
  typeof listTrainingSessionsInputSchema
>
