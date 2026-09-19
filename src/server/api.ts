import { z } from 'zod'
import { exerciseTypes } from '../domain/catalog'
import { listCatalogInputSchema } from '../contracts/catalog'

function nullableNumber(value: string | null) {
  return value === null || value === '' ? null : Number(value)
}

export function parseCatalogQuery(url: URL) {
  return listCatalogInputSchema.parse({
    q: url.searchParams.get('q') ?? '',
    exerciseTypes: url.searchParams.getAll('exerciseType'),
    difficultyMin: nullableNumber(url.searchParams.get('difficultyMin')),
    difficultyMax: nullableNumber(url.searchParams.get('difficultyMax')),
    cursor: url.searchParams.get('cursor'),
    limit: nullableNumber(url.searchParams.get('limit')) ?? 24,
  })
}

export const apiVariantIdSchema = z.uuid()
export const apiExerciseTypeSchema = z.enum(exerciseTypes)
