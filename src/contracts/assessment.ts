import { z } from 'zod'
import { capabilities } from '../domain/assessment'

export const assessmentIdSchema = z.object({ assessmentId: z.uuid() })

export const listAssessmentsInputSchema = z.object({
  statuses: z
    .array(z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']))
    .max(3)
    .default([]),
  cursor: z.string().max(2048).nullable().default(null),
  limit: z.number().int().min(1).max(100).default(50),
})

export const recordAssessmentResultSchema = z.strictObject({
  assessmentId: z.uuid(),
  capability: z.enum(capabilities),
  level: z.number().int().min(1).max(5),
  outcome: z.enum(['PASSED', 'FAILED']),
  measurements: z
    .array(
      z.strictObject({
        position: z.number().int().min(0),
        actualValue: z.number().int().min(0).nullable(),
      }),
    )
    .max(10),
})

export const updateAssessmentNotesSchema = z.strictObject({
  assessmentId: z.uuid(),
  notes: z.string().trim().max(2000),
})

export type ListAssessmentsInput = z.infer<typeof listAssessmentsInputSchema>
export type RecordAssessmentResultInput = z.infer<
  typeof recordAssessmentResultSchema
>
