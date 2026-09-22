import { useEffect, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  CheckCircle2,
  Clock3,
  Dumbbell,
  Info,
  Play,
  Square,
  XCircle,
} from 'lucide-react'
import { MediaGallery } from '../components/media-gallery'
import {
  beginTrainingUnitFn,
  cancelTrainingSessionFn,
  completeTrainingWorkFn,
  getTrainingSessionFn,
} from '../server/functions/training-sessions'

export const Route = createFileRoute(
  '/_authenticated/workouts_/session/$sessionId',
)({
  loader: ({ params }) =>
    getTrainingSessionFn({ data: { sessionId: params.sessionId } }),
  component: TrainingSessionPage,
})

function formatClock(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function TrainingSessionPage() {
  const initial = Route.useLoaderData()
  const { sessionId } = Route.useParams()
  const router = useRouter()
  const navigate = useNavigate()
  const begin = useServerFn(beginTrainingUnitFn)
  const finish = useServerFn(completeTrainingWorkFn)
  const cancel = useServerFn(cancelTrainingSessionFn)
  const [session, setSession] = useState(initial)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [actualResult, setActualResult] = useState('')
  const notified = useRef(false)
  const notifiedPyramidUnit = useRef<string | null>(null)
  const audioContext = useRef<AudioContext | null>(null)

  useEffect(() => {
    setSession(initial)
  }, [initial])
  useEffect(() => {
    if (!session || !['WORKING', 'RESTING'].includes(session.phase)) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [session?.phase])
  useEffect(() => {
    if (!session || session.status !== 'ACTIVE') return
    const keepAlive = () => {
      void fetch('/healthz', { cache: 'no-store', credentials: 'same-origin' }).catch(
        () => undefined,
      )
    }
    keepAlive()
    const interval = window.setInterval(keepAlive, 2 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [session?.id, session?.status])
  useEffect(() => {
    const lock = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<{ release: () => Promise<void> }>
      }
    }
    if (!session || session.status !== 'ACTIVE' || !lock.wakeLock) return
    let sentinel: { release: () => Promise<void> } | undefined
    void lock.wakeLock
      .request('screen')
      .then((value) => {
        sentinel = value
      })
      .catch(() => undefined)
    return () => {
      void sentinel?.release()
    }
  }, [session?.id, session?.status])
  useEffect(
    () => () => {
      void audioContext.current?.close()
    },
    [],
  )

  const enableSound = async () => {
    try {
      audioContext.current ??= new AudioContext()
      if (audioContext.current.state === 'suspended') {
        await audioContext.current.resume()
      }
      // iOS requires at least one scheduled node inside the user gesture that
      // starts the workout before it will allow a later timer notification.
      const unlock = audioContext.current.createOscillator()
      const gain = audioContext.current.createGain()
      gain.gain.setValueAtTime(0.0001, audioContext.current.currentTime)
      unlock.connect(gain)
      gain.connect(audioContext.current.destination)
      unlock.start()
      unlock.stop(audioContext.current.currentTime + 0.02)
    } catch {
      // Sound is only a convenience.
    }
  }

  const current = session?.units.find(
    (unit) => unit.position === session.currentUnitPosition,
  )
  const restingUnit = session?.units.find(
    (unit) => unit.restStartedAt && !unit.restCompletedAt,
  )
  const elapsed =
    session?.phase === 'WORKING' && current?.startedAt
      ? now - Date.parse(current.startedAt)
      : 0
  const pyramidRemaining = Math.max(0, (current?.plannedWorkMs ?? 0) - elapsed)
  const restElapsed =
    session?.phase === 'RESTING' && restingUnit?.restStartedAt
      ? now - Date.parse(restingUnit.restStartedAt)
      : 0
  const restRemaining = Math.max(
    0,
    (restingUnit?.plannedRestMs ?? 0) - restElapsed,
  )

  const playNotification = () => {
    try {
      const context = audioContext.current
      if (!context || context.state !== 'running') return
      const start = context.currentTime
      const gain = context.createGain()
      gain.connect(context.destination)
      ;[740, 880, 1040, 880].forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const offset = index * 0.34
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start + offset)
        oscillator.connect(gain)
        oscillator.start(start + offset)
        oscillator.stop(start + offset + 0.22)
      })
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.015)
      gain.gain.setValueAtTime(0.2, start + 1.18)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.3)
      navigator.vibrate?.([100, 90, 100, 90, 160])
    } catch {
      // Sound is only a convenience.
    }
  }

  useEffect(() => {
    if (session?.phase !== 'RESTING' || restRemaining > 0 || notified.current)
      return
    notified.current = true
    playNotification()
  }, [restRemaining, session?.phase])
  useEffect(() => {
    if (session?.phase !== 'RESTING') notified.current = false
  }, [session?.phase])
  useEffect(() => {
    if (
      session?.phase !== 'WORKING' ||
      current?.method !== 'PYRAMID' ||
      pyramidRemaining > 0 ||
      notifiedPyramidUnit.current === current.id
    )
      return
    notifiedPyramidUnit.current = current.id
    playNotification()
  }, [current?.id, current?.method, pyramidRemaining, session?.phase])

  const refresh = async (next: typeof initial) => {
    setSession(next)
    setNow(Date.now())
    await router.invalidate()
  }
  const action = async (kind: 'BEGIN' | 'FINISH') => {
    if (busy || !session) return
    if (kind === 'BEGIN') await enableSound()
    setBusy(true)
    try {
      const next =
        kind === 'BEGIN'
          ? await begin({ data: { sessionId } })
          : await finish({
              data: { sessionId, actualResult: actualResult || null },
            })
      if (kind === 'FINISH') setActualResult('')
      await refresh(next)
    } finally {
      setBusy(false)
    }
  }
  const cancelSession = async () => {
    if (!session || busy) return
    if (
      !window.confirm(
        '¿Cancelar este entrenamiento? Se guardará el progreso realizado.',
      )
    )
      return
    setBusy(true)
    try {
      const reason = window.prompt('Motivo opcional de la cancelación:') || null
      await refresh(await cancel({ data: { sessionId, reason } }))
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="training-runner not-found">
        <h1>Sesión no encontrada</h1>
        <Link to="/workouts">Volver a entrenamientos</Link>
      </div>
    )
  }
  if (session.status !== 'ACTIVE') {
    return (
      <div className="training-runner training-terminal">
        {session.status === 'COMPLETED' ? <CheckCircle2 /> : <XCircle />}
        <p className="eyebrow">
          Sesión {session.status === 'COMPLETED' ? 'completada' : 'cancelada'}
        </p>
        <h1>{session.workoutName}</h1>
        <p>
          {Math.round((session.completionRatio ?? 0) * 100)}% completado ·{' '}
          {formatClock(session.totalWorkMs)} de trabajo.
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={() => void navigate({ to: '/workouts' })}
        >
          Volver a entrenamientos
        </button>
      </div>
    )
  }
  if (!current) return null

  const isPyramid = current.method === 'PYRAMID'
  return (
    <div className="training-runner">
      <header className="training-runner-header">
        <div>
          <p className="eyebrow">En curso</p>
          <h1>{session.workoutName}</h1>
        </div>
        <button
          type="button"
          className="runner-cancel"
          disabled={busy}
          onClick={() => void cancelSession()}
        >
          <XCircle size={17} /> Cancelar
        </button>
      </header>
      <div className="runner-progress" aria-label="Progreso">
        <span
          style={{
            width: `${(session.units.filter((unit) => unit.status === 'COMPLETED').length / session.units.length) * 100}%`,
          }}
        />
      </div>
      {session.phase === 'RESTING' ? (
        <section className="rest-screen">
          <p className="eyebrow">Descanso</p>
          <Clock3 size={38} />
          <strong>{formatClock(restRemaining)}</strong>
          <span>
            {restRemaining
              ? 'Puedes empezar cuando quieras.'
              : 'Descanso terminado.'}
          </span>
          <button
            type="button"
            className="primary-button runner-main-action"
            disabled={busy}
            onClick={() => void action('BEGIN')}
          >
            <Play size={20} /> Empezar siguiente
          </button>
        </section>
      ) : (
        <section className="runner-work-card">
          <div className="runner-unit-meta">
            <span>Bloque {current.blockPosition + 1}</span>
            <span>
              {current.method === 'SUPERSET'
                ? 'Superset'
                : current.method === 'PYRAMID'
                  ? 'Pirámide'
                  : `Serie ${current.position + 1}`}
            </span>
          </div>
          {current.items.map((item) => (
            <article className="runner-exercise" key={item.variantId}>
              <p>{item.exerciseName}</p>
              <h2>{item.variantName}</h2>
              <div className="runner-targets">
                {item.targets.map((target, index) => {
                  const minimum =
                    target.metricKind === 'DURATION'
                      ? target.minimumValue / 1000
                      : target.minimumValue
                  const maximum =
                    target.metricKind === 'DURATION'
                      ? target.maximumValue / 1000
                      : target.maximumValue
                  return (
                    <span key={index}>
                      {minimum === maximum ? minimum : `${minimum}–${maximum}`}{' '}
                      {target.metricKind === 'DURATION' ? 's' : 'reps'}
                    </span>
                  )
                })}
              </div>
              <details>
                <summary>
                  <Info size={15} /> Ver descripción
                </summary>
                <p>{item.description}</p>
                {item.media.length ? (
                  <MediaGallery
                    media={item.media}
                    title={`${item.exerciseName}: ${item.variantName}`}
                  />
                ) : null}
              </details>
            </article>
          ))}
          {current.instructions ? (
            <p className="runner-instructions">{current.instructions}</p>
          ) : null}
          {session.phase === 'WORKING' ? (
            <div className="runner-timer">
              <span>
                {isPyramid ? 'Tiempo restante' : 'Tiempo de ejecución'}
              </span>
              <strong>
                {formatClock(isPyramid ? pyramidRemaining : elapsed)}
              </strong>
            </div>
          ) : null}
          {session.phase === 'WORKING' ? (
            <label className="runner-result">
              Resultado real opcional
              <textarea
                rows={2}
                value={actualResult}
                maxLength={500}
                placeholder="Repeticiones, tiempo o una nota para el historial"
                onChange={(event) => setActualResult(event.target.value)}
              />
            </label>
          ) : null}
          <button
            type="button"
            className="primary-button runner-main-action"
            disabled={busy}
            onClick={() =>
              void action(session.phase === 'WORKING' ? 'FINISH' : 'BEGIN')
            }
          >
            {session.phase === 'WORKING' ? (
              <>
                <Square size={19} /> Finalizar{' '}
                {current.method === 'SUPERSET'
                  ? 'pareja'
                  : isPyramid
                    ? 'pirámide'
                    : 'serie'}
              </>
            ) : (
              <>
                <Dumbbell size={20} /> Iniciar
              </>
            )}
          </button>
        </section>
      )}
    </div>
  )
}
