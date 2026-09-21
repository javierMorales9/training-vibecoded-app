import { createFileRoute } from '@tanstack/react-router'
import { getAssessmentDetail } from '../application/assessments'
import { apiAssessmentIdSchema } from '../server/api'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, problemResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/assessments/$assessmentId')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          const assessment = getAssessmentDetail(
            apiAssessmentIdSchema.parse(params.assessmentId),
            { api: true },
          )
          return assessment
            ? jsonResponse(assessment)
            : problemResponse(
                404,
                'ASSESSMENT_NOT_FOUND',
                'Evaluación no encontrada',
                'No existe una evaluación con ese identificador.',
                request,
              )
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
