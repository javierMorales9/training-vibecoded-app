import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from '../server/config'
import {
  cancelAssessment,
  getAssessmentDetail,
  getCurrentCapabilityLevels,
  listAssessments,
  recordAssessmentResult,
  startAssessment,
} from './assessments'

const testDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'training-assessment-'),
)
const databasePath = path.join(testDirectory, 'training.sqlite')

beforeEach(() => {
  closeDatabase()
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true })
  }
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = databasePath
  resetConfigForTests()
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testDirectory, { recursive: true, force: true })
})

function answerCurrent(outcome: 'PASSED' | 'FAILED') {
  const assessment = startAssessment()
  if (!assessment?.currentStep) throw new Error('Expected a current step')
  return recordAssessmentResult({
    assessmentId: assessment.id,
    capability: assessment.currentStep.capability,
    level: assessment.currentStep.level,
    outcome,
    measurements: [],
  })
}

function completeWithMaximums(maximums: number[]) {
  let assessment = startAssessment()
  while (assessment?.status === 'IN_PROGRESS' && assessment.currentStep) {
    const target = maximums[assessment.currentStep.position - 1]
    const outcome = assessment.currentStep.level < target ? 'PASSED' : 'FAILED'
    assessment = recordAssessmentResult({
      assessmentId: assessment.id,
      capability: assessment.currentStep.capability,
      level: assessment.currentStep.level,
      outcome:
        assessment.currentStep.level === 5 && target === 5 ? 'PASSED' : outcome,
      measurements: [],
    })
  }
  return assessment
}

describe('assessments', () => {
  it('creates one resumable assessment starting at level one', () => {
    const first = startAssessment()
    const resumed = startAssessment()
    expect(first?.id).toBe(resumed?.id)
    expect(first?.capabilities.map((item) => item.startingLevel)).toEqual([
      1, 1, 1, 1, 1,
    ])
    expect(first?.currentStep?.capability).toBe('PUSH_UP')
    expect(
      listAssessments({ statuses: [], cursor: null, limit: 50 }).items,
    ).toHaveLength(1)
  })

  it('advances on success and closes a capability on failure', () => {
    let assessment = answerCurrent('PASSED')
    expect(assessment?.currentStep?.level).toBe(2)
    assessment = answerCurrent('FAILED')
    expect(assessment?.capabilities[0].maximumLevel).toBe(2)
    expect(assessment?.currentStep?.capability).toBe('VERTICAL_PUSH')
    expect(assessment?.currentStep?.level).toBe(1)
  })

  it('uses independent previous maxima and ignores cancelled work', () => {
    const completed = completeWithMaximums([3, 1, 2, 5, 2])
    expect(completed?.status).toBe('COMPLETED')
    expect(getCurrentCapabilityLevels().map((item) => item.level)).toEqual([
      3, 1, 2, 5, 2,
    ])

    const next = startAssessment()
    expect(next?.capabilities.map((item) => item.startingLevel)).toEqual([
      2, 1, 1, 4, 1,
    ])
    if (!next) throw new Error('Expected assessment')
    answerCurrent('FAILED')
    cancelAssessment(next.id)
    expect(getCurrentCapabilityLevels().map((item) => item.level)).toEqual([
      3, 1, 2, 5, 2,
    ])
  })

  it('keeps frozen historical criteria after catalog changes', () => {
    const assessment = answerCurrent('FAILED')
    const recorded = assessment?.capabilities[0].results[0]
    expect(recorded).toBeDefined()
    const originalRequired = recorded?.measurements[0]?.requiredValue
    const definition = getDatabase()
      .sqlite.prepare(
        `SELECT capability_level_definition_id AS id
         FROM assessment_level_results WHERE id = ?`,
      )
      .get(recorded?.id) as { id: string }
    getDatabase()
      .sqlite.prepare(
        `UPDATE capability_level_requirements
         SET required_value = 999
         WHERE capability_level_definition_id = ?`,
      )
      .run(definition.id)
    getDatabase()
      .sqlite.prepare(
        `UPDATE capability_level_definitions SET instructions = 'Changed'
         WHERE id = ?`,
      )
      .run(definition.id)
    if (!assessment) throw new Error('Expected assessment')
    const historical = getAssessmentDetail(assessment.id)
    expect(historical?.capabilities[0].results[0].instructions).not.toBe(
      'Changed',
    )
    expect(
      historical?.capabilities[0].results[0].measurements[0].requiredValue,
    ).toBe(originalRequired)
  })
})
