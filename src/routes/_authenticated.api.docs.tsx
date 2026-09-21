import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/api/docs')({
  component: ApiDocsPage,
})

const endpoints = [
  [
    'GET',
    '/api/v1/exercise-variants',
    'Listado filtrable y paginado por cursor',
  ],
  [
    'GET',
    '/api/v1/exercise-variants/{variantId}',
    'Detalle completo y galería',
  ],
  [
    'GET',
    '/api/v1/exercise-catalog-options',
    'Tipos, conteos y rango de dificultad',
  ],
  [
    'GET',
    '/api/v1/capability-level-definitions',
    'Requisitos masculinos de evaluación',
  ],
  ['GET', '/api/v1/assessments', 'Historial de evaluaciones'],
  [
    'GET',
    '/api/v1/assessments/{assessmentId}',
    'Resultados y criterios congelados',
  ],
  [
    'GET',
    '/api/v1/current-capability-levels',
    'Niveles actuales derivados del último test',
  ],
  ['GET · PUT', '/api/v1/workout-queue', 'Consulta y reordenación atómica'],
  ['POST', '/api/v1/workouts', 'Crear al final de la cola'],
  [
    'GET · PUT · DELETE',
    '/api/v1/workouts/{workoutId}',
    'Consultar, sustituir o eliminar un pendiente',
  ],
  [
    'POST',
    '/api/v1/workouts/{workoutId}/duplicate',
    'Duplicar tras el original',
  ],
  [
    'GET',
    '/api/v1/workouts/{workoutId}/validation',
    'Comprobar si está listo para iniciar',
  ],
  ['GET', '/api/v1/media-assets/{mediaId}/content', 'Contenido audiovisual'],
  ['GET', '/api/v1/openapi.json', 'Contrato OpenAPI 3.1'],
]

function ApiDocsPage() {
  return (
    <div className="docs-page">
      <header className="page-header">
        <p className="eyebrow">Contrato público limitado</p>
        <h1>Training API</h1>
        <p>
          Autentica cada petición con{' '}
          <code>Authorization: Bearer &lt;token&gt;</code>.
        </p>
      </header>
      <section className="settings-card">
        <h2>Endpoints disponibles</h2>
        <div className="endpoint-list">
          {endpoints.map(([method, path, description]) => (
            <div className="endpoint-row" key={path}>
              <b>{method}</b>
              <code>{path}</code>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-card compact-card">
        <h2>Ejemplo</h2>
        <pre>
          <code>{`curl -H "Authorization: Bearer $TRAINING_TOKEN" \\\n  "http://localhost:3000/api/v1/exercise-variants?exerciseType=PUSH_UP&difficultyMax=3"`}</code>
        </pre>
        <p>
          Las colecciones responden con <code>{`{ data, meta }`}</code>; los
          errores siguen Problem Details.
        </p>
      </section>
    </div>
  )
}
