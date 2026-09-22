import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, X } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { getCatalogVariantFn } from '../server/functions/catalog'
import { DifficultyBadge } from './difficulty'
import { MediaGallery } from './media-gallery'

export function VariantModal({
  variantId,
  onClose,
}: {
  variantId: string
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const pushedHistoryEntry = useRef(false)
  const dismissing = useRef(false)
  const getVariant = useServerFn(getCatalogVariantFn)
  const query = useQuery({
    queryKey: ['catalog-variant', variantId],
    queryFn: () => getVariant({ data: { variantId } }),
  })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const dismiss = useCallback(() => {
    if (dismissing.current) return
    dismissing.current = true
    if (pushedHistoryEntry.current) {
      pushedHistoryEntry.current = false
      window.history.back()
    }
    onCloseRef.current()
  }, [])

  useEffect(() => {
    window.history.pushState({ variantModal: true }, '')
    pushedHistoryEntry.current = true
    const handlePopState = () => {
      pushedHistoryEntry.current = false
      dismissing.current = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', keydown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', keydown)
    }
  }, [dismiss])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && dismiss()
      }
    >
      <section
        className="variant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variant-title"
      >
        <button
          ref={closeRef}
          className="modal-close"
          type="button"
          onClick={dismiss}
          aria-label="Cerrar detalle"
        >
          <X />
        </button>
        {query.isPending ? (
          <div className="modal-loading">Cargando variante…</div>
        ) : null}
        {query.isError ? (
          <div className="modal-loading">No se pudo cargar la variante.</div>
        ) : null}
        {query.data ? (
          <>
            <MediaGallery
              media={query.data.media}
              title={`${query.data.exerciseName}: ${query.data.name}`}
            />
            <div className="variant-modal-content">
              <p className="eyebrow">{query.data.exerciseTypeLabel}</p>
              <h2 id="variant-title">
                <span>{query.data.exerciseName}</span>
                {query.data.name !== query.data.exerciseName
                  ? ` · ${query.data.name}`
                  : ''}
              </h2>
              <div className="variant-meta">
                <DifficultyBadge
                  min={query.data.difficultyMin}
                  max={query.data.difficultyMax}
                />
                <span>{query.data.bodyGroup}</span>
              </div>
              <div className="description-copy">
                {query.data.description.split(/\n\n+/).map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
              {query.data.sourcePageStart ? (
                <p className="source-reference">
                  <BookOpen size={16} /> Libro, página{' '}
                  {query.data.sourcePageStart}
                  {query.data.sourcePageEnd !== query.data.sourcePageStart
                    ? `–${query.data.sourcePageEnd}`
                    : ''}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
