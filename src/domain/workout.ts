import type { Capability, MeasurementScope, MetricKind } from './assessment'

export const trainingMethods = ['NORMAL_SETS', 'PYRAMID', 'SUPERSET'] as const
export type TrainingMethod = (typeof trainingMethods)[number]

export type SelectionKind = 'EXPLICIT_VARIANT' | 'CAPABILITY_RELATIVE'

export const trainingMethodLabels: Record<TrainingMethod, string> = {
  NORMAL_SETS: 'Series normales',
  PYRAMID: 'Pirámide',
  SUPERSET: 'Superset',
}

export interface WorkoutTarget {
  unitIndex: number | null
  label: string
  metricKind: MetricKind
  scope: MeasurementScope
  minimumValue: number
  maximumValue: number
}

export type ExerciseSelection =
  | {
      kind: 'EXPLICIT_VARIANT'
      exerciseVariantId: string | null
    }
  | {
      kind: 'CAPABILITY_RELATIVE'
      capability: Capability | null
      levelOffset: -1 | 0 | 1 | null
    }

export interface WorkoutBlockItemInput {
  selection: ExerciseSelection
  targets: WorkoutTarget[]
}

interface WorkoutBlockBase {
  name: string | null
  instructions: string | null
  afterBlockRestMs: number | null
  items: WorkoutBlockItemInput[]
}

export interface NormalSetsBlockInput extends WorkoutBlockBase {
  method: 'NORMAL_SETS'
  unitCount: number | null
  betweenUnitsRestMs: number | null
}

export interface PyramidBlockInput extends WorkoutBlockBase {
  method: 'PYRAMID'
  pyramidDurationMs: number | null
  pyramidInitialReps: number | null
  pyramidRestMsPerRep: number | null
}

export interface SupersetBlockInput extends WorkoutBlockBase {
  method: 'SUPERSET'
  unitCount: number | null
  betweenUnitsRestMs: number | null
}

export type WorkoutBlockInput =
  NormalSetsBlockInput | PyramidBlockInput | SupersetBlockInput

export interface WorkoutInput {
  name: string
  notes: string | null
  blocks: WorkoutBlockInput[]
}

export interface WorkoutValidationIssue {
  path: string
  code: string
  message: string
}

export interface WorkoutValidation {
  startable: boolean
  issues: WorkoutValidationIssue[]
}

export function expectedItemCount(method: TrainingMethod) {
  return method === 'SUPERSET' ? 2 : 1
}

export function estimateWorkoutDurationMs(blocks: WorkoutBlockInput[]) {
  return blocks.reduce((total, block) => {
    const after = block.afterBlockRestMs ?? 0
    if (block.method === 'PYRAMID')
      return total + (block.pyramidDurationMs ?? 0) + after
    const rests = Math.max(0, (block.unitCount ?? 0) - 1)
    return total + rests * (block.betweenUnitsRestMs ?? 0) + after
  }, 0)
}
