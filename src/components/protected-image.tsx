import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { ImageIcon } from 'lucide-react'

interface ProtectedImageProps extends Omit<ComponentProps<'img'>, 'src'> {
  src: string
  linkToOriginal?: boolean
  linkLabel?: string
}

export function ProtectedImage({
  src,
  alt,
  linkToOriginal = false,
  linkLabel,
  ...imageProps
}: ProtectedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let createdUrl: string | null = null
    setObjectUrl(null)
    setFailed(false)

    void fetch(src, { credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error(`Media request failed with ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('No se pudo cargar una imagen protegida.', error)
          setFailed(true)
        }
      })

    return () => {
      controller.abort()
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [src])

  if (!objectUrl) {
    return (
      <span
        className="protected-image-placeholder"
        role={failed ? 'status' : undefined}
      >
        <ImageIcon aria-hidden="true" />
        <span>{failed ? 'Imagen no disponible' : 'Cargando imagen…'}</span>
      </span>
    )
  }

  const image = <img src={objectUrl} alt={alt} {...imageProps} />
  return linkToOriginal ? (
    <a href={objectUrl} target="_blank" rel="noreferrer" aria-label={linkLabel}>
      {image}
    </a>
  ) : (
    image
  )
}
