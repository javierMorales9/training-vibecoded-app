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
})
