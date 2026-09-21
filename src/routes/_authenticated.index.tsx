import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ImageIcon,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Video,
  X,
} from 'lucide-react'
import {
  getCatalogOptionsFn,
  listCatalogVariantsFn,
} from '../server/functions/catalog'
import { exerciseTypes } from '../domain/catalog'
import type { ExerciseType } from '../domain/catalog'
import { DifficultyBadge } from '../components/difficulty'
import { VariantModal } from '../components/variant-modal'
import { ProtectedImage } from '../components/protected-image'

interface CatalogSearch {
  q?: string
  types?: string
  min?: number
  max?: number
  progression?: 'primary' | 'supplementary'
  variant?: string
}

function optionalLevel(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5
    ? parsed
    : undefined
}

function validateSearch(search: Record<string, unknown>): CatalogSearch {
  const q = typeof search.q === 'string' ? search.q.trim().slice(0, 120) : ''
  const selectedTypes =
    typeof search.types === 'string'
      ? search.types
          .split(',')
          .filter((value): value is ExerciseType =>
            exerciseTypes.includes(value as ExerciseType),
          )
      : []
  const min = optionalLevel(search.min)
  const max = optionalLevel(search.max)
  return {
    q: q || undefined,
    types: selectedTypes.length
      ? [...new Set(selectedTypes)].join(',')
      : undefined,
    min,
    max: min && max && max < min ? min : max,
    progression:
      search.progression === 'primary' || search.progression === 'supplementary'
        ? search.progression
        : undefined,
    variant: typeof search.variant === 'string' ? search.variant : undefined,
  }
}

function inputFromSearch(search: CatalogSearch, cursor: string | null = null) {
  return {
    q: search.q ?? '',
    exerciseTypes: (search.types?.split(',') ?? []) as ExerciseType[],
    difficultyMin: search.min ?? null,
    difficultyMax: search.max ?? null,
    primaryProgression:
      search.progression === 'primary'
        ? true
        : search.progression === 'supplementary'
          ? false
          : null,
    cursor,
    limit: 24,
  }
}

export const Route = createFileRoute('/_authenticated/')({
  validateSearch,
  loaderDeps: ({ search }) => ({
    q: search.q,
    types: search.types,
    min: search.min,
    max: search.max,
    progression: search.progression,
  }),
  loader: async ({ deps }) => {
    const [firstPage, options] = await Promise.all([
      listCatalogVariantsFn({ data: inputFromSearch(deps) }),
      getCatalogOptionsFn(),
    ])
    return { firstPage, options }
  },
  component: CatalogPage,
})

