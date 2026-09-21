import { useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, Copy, Save } from 'lucide-react'
import { exerciseTypeLabels } from '../domain/catalog'
import { ProtectedImage } from '../components/protected-image'
import {
  getTrainingSessionHistoryFn,
  repeatTrainingSessionFn,
  updateTrainingSessionNotesFn,
} from '../server/functions/training-sessions'

export const Route = createFileRoute(
  '/_authenticated/workouts_/history/$sessionId',
)({
  loader: ({ params }) =>
    getTrainingSessionHistoryFn({ data: { sessionId: params.sessionId } }),
  component: WorkoutHistoryDetailPage,
})

function duration(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function targetValue(value: number, metricKind: 'REPETITIONS' | 'DURATION') {
  return metricKind === 'DURATION' ? value / 1000 : value
}

function WorkoutHistoryDetailPage() {
  const session = Route.useLoaderData()
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const repeat = useServerFn(repeatTrainingSessionFn)
  const saveNotes = useServerFn(updateTrainingSessionNotesFn)
  const [notes, setNotes] = useState(session?.notes ?? '')
  const [busy, setBusy] = useState(false)
  if (!session)
    return (
      <div className="empty-state">
        <h1>Sesión no encontrada</h1>
        <Link
          to="/workouts/history"
          search={{ status: '', exerciseType: '', from: '', to: '' }}
        >
          Volver al historial
        </Link>
      </div>
    )
  const repeatSession = async () => {
    setBusy(true)
    try {
      const workout = await repeat({ data: { sessionId } })
      await router.invalidate()
      await navigate({
        to: '/workouts/$workoutId',
        params: { workoutId: workout!.id },
      })
    } finally {
      setBusy(false)
    }
  }
  const persistNotes = async () => {
    setBusy(true)
    try {
      await saveNotes({ data: { sessionId, notes } })
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="history-detail-page">
      <Link
        className="back-link"
        to="/workouts/history"
        search={{ status: '', exerciseType: '', from: '', to: '' }}
      >
        <ArrowLeft size={16} /> Historial
      </Link>
      <header className="history-detail-header">
        <div>
          <p className="eyebrow">
            {session.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}
          </p>
          <h1>{session.workoutName}</h1>
          <p>
            {new Date(session.startedAt).toLocaleString('es-ES')} ·{' '}
            {Math.round((session.completionRatio ?? 0) * 100)}% completado
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={() => void repeatSession()}
        >
          <Copy size={17} /> Repetir
        </button>
      </header>
      <section className="history-summary">
        <span>
          Duración:{' '}
          {duration(
            Date.parse(
              session.completedAt ?? session.cancelledAt ?? session.startedAt,
            ) - Date.parse(session.startedAt),
          )}
        </span>
        <span>Trabajo: {duration(session.totalWorkMs)}</span>
        <span>Descanso: {duration(session.totalRestMs)}</span>
        {session.cancelReason ? (
          <span>Motivo: {session.cancelReason}</span>
        ) : null}
      </section>
      <section className="history-units">
        <h2>Desarrollo</h2>
        {session.units.map((unit) => (
          <article key={unit.id} className="history-unit">
            <header>
              <span>Bloque {unit.blockPosition + 1}</span>
              <strong>{unit.blockName}</strong>
              <span>
                {unit.method === 'SUPERSET'
                  ? 'Superset'
                  : unit.method === 'PYRAMID'
                    ? 'Pirámide'
                    : 'Serie'}
              </span>
            </header>
            {unit.items.map((item) => (
              <div className="history-unit-item" key={item.variantId}>
                {item.media.find((media) => media.kind === 'IMAGE') ? (
                  <ProtectedImage
                    className="history-exercise-image"
                    src={
                      item.media.find((media) => media.kind === 'IMAGE')!.url
                    }
                    alt={
                      item.media.find((media) => media.kind === 'IMAGE')!
                        .altText
                    }
                  />
                ) : null}
                <div>
                  <h3>
                    {item.exerciseName} · {item.variantName}
                  </h3>
                  <p>{exerciseTypeLabels[item.exerciseType]}</p>
                  <div className="history-targets">
                    {item.targets.map((target, index) => (
                      <span key={index}>
                        {target.label}:{' '}
                        {target.minimumValue === target.maximumValue
                          ? targetValue(target.minimumValue, target.metricKind)
                          : `${targetValue(target.minimumValue, target.metricKind)}–${targetValue(target.maximumValue, target.metricKind)}`}{' '}
                        {target.metricKind === 'DURATION' ? 's' : 'reps'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <footer>
              {unit.startedAt
                ? `Trabajo: ${duration(Date.parse(unit.completedAt ?? unit.startedAt) - Date.parse(unit.startedAt))}`
                : 'No iniciada'}
              {unit.actualResult ? ` · Resultado: ${unit.actualResult}` : ''}
              {unit.restStartedAt
                ? ` · Descanso: ${duration(Date.parse(unit.restCompletedAt ?? unit.restStartedAt) - Date.parse(unit.restStartedAt))}`
                : ''}
              {unit.method === 'PYRAMID' && unit.startedAt
                ? ` · Pirámide: ${duration(Date.parse(unit.completedAt ?? unit.startedAt) - Date.parse(unit.startedAt))}`
                : ''}
            </footer>
          </article>
        ))}
      </section>
      <section className="history-notes">
        <label htmlFor="session-notes">Notas de la sesión</label>
        <textarea
          id="session-notes"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void persistNotes()}
        >
          <Save size={16} /> Guardar notas
        </button>
      </section>
    </div>
  )
}
