import type { TrainingMethod, WorkoutTarget } from './workout'

export type TrainingSessionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
export type TrainingSessionPhase =
  'READY' | 'WORKING' | 'RESTING' | 'COMPLETED' | 'CANCELLED'

export interface TrainingSessionItemSnapshot {
  variantId: string
  exerciseName: string
  variantName: string
  description: string
  media: Array<{
    id: string
    kind: 'IMAGE' | 'VIDEO'
    url: string
    mimeType: string | null
    altText: string
    position: number
  }>
  targets: WorkoutTarget[]
}

export interface TrainingSessionUnit {
  id: string
  position: number
  blockPosition: number
  method: TrainingMethod
  blockName: string
  instructions: string | null
  items: TrainingSessionItemSnapshot[]
  plannedWorkMs: number | null
  plannedRestMs: number
  status: 'PENDING' | 'WORKING' | 'COMPLETED'
  startedAt: string | null
  completedAt: string | null
  restStartedAt: string | null
  restCompletedAt: string | null
}

export interface TrainingSession {
  id: string
  workoutId: string
  workoutName: string
  status: TrainingSessionStatus
  phase: TrainingSessionPhase
  currentUnitPosition: number | null
  startedAt: string
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  completionRatio: number | null
  totalWorkMs: number
  totalRestMs: number
  units: TrainingSessionUnit[]
}
