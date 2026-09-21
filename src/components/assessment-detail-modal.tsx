import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Clock3, X, XCircle } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { getAssessmentFn } from '../server/functions/assessments'
import { formatMeasurement } from '../domain/assessment'

const statusLabels = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
} as const

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AssessmentDetailModal({
  assessmentId,
  onClose,
}: {
  assessmentId: string
  onClose: () => void
}) {
  const getAssessment = useServerFn(getAssessmentFn)
  const query = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => getAssessment({ data: { assessmentId } }),
  })

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="assessment-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de evaluación"
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X />
        </button>
        {query.isPending ? (
          <div className="modal-loading">Cargando evaluación…</div>
        ) : !query.data ? (
          <div className="modal-loading">No se encontró la evaluación.</div>
        ) : (
          <div className="assessment-modal-content">
            <p className="eyebrow">Historial de capacidades</p>
            <div className="assessment-detail-heading">
              <div>
                <h2>Evaluación</h2>
                <p>{formatDate(query.data.startedAt)}</p>
              </div>
              <span className={`status-pill status-${query.data.status}`}>
                {statusLabels[query.data.status]}
              </span>
            </div>
            <div className="assessment-detail-grid">
              {query.data.capabilities.map((capability) => (
                <section
                  className="capability-detail"
                  key={capability.capability}
                >
                  <header>
                    <div>
                      <span>{capability.position}/5</span>
                      <h3>{capability.capabilityLabel}</h3>
                    </div>
                    <strong>
                      {capability.maximumLevel
                        ? `Nivel ${capability.maximumLevel}`
                        : capability.status === 'IN_PROGRESS'
                          ? 'En curso'
                          : 'Sin iniciar'}
                    </strong>
                  </header>
                  {capability.results.length ? (
                    <ol className="result-list">
                      {capability.results.map((result) => (
                        <li key={result.id} data-outcome={result.outcome}>
                          <span className="result-icon">
                            {result.outcome === 'PASSED' ? (
                              <Check size={16} />
                            ) : (
                              <XCircle size={16} />
                            )}
                          </span>
                          <div>
                            <strong>
                              Nivel {result.level} · {result.variantName}
                            </strong>
                            {result.measurements.map((measurement) => (
                              <p key={measurement.position}>
                                Objetivo:{' '}
                                {formatMeasurement(
                                  measurement.requiredValue,
                                  measurement.metricKind,
                                  measurement.scope,
                                )}
                                {measurement.actualValue !== null
                                  ? ` · Real: ${formatMeasurement(
                                      measurement.actualValue,
                                      measurement.metricKind,
                                      measurement.scope,
                                    )}`
                                  : ''}
                              </p>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="no-results">Sin niveles registrados.</p>
                  )}
                </section>
              ))}
            </div>
            <footer className="assessment-detail-footer">
              <Clock3 size={16} />
              {query.data.completedAt
                ? `Finalizada el ${formatDate(query.data.completedAt)}`
                : query.data.cancelledAt
                  ? `Cancelada el ${formatDate(query.data.cancelledAt)}`
                  : 'Evaluación guardada y pendiente de continuar'}
              {query.data.notes ? <p>{query.data.notes}</p> : null}
            </footer>
          </div>
        )}
      </section>
    </div>
  )
}
