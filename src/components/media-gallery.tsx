import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Play,
} from 'lucide-react'
import type { CatalogMedia } from '../domain/catalog'
import { ProtectedImage } from './protected-image'

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url)
    const id = parsed.hostname.includes('youtu.be')
      ? parsed.pathname.slice(1)
      : parsed.searchParams.get('v')
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch {
    return null
  }
}

export function MediaGallery({
  media,
}: {
  media: CatalogMedia[]
  title: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const active = media[activeIndex]

  useEffect(() => setActiveIndex(0), [media])
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (media.length < 2) return
      if (event.key === 'ArrowLeft')
        setActiveIndex((current) => (current - 1 + media.length) % media.length)
      if (event.key === 'ArrowRight')
        setActiveIndex((current) => (current + 1) % media.length)
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [media.length])
  if (!active)
    return (
      <div className="gallery-empty">
        <ImageIcon /> Sin material visual
      </div>
    )

  const move = (direction: number) => {
    setActiveIndex(
      (current) => (current + direction + media.length) % media.length,
    )
  }
  const embed = active.kind === 'VIDEO' ? youtubeEmbedUrl(active.url) : null
  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || media.length < 2) return
    const touch = event.changedTouches[0]
    if (!touch) return
    const horizontalDistance = touch.clientX - start.x
    const verticalDistance = touch.clientY - start.y
    if (
      Math.abs(horizontalDistance) < 48 ||
      Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
    )
      return
    move(horizontalDistance < 0 ? 1 : -1)
  }

  return (
    <div className="gallery">
      <div
        className="gallery-stage"
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null
        }}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null
        }}
      >
        {active.kind === 'IMAGE' ? (
          <ProtectedImage src={active.url} alt={active.altText} />
        ) : embed ? (
          <iframe
            src={embed}
            title={active.altText}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <a
            className="video-link"
            href={active.url}
            target="_blank"
            rel="noreferrer"
          >
            <Play size={40} />
            Ver vídeo <ExternalLink size={16} />
          </a>
        )}
        {media.length > 1 ? (
          <>
            <button
              className="gallery-arrow gallery-arrow-left"
              type="button"
              onClick={() => move(-1)}
              aria-label="Medio anterior"
            >
              <ChevronLeft />
            </button>
            <button
              className="gallery-arrow gallery-arrow-right"
              type="button"
              onClick={() => move(1)}
              aria-label="Medio siguiente"
            >
              <ChevronRight />
            </button>
          </>
        ) : null}
      </div>
      <div className="gallery-thumbs" aria-label="Material audiovisual">
        {media.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className="gallery-thumb"
            data-active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            aria-label={`${item.kind === 'IMAGE' ? 'Imagen' : 'Vídeo'} ${index + 1}`}
            aria-pressed={index === activeIndex}
          >
            {item.kind === 'IMAGE' ? (
              <ProtectedImage src={item.url} alt="" />
            ) : (
              <Play size={20} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
