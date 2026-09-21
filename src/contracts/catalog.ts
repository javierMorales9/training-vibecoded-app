import { z } from 'zod'
import { exerciseTypes } from '../domain/catalog'

export const listCatalogInputSchema = z
  .object({
    q: z.string().trim().max(120).default(''),
    exerciseTypes: z
      .array(z.enum(exerciseTypes))
      .max(exerciseTypes.length)
      .default([]),
    difficultyMin: z.number().int().min(1).max(5).nullable().default(null),
    difficultyMax: z.number().int().min(1).max(5).nullable().default(null),
    primaryProgression: z.boolean().nullable().default(null),
    cursor: z.string().max(2048).nullable().default(null),
    limit: z.number().int().min(1).max(100).default(24),
  })
  .superRefine((value, context) => {
    if (
      value.difficultyMin !== null &&
      value.difficultyMax !== null &&
      value.difficultyMin > value.difficultyMax
    ) {
      context.addIssue({
        code: 'custom',
        path: ['difficultyMax'],
        message: 'La dificultad máxima no puede ser menor que la mínima.',
      })
    }
  })

export type ListCatalogInput = z.infer<typeof listCatalogInputSchema>

export const variantIdSchema = z.object({ variantId: z.uuid() })
export const mediaIdSchema = z.object({ mediaId: z.uuid() })
