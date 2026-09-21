import { z } from 'zod'
import { exerciseTypes } from '../domain/catalog'
import { listCatalogInputSchema } from '../contracts/catalog'
import { listAssessmentsInputSchema } from '../contracts/assessment'

function nullableNumber(value: string | null) {
  return value === null || value === '' ? null : Number(value)
}

function nullableBoolean(value: string | null) {
  if (value === null || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

export function parseCatalogQuery(url: URL) {
  return listCatalogInputSchema.parse({
    q: url.searchParams.get('q') ?? '',
    exerciseTypes: url.searchParams.getAll('exerciseType'),
    difficultyMin: nullableNumber(url.searchParams.get('difficultyMin')),
    difficultyMax: nullableNumber(url.searchParams.get('difficultyMax')),
    primaryProgression: nullableBoolean(
      url.searchParams.get('primaryProgression'),
    ),
    cursor: url.searchParams.get('cursor'),
    limit: nullableNumber(url.searchParams.get('limit')) ?? 24,
  })
}

export const apiVariantIdSchema = z.uuid()
export const apiExerciseTypeSchema = z.enum(exerciseTypes)

export function parseAssessmentsQuery(url: URL) {
  return listAssessmentsInputSchema.parse({
    statuses: url.searchParams.getAll('status'),
    cursor: url.searchParams.get('cursor'),
    limit: nullableNumber(url.searchParams.get('limit')) ?? 50,
  })
}

export const apiAssessmentIdSchema = z.uuid()
