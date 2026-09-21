import { z } from 'zod'
import { capabilities } from '../domain/assessment'
import { trainingMethods } from '../domain/workout'

const optionalText = z.string().trim().max(2000).nullable().default(null)
const optionalPositive = z.number().int().positive().nullable()
const optionalNonNegative = z.number().int().min(0).nullable()

const targetSchema = z
  .strictObject({
    unitIndex: z.number().int().min(0).nullable().default(null),
    label: z.string().trim().min(1).max(120),
    metricKind: z.enum(['REPETITIONS', 'DURATION']),
    scope: z.enum(['TOTAL', 'PER_SIDE', 'PER_HAND', 'PER_LEG']),
    minimumValue: z.number().int().positive(),
    maximumValue: z.number().int().positive(),
  })
  .refine((value) => value.minimumValue <= value.maximumValue, {
    path: ['maximumValue'],
    message: 'El máximo no puede ser menor que el mínimo.',
  })

const selectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('EXPLICIT_VARIANT'),
    exerciseVariantId: z.uuid().nullable(),
  }),
  z.strictObject({
    kind: z.literal('CAPABILITY_RELATIVE'),
    capability: z.enum(capabilities).nullable(),
    levelOffset: z
      .union([z.literal(-1), z.literal(0), z.literal(1)])
      .nullable(),
  }),
])

const targetListSchema = z
  .array(targetSchema)
  .max(500)
  .default([])
  .superRefine((targets, context) => {
    const commonCount = targets.filter(
      (target) => target.unitIndex === null,
    ).length
    const unitIndexes = targets
      .map((target) => target.unitIndex)
      .filter((index): index is number => index !== null)
    if (commonCount && unitIndexes.length) {
      context.addIssue({
        code: 'custom',
        message:
          'Usa un objetivo común o varios objetivos por unidad, pero no mezcles ambos modos.',
      })
    }
    if (commonCount > 1 || new Set(unitIndexes).size !== unitIndexes.length) {
      context.addIssue({
        code: 'custom',
        message: 'Cada objetivo debe corresponder a una unidad distinta.',
      })
    }
  })

const itemSchema = z.strictObject({
  selection: selectionSchema,
  targets: targetListSchema,
})

const blockBase = {
  name: z.string().trim().max(120).nullable().default(null),
  instructions: optionalText,
  afterBlockRestMs: optionalNonNegative,
  items: z.array(itemSchema),
}

const normalSetsBlockSchema = z.strictObject({
  ...blockBase,
  method: z.literal('NORMAL_SETS'),
  unitCount: optionalPositive,
  betweenUnitsRestMs: optionalNonNegative,
  items: z.array(itemSchema).max(1),
})

const pyramidBlockSchema = z.strictObject({
  ...blockBase,
  method: z.literal('PYRAMID'),
  pyramidDurationMs: optionalPositive,
  pyramidInitialReps: optionalPositive,
  pyramidRestMsPerRep: optionalPositive,
  items: z.array(itemSchema).max(1),
})

const supersetBlockSchema = z.strictObject({
  ...blockBase,
  method: z.literal('SUPERSET'),
  unitCount: optionalPositive,
  betweenUnitsRestMs: optionalNonNegative,
  items: z.array(itemSchema).max(2),
})

export const workoutInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  notes: optionalText,
  blocks: z
    .array(
      z.discriminatedUnion('method', [
        normalSetsBlockSchema,
        pyramidBlockSchema,
        supersetBlockSchema,
      ]),
    )
    .max(50),
})

export const workoutIdSchema = z.object({ workoutId: z.uuid() })
export const versionedWorkoutSchema = z.strictObject({
  workoutId: z.uuid(),
  version: z.number().int().positive(),
})
export const updateWorkoutSchema = z.strictObject({
  workoutId: z.uuid(),
  version: z.number().int().positive(),
  workout: workoutInputSchema,
})
export const reorderQueueSchema = z.strictObject({
  version: z.number().int().positive(),
  workoutIds: z.array(z.uuid()).max(500),
})

export const apiWorkoutInputSchema = workoutInputSchema
export const trainingMethodSchema = z.enum(trainingMethods)

export type WorkoutInputData = z.infer<typeof workoutInputSchema>
