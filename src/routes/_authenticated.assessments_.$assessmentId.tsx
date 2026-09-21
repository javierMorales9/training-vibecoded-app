import { useEffect, useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, Check, ChevronRight, Flag, Save, X } from 'lucide-react'
import {
  cancelAssessmentFn,
  getAssessmentFn,
  recordAssessmentResultFn,
  updateAssessmentNotesFn,
} from '../server/functions/assessments'
import { formatMeasurement } from '../domain/assessment'
import { MediaGallery } from '../components/media-gallery'

export const Route = createFileRoute(
  '/_authenticated/assessments_/$assessmentId',
)({
  loader: ({ params }) =>
    getAssessmentFn({ data: { assessmentId: params.assessmentId } }),
  component: AssessmentRunner,
})

function AssessmentRunner() {
  const assessment = Route.useLoaderData()
  const { assessmentId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const recordResult = useServerFn(recordAssessmentResultFn)
  const cancel = useServerFn(cancelAssessmentFn)
  const saveNotes = useServerFn(updateAssessmentNotesFn)
  const [failureMode, setFailureMode] = useState(false)
  const [actualValues, setActualValues] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState(assessment?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const step = assessment?.currentStep

  useEffect(() => {
    setFailureMode(false)
    setActualValues({})
  }, [step?.capability, step?.level])

  if (!assessment) {
    return (
      <div className="assessment-runner terminal-assessment">
        <h1>No se encontró la evaluación</h1>
        <Link to="/assessments" className="secondary-button">
          Volver a evaluaciones
        </Link>
      </div>
    )
  }

  if (assessment.status !== 'IN_PROGRESS' || !step || !step.variant) {
    return (
      <div className="assessment-runner terminal-assessment">
        <Flag size={40} />
        <p className="eyebrow">Evaluación terminada</p>
        <h1>
          {assessment.status === 'COMPLETED'
            ? 'Evaluación completada'
            : 'Evaluación cancelada'}
        </h1>
        <p>El resultado se conserva en tu historial.</p>
        <Link
          to="/assessments"
          search={{ assessment: assessment.id }}
          className="primary-button"
        >
          Ver resultados
        </Link>
      </div>
    )
  }

  const submit = async (outcome: 'PASSED' | 'FAILED') => {
    setBusy(true)
    setMessage(null)
    try {
      const updated = await recordResult({
        data: {
          assessmentId,
          capability: step.capability,
          level: step.level,
          outcome,
          measurements: step.requirements.map((requirement) => {
            const rawValue = actualValues[requirement.position]
            const parsed = Number(rawValue)
            const actualValue =
              rawValue !== undefined &&
              rawValue.trim() !== '' &&
              Number.isFinite(parsed) &&
              parsed >= 0
                ? requirement.metricKind === 'DURATION'
                  ? Math.round(parsed * 1000)
                  : Math.round(parsed)
                : null
            return { position: requirement.position, actualValue }
          }),
        },
      })
      await router.invalidate()
      if (updated?.status === 'COMPLETED') {
        await navigate({
          to: '/assessments',
          search: { assessment: assessmentId },
        })
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el resultado.',
      )
    } finally {
      setBusy(false)
    }
  }

  const cancelCurrent = async () => {
    if (
      !window.confirm(
        '¿Cancelar esta evaluación? Se conservarán los resultados ya registrados, pero no actualizará tus niveles actuales.',
      )
    )
      return
    setBusy(true)
    try {
      await cancel({ data: { assessmentId } })
      await router.invalidate()
      await navigate({
        to: '/assessments',
        search: { assessment: assessmentId },
      })
    } finally {
      setBusy(false)
    }
  }

  const persistNotes = async () => {
    setBusy(true)
    try {
      await saveNotes({ data: { assessmentId, notes } })
      setMessage('Notas guardadas.')
    } finally {
      setBusy(false)
    }
  }

  const completedCapabilities = assessment.capabilities.filter(
    (capability) => capability.status === 'COMPLETED',
  ).length

  return (
    <div className="assessment-runner">
      <header className="runner-header">
        <Link to="/assessments" className="runner-back">
          <ArrowLeft size={17} /> Evaluaciones
        </Link>
        <div className="runner-progress-copy">
          <span>
            Capacidad {step.position} de 5 · nivel {step.level}
          </span>
          <strong>{step.capabilityLabel}</strong>
        </div>
        <button
          className="cancel-link"
          type="button"
          disabled={busy}
          onClick={() => void cancelCurrent()}
        >
          Cancelar
        </button>
      </header>
      <div className="runner-progress" aria-hidden="true">
        <span
          style={{
            width: `${((completedCapabilities + 0.15) / 5) * 100}%`,
          }}
        />
      </div>

      <main className="assessment-step">
        <section className="assessment-visual">
          <MediaGallery
            media={step.variant.media}
            title={`${step.variant.exerciseName}: ${step.variant.name}`}
          />
        </section>
        <section className="assessment-prompt">
          <p className="eyebrow">
            {step.capabilityLabel} · Nivel {step.level}
          </p>
          <h1>
            <span>{step.variant.exerciseName}</span>
            {step.variant.name}
          </h1>
          <div className="assessment-target">
            <span>Objetivo para superar el nivel</span>
            {step.requirements.map((requirement) => (
              <strong key={requirement.position}>
                {formatMeasurement(
                  requirement.requiredValue,
                  requirement.metricKind,
                  requirement.scope,
                )}
                <small>{requirement.label}</small>
              </strong>
            ))}
          </div>
          {step.instructions ? (
            <p className="step-instructions">{step.instructions}</p>
          ) : null}
          <details className="technique-details">
            <summary>
              Ver técnica y descripción <ChevronRight size={16} />
            </summary>
            <p>{step.variant.description}</p>
          </details>

          {!failureMode ? (
            <div className="assessment-answer">
              <p>¿Has superado el objetivo?</p>
              <div>
                <button
                  className="primary-button pass-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void submit('PASSED')}
                >
                  <Check size={20} /> Sí, superado
                </button>
                <button
                  className="fail-button"
                  type="button"
                  disabled={busy}
                  onClick={() => setFailureMode(true)}
                >
                  <X size={20} /> No esta vez
                </button>
              </div>
            </div>
          ) : (
            <div className="failure-panel">
              <div>
                <h2>Registra hasta dónde has llegado</h2>
                <p>Es opcional; puedes continuar sin introducirlo.</p>
              </div>
              {step.requirements.map((requirement) => (
                <label key={requirement.position}>
                  {requirement.label}
                  <span>
                    <input
                      inputMode="numeric"
                      type="number"
                      min="0"
                      step="1"
                      value={actualValues[requirement.position] ?? ''}
                      onChange={(event) =>
                        setActualValues((current) => ({
                          ...current,
                          [requirement.position]: event.target.value,
                        }))
                      }
                    />
                    {requirement.metricKind === 'DURATION'
                      ? 'segundos'
                      : 'repeticiones'}
                  </span>
                </label>
              ))}
              <div className="failure-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setFailureMode(false)}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void submit('FAILED')}
                >
                  Registrar y seguir <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
          {message ? <p className="runner-message">{message}</p> : null}
        </section>
      </main>

      <aside className="assessment-notes">
        <label htmlFor="assessment-notes">Notas de la evaluación</label>
        <textarea
          id="assessment-notes"
          maxLength={2000}
          rows={2}
          value={notes}
          placeholder="Sensaciones, molestias, contexto…"
          onChange={(event) => setNotes(event.target.value)}
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void persistNotes()}
        >
          <Save size={15} /> Guardar notas
        </button>
      </aside>
    </div>
  )
}
