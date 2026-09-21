import { useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  History,
  Play,
} from 'lucide-react'
import {
  getCurrentCapabilityLevelsFn,
  listAssessmentsFn,
  startAssessmentFn,
} from '../server/functions/assessments'
import { AssessmentDetailModal } from '../components/assessment-detail-modal'

interface AssessmentSearch {
  assessment?: string
}

function validateSearch(search: Record<string, unknown>): AssessmentSearch {
  return {
    assessment:
      typeof search.assessment === 'string' ? search.assessment : undefined,
  }
}

const statusLabels = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
} as const

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const Route = createFileRoute('/_authenticated/assessments')({
  validateSearch,
  loader: async () => {
    const [history, currentLevels] = await Promise.all([
      listAssessmentsFn({
        data: { statuses: [], cursor: null, limit: 100 },
      }),
      getCurrentCapabilityLevelsFn(),
    ])
    return { history, currentLevels }
  },
  component: AssessmentsPage,
})

function AssessmentsPage() {
  const { history, currentLevels } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const start = useServerFn(startAssessmentFn)
  const [starting, setStarting] = useState(false)
  const active = history.items.find((item) => item.status === 'IN_PROGRESS')

  const begin = async () => {
    setStarting(true)
    try {
      const assessment = await start()
      if (assessment) {
        await router.invalidate()
        await navigate({
          to: '/assessments/$assessmentId',
          params: { assessmentId: assessment.id },
        })
      }
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="assessments-page">
      <section className="page-header assessments-header">
        <div>
          <p className="eyebrow">Seguimiento de capacidades</p>
          <h1>Evaluaciones</h1>
          <p>
            Repite el test cuando quieras y conserva una referencia real para
            planificar tus entrenamientos.
          </p>
        </div>
        <button
          className="primary-button assessment-start"
          type="button"
          disabled={starting}
          onClick={() => void begin()}
        >
          {active ? <Play size={18} /> : <ClipboardCheck size={18} />}
          {active ? 'Continuar evaluación' : 'Nueva evaluación'}
        </button>
      </section>

      <section
        className="current-levels"
        aria-labelledby="current-levels-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Última evaluación completada</p>
            <h2 id="current-levels-title">Niveles actuales</h2>
          </div>
          <CheckCircle2 aria-hidden="true" />
        </div>
        <div className="level-grid">
          {currentLevels.map((item) => (
            <article className="level-card" key={item.capability}>
              <span>{item.capabilityLabel}</span>
              {item.level ? (
                <strong>
                  <small>Nivel</small> {item.level}
                </strong>
              ) : (
                <strong className="unrated">—</strong>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="assessment-history" aria-labelledby="history-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Registro completo</p>
            <h2 id="history-title">Historial</h2>
          </div>
          <History aria-hidden="true" />
        </div>
        {history.items.length ? (
          <div className="assessment-list">
            {history.items.map((assessment) => (
              <article
                className="assessment-row"
                key={assessment.id}
                data-status={assessment.status}
              >
                <div>
                  <span className={`status-pill status-${assessment.status}`}>
                    {statusLabels[assessment.status]}
                  </span>
                  <strong>{formatDate(assessment.startedAt)}</strong>
                </div>
                <div className="assessment-level-summary">
                  {assessment.capabilities.map((capability) => (
                    <span key={capability.capability}>
                      {capability.capabilityLabel}
                      <b>
                        {capability.maximumLevel
                          ? `N${capability.maximumLevel}`
                          : '—'}
                      </b>
                    </span>
                  ))}
                </div>
                {assessment.status === 'IN_PROGRESS' ? (
                  <button
                    type="button"
                    className="row-action"
                    onClick={() =>
                      void navigate({
                        to: '/assessments/$assessmentId',
                        params: { assessmentId: assessment.id },
                      })
                    }
                  >
                    Continuar <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="row-action"
                    onClick={() =>
                      void navigate({
                        search: { assessment: assessment.id },
                      })
                    }
                  >
                    Ver detalle <ArrowRight size={16} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <ClipboardCheck size={30} />
            <h2>Aún no hay evaluaciones</h2>
            <p>La primera comenzará en el nivel 1 de cada capacidad.</p>
          </div>
        )}
      </section>

      {search.assessment ? (
        <AssessmentDetailModal
          assessmentId={search.assessment}
          onClose={() =>
            void navigate({ search: { assessment: undefined }, replace: true })
          }
        />
      ) : null}
    </div>
  )
}
