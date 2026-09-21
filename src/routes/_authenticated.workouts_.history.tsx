import { useEffect, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Copy,
  History,
  SlidersHorizontal,
} from 'lucide-react'
import { exerciseTypeLabels, exerciseTypes } from '../domain/catalog'
import {
  listTrainingSessionsFn,
  repeatTrainingSessionFn,
} from '../server/functions/training-sessions'

interface HistorySearch {
  status: '' | 'COMPLETED' | 'CANCELLED'
  exerciseType: '' | (typeof exerciseTypes)[number]
  from: string
  to: string
}

export const Route = createFileRoute('/_authenticated/workouts_/history')({
  validateSearch: (search: Record<string, unknown>): HistorySearch => ({
    status:
      search.status === 'COMPLETED' || search.status === 'CANCELLED'
        ? search.status
        : '',
    exerciseType: exerciseTypes.includes(search.exerciseType as never)
      ? (search.exerciseType as HistorySearch['exerciseType'])
      : '',
    from: typeof search.from === 'string' ? search.from : '',
    to: typeof search.to === 'string' ? search.to : '',
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    listTrainingSessionsFn({
      data: historyInput(deps),
    }),
  component: WorkoutHistoryPage,
})

function dateMs(value: string, end = false) {
  if (!value) return null
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(date.valueOf()) ? null : date.valueOf()
}

function historyInput(search: HistorySearch, cursor: string | null = null) {
  return {
    statuses: search.status ? [search.status] : [],
    exerciseTypes: search.exerciseType ? [search.exerciseType] : [],
    startedFrom: dateMs(search.from),
    startedTo: dateMs(search.to, true),
    cursor,
    limit: 30,
  }
}

function duration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function WorkoutHistoryPage() {
  const matchRoute = useMatchRoute()
  const initial = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()
  const list = useServerFn(listTrainingSessionsFn)
  const repeat = useServerFn(repeatTrainingSessionFn)
  const [items, setItems] = useState(initial.items)
  const [page, setPage] = useState(initial.page)
  const [loading, setLoading] = useState(false)
  const [repeatingId, setRepeatingId] = useState<string | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setItems(initial.items)
    setPage(initial.page)
  }, [initial])

  const update = (changes: Partial<HistorySearch>) => {
    void navigate({
      to: '/workouts/history',
      search: { ...search, ...changes },
    })
  }
  const repeatSession = async (sessionId: string) => {
    setRepeatingId(sessionId)
    try {
      const workout = await repeat({ data: { sessionId } })
      if (!workout) return
      await router.invalidate()
      await navigate({
        to: '/workouts/$workoutId',
        params: { workoutId: workout.id },
      })
    } finally {
      setRepeatingId(null)
    }
  }
  const loadMore = async () => {
    if (!page.nextCursor || loading) return
    setLoading(true)
    try {
      const next = await list({ data: historyInput(search, page.nextCursor) })
      setItems((current) => [...current, ...next.items])
      setPage(next.page)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    const node = sentinel.current
    if (!node || !page.nextCursor || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '240px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading, page.nextCursor, search])

  if (matchRoute({ to: '/workouts/history/$sessionId', fuzzy: false })) {
    return <Outlet />
  }

  return (
    <div className="history-page">
      <header className="page-header history-header">
        <div>
          <Link className="back-link" to="/workouts">
            <ArrowLeft size={16} /> Entrenamientos
          </Link>
          <p className="eyebrow">Registro completo</p>
          <h1>Historial</h1>
          <p>Consulta lo realizado sin alterar las sesiones guardadas.</p>
        </div>
      </header>
      <section className="history-filters" aria-label="Filtros del historial">
        <SlidersHorizontal size={17} />
        <select
          value={search.status}
          onChange={(event) =>
            update({ status: event.target.value as HistorySearch['status'] })
          }
        >
          <option value="">Todos los estados</option>
          <option value="COMPLETED">Completados</option>
          <option value="CANCELLED">Cancelados</option>
        </select>
        <select
          value={search.exerciseType}
          onChange={(event) =>
            update({
              exerciseType: event.target.value as HistorySearch['exerciseType'],
            })
          }
        >
          <option value="">Todos los ejercicios</option>
          {exerciseTypes.map((type) => (
            <option key={type} value={type}>
              {exerciseTypeLabels[type]}
            </option>
          ))}
        </select>
        <label>
          Desde
          <input
            type="date"
            value={search.from}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={search.to}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>
      </section>
      {items.length ? (
        <section className="history-list">
          {items.map((session) => (
            <article className="history-card" key={session.id}>
              <Link
                className="history-card-link"
                to="/workouts/history/$sessionId"
                params={{ sessionId: session.id }}
                search={search}
              >
                <div>
                  <span
                    className={
                      session.status === 'COMPLETED'
                        ? 'ready-label'
                        : 'draft-label'
                    }
                  >
                    {session.status === 'COMPLETED'
                      ? 'Completado'
                      : 'Cancelado'}
                  </span>
                  <h2>{session.workoutName}</h2>
                  <time>
                    {new Date(session.startedAt).toLocaleString('es-ES')}
                  </time>
                </div>
                <div className="history-card-stats">
                  <span>
                    <Clock3 size={15} /> {duration(session.durationMs)}
                  </span>
                  <span>
                    {Math.round((session.completionRatio ?? 0) * 100)}%
                  </span>
                  <ArrowRight size={18} />
                </div>
              </Link>
              <button
                type="button"
                className="secondary-button history-repeat-button"
                disabled={repeatingId !== null}
                onClick={() => void repeatSession(session.id)}
              >
                <Copy size={15} />
                {repeatingId === session.id ? 'Duplicando…' : 'Duplicar'}
              </button>
            </article>
          ))}
          {page.hasMore ? (
            <div className="history-scroll-sentinel" ref={sentinel}>
              {loading ? 'Cargando…' : 'Sigue bajando para cargar más'}
            </div>
          ) : null}
        </section>
      ) : (
        <div className="empty-state">
          <History size={34} />
          <h2>Aún no hay sesiones</h2>
          <p>Cuando completes o canceles un entrenamiento aparecerá aquí.</p>
        </div>
      )}
    </div>
  )
}
