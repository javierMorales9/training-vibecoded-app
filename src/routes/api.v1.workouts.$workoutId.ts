import { createFileRoute } from '@tanstack/react-router'
import { workoutIdSchema, workoutInputSchema } from '../contracts/workout'
import {
  deleteWorkout,
  getWorkout,
  updateWorkout,
} from '../application/workouts'
import { authenticateApiRequest } from '../server/auth.server'
import { apiErrorResponse, jsonResponse, problemResponse } from '../server/http'
import { requireIfMatch, workoutEtag } from '../server/workout-api'

export const Route = createFileRoute('/api/v1/workouts/$workoutId')({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        try {
          authenticateApiRequest(request)
          const { workoutId } = workoutIdSchema.parse(params)
          const workout = getWorkout(workoutId)
          return workout
            ? jsonResponse(workout, {
                headers: { etag: workoutEtag(workout.id, workout.version) },
              })
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
      PUT: async ({ request, params }) => {
        try {
          authenticateApiRequest(request, 'workouts:write')
          const { workoutId } = workoutIdSchema.parse(params)
          const current = getWorkout(workoutId)
          if (!current) {
            return problemResponse(
              404,
              'WORKOUT_NOT_FOUND',
              'Entrenamiento no encontrado',
              'No existe un entrenamiento pendiente con ese identificador.',
              request,
            )
          }
          requireIfMatch(request, workoutEtag(workoutId, current.version))
          const body = workoutInputSchema.parse(await request.json())
          const workout = updateWorkout(workoutId, current.version, body)
          if (!workout) throw new Error('WORKOUT_UPDATE_FAILED')
          return jsonResponse(workout, {
            headers: { etag: workoutEtag(workout.id, workout.version) },
          })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
      DELETE: ({ request, params }) => {
        try {
          authenticateApiRequest(request, 'workouts:write')
          const { workoutId } = workoutIdSchema.parse(params)
          const current = getWorkout(workoutId)
          if (!current) {
            return problemResponse(
              404,
              'WORKOUT_NOT_FOUND',
              'Entrenamiento no encontrado',
              'No existe un entrenamiento pendiente con ese identificador.',
              request,
            )
          }
          requireIfMatch(request, workoutEtag(workoutId, current.version))
          deleteWorkout(workoutId, current.version)
          return new Response(null, { status: 204 })
        } catch (error) {
          return apiErrorResponse(error, request)
        }
      },
    },
  },
})
