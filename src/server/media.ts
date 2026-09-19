import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { getMediaAsset } from '../application/catalog'
import { getConfig } from './config'
import { problemResponse } from './http'

export async function serveMedia(mediaId: string, request: Request) {
  const media = getMediaAsset(mediaId)
  if (!media)
    return problemResponse(
      404,
      'MEDIA_NOT_FOUND',
      'Medio no encontrado',
      'No existe ese elemento audiovisual.',
      request,
    )
  if (media.kind === 'VIDEO' && media.external_url)
    return Response.redirect(media.external_url, 302)
  if (media.storage_kind !== 'LOCAL' || !media.storage_key) {
    return problemResponse(
      404,
      'MEDIA_NOT_AVAILABLE',
      'Medio no disponible',
      'El contenido no está disponible localmente.',
      request,
    )
  }

  const root = path.resolve(getConfig().localMediaPath)
  const target = path.resolve(root, media.storage_key)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    return problemResponse(
      400,
      'INVALID_MEDIA_PATH',
      'Ruta no válida',
      'La ruta del medio no es válida.',
      request,
    )
  }
  try {
    const data = await readFile(target)
    return new Response(data, {
      headers: {
        'content-type': media.mime_type ?? 'application/octet-stream',
        'cache-control': 'private, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    return problemResponse(
      404,
      'MEDIA_FILE_NOT_FOUND',
      'Fichero no encontrado',
      'El fichero asociado no existe.',
      request,
    )
  }
}
