import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('route structure', () => {
  it('renders the assessment runner beside the list route, not inside it', () => {
    const generatedRoutes = fs.readFileSync(
      path.resolve(process.cwd(), 'src/routeTree.gen.ts'),
      'utf8',
    )

    expect(generatedRoutes).toMatch(
      /id: '\/assessments_\/\$assessmentId',[\s\S]*?path: '\/assessments\/\$assessmentId',[\s\S]*?getParentRoute: \(\) => AuthenticatedRoute/,
    )
    expect(generatedRoutes).not.toMatch(
      /id: '\/assessments\/\$assessmentId',[\s\S]*?getParentRoute: \(\) => AuthenticatedAssessmentsRoute/,
    )
  })

  it('renders the workout editor beside the queue route, not inside it', () => {
    const generatedRoutes = fs.readFileSync(
      path.resolve(process.cwd(), 'src/routeTree.gen.ts'),
      'utf8',
    )

    expect(generatedRoutes).toMatch(
      /id: '\/workouts_\/\$workoutId',[\s\S]*?path: '\/workouts\/\$workoutId',[\s\S]*?getParentRoute: \(\) => AuthenticatedRoute/,
    )
    expect(generatedRoutes).not.toMatch(
      /id: '\/workouts\/\$workoutId',[\s\S]*?getParentRoute: \(\) => AuthenticatedWorkoutsRoute/,
    )
  })
})
