import { describe, expect, it } from 'vitest'
import { openApiDocument } from './openapi'

describe('OpenAPI contract', () => {
  it('documents every workout planning route and no session start route', () => {
    const paths = Object.keys(openApiDocument.paths)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/workout-queue',
        '/workouts',
        '/workouts/{workoutId}',
        '/workouts/{workoutId}/duplicate',
        '/workouts/{workoutId}/validation',
      ]),
    )
    expect(paths.some((path) => path.includes('start'))).toBe(false)
    expect(paths.some((path) => path.includes('session'))).toBe(false)
  })

  it('does not expose assessment writes', () => {
    const assessments = openApiDocument.paths['/assessments']
    expect(Object.keys(assessments)).toEqual(['get'])
  })
})
