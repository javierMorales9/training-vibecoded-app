import type { ExerciseType } from './catalog'

export const capabilities = [
  'PUSH_UP',
  'VERTICAL_PUSH',
  'PULL_UP',
  'SQUAT',
  'ABDOMINAL',
] as const satisfies readonly ExerciseType[]

export type Capability = (typeof capabilities)[number]
export type AssessmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type CapabilityAssessmentStatus =
  'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
export type AssessmentOutcome = 'PASSED' | 'FAILED'
export type MetricKind = 'REPETITIONS' | 'DURATION'
export type MeasurementScope = 'TOTAL' | 'PER_SIDE' | 'PER_HAND' | 'PER_LEG'

export const capabilityLabels: Record<Capability, string> = {
  PUSH_UP: 'Flexiones',
  VERTICAL_PUSH: 'Flexión vertical',
  PULL_UP: 'Dominadas',
  SQUAT: 'Sentadillas',
  ABDOMINAL: 'Abdominales',
}

export const metricLabels: Record<MetricKind, string> = {
  REPETITIONS: 'repeticiones',
  DURATION: 'segundos',
}

export function calculateStartingLevel(previousMaximum: number | null) {
  if (previousMaximum === null) return 1
  return Math.min(5, Math.max(1, previousMaximum - 1))
}

export function nextLevelAfterResult(
  level: number,
  outcome: AssessmentOutcome,
) {
  if (outcome === 'FAILED' || level === 5) return null
  return level + 1
}

export function formatMeasurement(
  value: number,
  metricKind: MetricKind,
  scope: MeasurementScope,
) {
  const displayed =
    metricKind === 'DURATION' ? `${Math.round(value / 1000)} s` : String(value)
  const suffix: Record<MeasurementScope, string> = {
    TOTAL: '',
    PER_SIDE: ' por lado',
    PER_HAND: ' por mano',
    PER_LEG: ' por pierna',
  }
  return `${displayed}${suffix[scope]}`
}
