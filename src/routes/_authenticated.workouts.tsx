import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Blocks,
  Clock3,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  createWorkoutFn,
  deleteWorkoutFn,
  duplicateWorkoutFn,
  listWorkoutQueueFn,
  reorderWorkoutQueueFn,
} from '../server/functions/workouts'

export const Route = createFileRoute('/_authenticated/workouts')({
  loader: () => listWorkoutQueueFn(),
  component: WorkoutQueuePage,
})

function formatDuration(milliseconds: number) {
  if (!milliseconds) return 'Sin duración estimada'
  const minutes = Math.round(milliseconds / 60000)
  return `${minutes} min planificados`
}

function WorkoutQueuePage() {
  const queue = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const create = useServerFn(createWorkoutFn)
  const duplicate = useServerFn(duplicateWorkoutFn)
  const remove = useServerFn(deleteWorkoutFn)
  const reorder = useServerFn(reorderWorkoutQueueFn)
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

  return (
    <div className="workouts-page">
      <header className="page-header workouts-header">
        <div>
          <p className="eyebrow">Planificación</p>
          <h1>Entrenamientos</h1>
          <p>
            Prepara y ordena tu cola. La ejecución se añadirá en la siguiente
            entrega.
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

      {error ? <p className="form-error workout-error">{error}</p> : null}
      {queue.items.length ? (
        <section className="workout-queue" aria-label="Cola de entrenamientos">
          {queue.items.map((workout, index) => (
            <article className="workout-queue-card" key={workout.id}>
              <div className="queue-position">{index + 1}</div>
              <div className="workout-card-main">
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
                  <button
                    type="button"
                    className="row-action"
                    onClick={() =>
                      void navigate({
                        to: '/workouts/$workoutId',
                        params: { workoutId: workout.id },
                      })
                    }
                  >
                    Editar <ArrowRight size={17} />
                  </button>
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