function CatalogPage() {
  const search = Route.useSearch()
  const { firstPage, options } = Route.useLoaderData()
  const navigate = useNavigate({ from: Route.fullPath })
  const listVariants = useServerFn(listCatalogVariantsFn)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastSubmittedQueryRef = useRef(search.q ?? '')
  const [searchText, setSearchText] = useState(search.q ?? '')
  const filters = useMemo(
    () => ({
      q: search.q,
      types: search.types,
      min: search.min,
      max: search.max,
      progression: search.progression,
    }),
    [search.q, search.types, search.min, search.max, search.progression],
  )
  const query = useInfiniteQuery({
    queryKey: ['catalog', filters],
    queryFn: ({ pageParam }) =>
      listVariants({ data: inputFromSearch(search, pageParam) }),
    initialPageParam: null as string | null,
    initialData: { pages: [firstPage], pageParams: [null] },
    getNextPageParam: (lastPage) => lastPage.page.nextCursor ?? undefined,
  })
  const variants = query.data.pages.flatMap((page) => page.items)
  const selectedTypes = search.types?.split(',') ?? []
  const hasFilters = Boolean(
    search.q || search.types || search.min || search.max || search.progression,
  )
  const normalizedSearchText = searchText.trim()
  const isSearchPending = normalizedSearchText !== (search.q ?? '')

  useEffect(() => {
    const syncAfterHistoryNavigation = () => {
      window.setTimeout(() => {
        const urlQuery =
          new URL(window.location.href).searchParams.get('q') ?? ''
        lastSubmittedQueryRef.current = urlQuery
        setSearchText(urlQuery)
      })
    }
    window.addEventListener('popstate', syncAfterHistoryNavigation)
    return () =>
      window.removeEventListener('popstate', syncAfterHistoryNavigation)
  }, [])

  useEffect(() => {
    if (!isSearchPending) return
    const timeout = window.setTimeout(() => {
      lastSubmittedQueryRef.current = normalizedSearchText
      void navigate({
        search: (previous) => ({
          ...previous,
          q: normalizedSearchText || undefined,
          variant: undefined,
        }),
        replace: true,
      })
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [isSearchPending, navigate, normalizedSearchText])

  useEffect(() => {
    const target = sentinelRef.current
    if (!target || !query.hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !query.isFetchingNextPage)
          void query.fetchNextPage()
      },
      { rootMargin: '500px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

  const updateSearch = (patch: Partial<CatalogSearch>) => {
    void navigate({
      search: (previous) => ({ ...previous, ...patch, variant: undefined }),
      replace: true,
    })
  }
  const toggleType = (type: ExerciseType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((value) => value !== type)
      : [...selectedTypes, type]
    updateSearch({ types: next.length ? next.join(',') : undefined })
  }

  return (
    <div className="catalog-page">
      <section className="catalog-hero">
        <p className="eyebrow">Biblioteca de movimiento</p>
        <h1>Catálogo de variantes</h1>
        <p>
          Explora las 71 variantes de Desencadenado, con su técnica y material
          audiovisual.
        </p>
      </section>

      <section className="filter-panel" aria-label="Filtros del catálogo">
        <label className="search-field">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Buscar variantes</span>
          <input
            type="search"
            value={searchText}
            maxLength={120}
            placeholder="Buscar por nombre, grupo o descripción…"
            onChange={(event) => setSearchText(event.target.value)}
          />
          {isSearchPending ? (
            <span className="search-pending" aria-label="Aplicando búsqueda" />
          ) : null}
          {searchText ? (
            <button
              type="button"
              onClick={() => {
                lastSubmittedQueryRef.current = ''
                setSearchText('')
                updateSearch({ q: undefined })
              }}
              aria-label="Borrar búsqueda"
            >
              <X size={17} />
            </button>
          ) : null}
        </label>
        <div className="filter-heading">
          <SlidersHorizontal size={17} /> Tipo de ejercicio
        </div>
        <div className="type-filters">
          {options.exerciseTypes.map((option) => (
            <button
              key={option.value}
              type="button"
              data-active={selectedTypes.includes(option.value)}
              onClick={() => toggleType(option.value)}
            >
              {option.label}
              <span>{option.count}</span>
            </button>
          ))}
        </div>
        <div className="filter-heading">
          <TrendingUp size={17} /> Progresión
        </div>
        <div className="progression-filters">
          <button
            type="button"
            data-active={!search.progression}
            onClick={() => updateSearch({ progression: undefined })}
          >
            Todas{' '}
            <span>
              {options.progression.primary + options.progression.supplementary}
            </span>
          </button>
          <button
            type="button"
            data-active={search.progression === 'primary'}
            onClick={() => updateSearch({ progression: 'primary' })}
          >
            Progresión principal <span>{options.progression.primary}</span>
          </button>
          <button
            type="button"
            data-active={search.progression === 'supplementary'}
            onClick={() => updateSearch({ progression: 'supplementary' })}
          >
            Complementarias <span>{options.progression.supplementary}</span>
          </button>
        </div>
        <div className="difficulty-filters">
          <span>Dificultad que se solape con</span>
          <label>
            Desde
            <select
              value={search.min ?? ''}
              onChange={(event) =>
                updateSearch({ min: optionalLevel(event.target.value) })
              }
            >
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  Nivel {level}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hasta
            <select
              value={search.max ?? ''}
              onChange={(event) =>
                updateSearch({ max: optionalLevel(event.target.value) })
              }
            >
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  Nivel {level}
                </option>
              ))}
            </select>
          </label>
          {hasFilters ? (
            <button
              className="clear-filters"
              type="button"
              onClick={() => {
                lastSubmittedQueryRef.current = ''
                setSearchText('')
                void navigate({ search: {}, replace: true })
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>

      <div className="catalog-summary" aria-live="polite">
        <strong>{variants.length}</strong> variantes mostradas
        {query.hasNextPage ? ' · sigue bajando para ver más' : ''}
      </div>

      {variants.length ? (
        <section className="variant-grid" aria-label="Variantes">
          {variants.map((variant) => (
            <article className="variant-card" key={variant.id}>
              <button
                className="variant-card-cover"
                type="button"
                onClick={() =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      variant: variant.id,
                    }),
                  })
                }
                aria-label={`Ver ${variant.exerciseName}: ${variant.name}`}
              >
                {variant.cover ? (
                  <ProtectedImage
                    src={variant.cover.url}
                    alt={variant.cover.altText}
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon size={36} />
                )}
                <span className="media-count">
                  <ImageIcon size={14} /> {variant.imageCount}
                  {variant.videoCount ? (
                    <>
                      <Video size={14} /> {variant.videoCount}
                    </>
                  ) : null}
                </span>
              </button>
              <div className="variant-card-body">
                <div className="card-kicker">{variant.exerciseTypeLabel}</div>
                <button
                  type="button"
                  className="card-title"
                  onClick={() =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        variant: variant.id,
                      }),
                    })
                  }
                >
                  <span>{variant.exerciseName}</span>
                  <strong>{variant.name}</strong>
                </button>
                <div className="card-footer">
                  <DifficultyBadge
                    min={variant.difficultyMin}
                    max={variant.difficultyMax}
                  />
                  <span>{variant.bodyGroup}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Search size={30} />
          <h2>No hay coincidencias</h2>
          <p>Prueba con otros filtros o una búsqueda más amplia.</p>
        </div>
      )}
      <div ref={sentinelRef} className="catalog-sentinel">
        {query.isFetchingNextPage ? 'Cargando más variantes…' : null}
        {query.hasNextPage && !query.isFetchingNextPage ? (
          <button type="button" onClick={() => void query.fetchNextPage()}>
            Cargar más
          </button>
        ) : null}
      </div>
      {search.variant ? (
        <VariantModal
          variantId={search.variant}
          onClose={() =>
            void navigate({
              search: (previous) => ({ ...previous, variant: undefined }),
              replace: true,
            })
          }
        />
      ) : null}
    </div>
  )
}
