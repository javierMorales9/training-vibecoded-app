import { createServerFn } from '@tanstack/react-start'
import {
  assessmentIdSchema,
  listAssessmentsInputSchema,
  recordAssessmentResultSchema,
  updateAssessmentNotesSchema,
} from '../../contracts/assessment'
import {
  cancelAssessment,
  getAssessmentDetail,
  getCurrentCapabilityLevels,
  listAssessments,
  recordAssessmentResult,
  startAssessment,
  updateAssessmentNotes,
} from '../../application/assessments'
import { assertSameOrigin, requireWebSession } from '../auth.server'

export const listAssessmentsFn = createServerFn({ method: 'GET' })
  .validator(listAssessmentsInputSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return listAssessments(data)
  })

export const getAssessmentFn = createServerFn({ method: 'GET' })
  .validator(assessmentIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    return getAssessmentDetail(data.assessmentId)
  })

export const getCurrentCapabilityLevelsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireWebSession()
  return getCurrentCapabilityLevels()
})

export const startAssessmentFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireWebSession()
    assertSameOrigin()
    return startAssessment()
  },
)

export const recordAssessmentResultFn = createServerFn({ method: 'POST' })
  .validator(recordAssessmentResultSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return recordAssessmentResult(data)
  })

export const cancelAssessmentFn = createServerFn({ method: 'POST' })
  .validator(assessmentIdSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return cancelAssessment(data.assessmentId)
  })

export const updateAssessmentNotesFn = createServerFn({ method: 'POST' })
  .validator(updateAssessmentNotesSchema)
  .handler(async ({ data }) => {
    await requireWebSession()
    assertSameOrigin()
    return updateAssessmentNotes(data.assessmentId, data.notes)
  })
