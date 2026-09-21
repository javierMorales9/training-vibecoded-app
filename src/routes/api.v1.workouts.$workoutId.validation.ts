import { createFileRoute } from '@tanstack/react-router'
import { workoutIdSchema } from '../contracts/workout'
import { getWorkoutValidation } from '../application/workouts'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, problemResponse } from '../server/http'

export const Route = createFileRoute('/api/v1/workouts/$workoutId/validation')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          const { workoutId } = workoutIdSchema.parse(params)
          const validation = getWorkoutValidation(workoutId)
          return validation
            ? jsonResponse(validation)
            : problemResponse(
                404,
                'WORKOUT_NOT_FOUND',
                'Entrenamiento no encontrado',
                'No existe un entrenamiento pendiente con ese identificador.',
                request,
              )
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
