export const exerciseTypes = [
  'PUSH_UP',
  'VERTICAL_PUSH',
  'PULL_UP',
  'SQUAT',
  'ABDOMINAL',
  'FULL_BODY',
] as const

export type ExerciseType = (typeof exerciseTypes)[number]

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  PUSH_UP: 'Flexión',
  VERTICAL_PUSH: 'Flexión vertical',
  PULL_UP: 'Dominada',
  SQUAT: 'Sentadilla',
  ABDOMINAL: 'Abdominales',
  FULL_BODY: 'Cuerpo completo',
}

export type MediaKind = 'IMAGE' | 'VIDEO'

export interface CatalogMedia {
  id: string
  position: number
  kind: MediaKind
  url: string
  altText: string
  mimeType: string | null
}

export interface CatalogVariantSummary {
  id: string
  slug: string
  name: string
  exerciseName: string
  exerciseType: ExerciseType
  exerciseTypeLabel: string
  bodyGroup: string
  difficultyMin: number | null
  difficultyMax: number | null
  cover: CatalogMedia | null
  mediaCount: number
  imageCount: number
  videoCount: number
}

export interface CatalogVariantDetail extends CatalogVariantSummary {
  description: string
  sourcePageStart: number | null
  sourcePageEnd: number | null
  media: CatalogMedia[]
}
