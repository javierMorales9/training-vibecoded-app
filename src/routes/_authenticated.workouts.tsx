import { useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Blocks,
  Clock3,
  Copy,
  History,
  Plus,
  Play,
  Trash2,
} from 'lucide-react'
import {
  createWorkoutFn,
  deleteWorkoutFn,
  duplicateWorkoutFn,
  listWorkoutQueueFn,
  reorderWorkoutQueueFn,
} from '../server/functions/workouts'
import {
  getActiveTrainingSessionFn,
  startTrainingSessionFn,
} from '../server/functions/training-sessions'

export const Route = createFileRoute('/_authenticated/workouts')({
  loader: async () => ({
    queue: await listWorkoutQueueFn(),
    activeSession: await getActiveTrainingSessionFn(),
  }),
  component: WorkoutQueuePage,
})

function formatDuration(milliseconds: number) {
  if (!milliseconds) return 'Sin duración estimada'
  const minutes = Math.round(milliseconds / 60000)
  return `${minutes} min planificados`
}

function WorkoutQueuePage() {
  const { queue, activeSession } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const create = useServerFn(createWorkoutFn)
  const duplicate = useServerFn(duplicateWorkoutFn)
  const remove = useServerFn(deleteWorkoutFn)
  const reorder = useServerFn(reorderWorkoutQueueFn)
  const start = useServerFn(startTrainingSessionFn)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createNew = async () => {
    setBusyId('new')
    setError(null)
    try {
      const workout = await create({
        data: { name: 'Nuevo entrenamiento', notes: null, blocks: [] },
      })
      if (workout) {
        await router.invalidate()
        await navigate({
          to: '/workouts/$workoutId',
          params: { workoutId: workout.id },
        })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear.')
    } finally {
      setBusyId(null)
    }
  }

  const duplicateOne = async (workoutId: string) => {
    setBusyId(workoutId)
    try {
      await duplicate({ data: { workoutId } })
      await router.invalidate()
    } finally {
      setBusyId(null)
    }
  }

  const deleteOne = async (workoutId: string, version: number) => {
    if (!window.confirm('¿Eliminar este entrenamiento pendiente?')) return
    setBusyId(workoutId)
    try {
      await remove({ data: { workoutId, version } })
      await router.invalidate()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo eliminar el entrenamiento.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= queue.items.length) return
    const ids = queue.items.map((item) => item.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setBusyId('queue')
    try {
      await reorder({ data: { version: queue.version, workoutIds: ids } })
      await router.invalidate()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'La cola ha cambiado. Recarga e inténtalo de nuevo.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const startWorkout = async (workoutId: string) => {
    setBusyId(workoutId)
    setError(null)
    try {
      const session = await start({ data: { workoutId } })
      if (session) {
        await router.invalidate()
        await navigate({
          to: '/workouts/session/$sessionId',
          params: { sessionId: session.id },
        })
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo iniciar el entrenamiento.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="workouts-page">
      <header className="page-header workouts-header">
        <div>
          <p className="eyebrow">Planificación</p>
          <h1>Entrenamientos</h1>
          <p>
            Prepara y ordena tu cola. Inicia un entrenamiento cuando esté listo.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={busyId !== null}
          onClick={() => void createNew()}
        >
          <Plus size={18} /> Nuevo entrenamiento
        </button>
      </header>
      <Link
        className="history-link"
        to="/workouts/history"
        search={{ status: '', exerciseType: '', from: '', to: '' }}
      >
        <History size={17} /> Ver historial de entrenamientos{' '}
        <ArrowRight size={16} />
      </Link>

      {error ? <p className="form-error workout-error">{error}</p> : null}
      {activeSession ? (
        <section className="active-session-banner">
          <div>
            <p className="eyebrow">Entrenamiento en curso</p>
            <strong>{activeSession.workoutName}</strong>
            <span>
              {activeSession.phase === 'RESTING'
                ? 'En descanso'
                : activeSession.phase === 'WORKING'
                  ? 'En ejecución'
                  : 'Preparado para empezar'}
            </span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() =>
              void navigate({
                to: '/workouts/session/$sessionId',
                params: { sessionId: activeSession.id },
              })
            }
          >
            Reanudar <ArrowRight size={17} />
          </button>
        </section>
      ) : null}
      {queue.items.length ? (
        <section className="workout-queue" aria-label="Cola de entrenamientos">
          {queue.items.map((workout, index) => (
            <article className="workout-queue-card" key={workout.id}>
              <div className="queue-position">{index + 1}</div>
              <div
                className="workout-card-main workout-card-open"
                role="link"
                tabIndex={0}
                onClick={() =>
                  void navigate({
                    to: '/workouts/$workoutId',
                    params: { workoutId: workout.id },
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void navigate({
                      to: '/workouts/$workoutId',
                      params: { workoutId: workout.id },
                    })
                  }
                }}
              >
                <div className="workout-card-heading">
                  <div>
                    <h2>{workout.name}</h2>
                    <span
                      className={
                        workout.startable ? 'ready-label' : 'draft-label'
                      }
                    >
                      {workout.startable
                        ? 'Listo para iniciar'
                        : `Borrador · ${workout.issueCount} pendiente${workout.issueCount === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className="workout-primary-actions">
                    {workout.startable ? (
                      <button
                        type="button"
                        className="primary-button start-workout-action"
                        disabled={busyId !== null}
                        onClick={(event) => {
                          event.stopPropagation()
                          void startWorkout(workout.id)
                        }}
                      >
                        <Play size={16} /> Iniciar
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="workout-summary-line">
                  <span>
                    <Blocks size={15} /> {workout.blockCount}{' '}
                    {workout.blockCount === 1 ? 'bloque' : 'bloques'}
                  </span>
                  <span>
                    <Clock3 size={15} />
                    {formatDuration(workout.estimatedDurationMs)}
                  </span>
                  <span>
                    {workout.methodLabels.join(' · ') || 'Sin método'}
                  </span>
                </div>
              </div>
              <div className="queue-actions">
                <button
                  type="button"
                  disabled={index === 0 || busyId !== null}
                  onClick={() => void move(index, -1)}
                  aria-label={`Subir ${workout.name}`}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  disabled={index === queue.items.length - 1 || busyId !== null}
                  onClick={() => void move(index, 1)}
                  aria-label={`Bajar ${workout.name}`}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void duplicateOne(workout.id)}
                  aria-label={`Duplicar ${workout.name}`}
                >
                  <Copy size={17} />
                </button>
                <button
                  type="button"
                  className="delete-icon"
                  disabled={busyId !== null}
                  onClick={() => void deleteOne(workout.id, workout.version)}
                  aria-label={`Eliminar ${workout.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Blocks size={34} />
          <h2>La cola está vacía</h2>
          <p>Crea un entrenamiento y empieza a combinar bloques.</p>
        </div>
      )}
    </div>
  )
}
