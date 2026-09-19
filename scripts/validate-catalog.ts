import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const mediaSchema = z.object({
  id: z.uuid(),
  position: z.number().int().nonnegative(),
  kind: z.enum(['IMAGE', 'VIDEO']),
  storageKind: z.enum(['LOCAL', 'S3', 'EXTERNAL_URL']),
  storageKey: z.string().nullable(),
  externalUrl: z.url().nullable(),
  mimeType: z.string(),
  altText: z.string().min(1),
})

const catalogSchema = z.object({
  version: z.literal(1),
  exercises: z
    .array(z.object({ name: z.string(), exerciseType: z.string() }))
    .length(13),
  variants: z
    .array(
      z.object({
        id: z.uuid(),
        slug: z.string().min(1),
        name: z.string().min(1),
        exerciseName: z.string().min(1),
        difficultyMin: z.number().int().min(1).max(5).nullable(),
        difficultyMax: z.number().int().min(1).max(5).nullable(),
        description: z.string().min(1),
        media: z.array(mediaSchema),
      }),
    )
    .length(71),
  capabilityDefinitions: z
    .array(z.object({ id: z.uuid(), level: z.number().int().min(1).max(5) }))
    .length(25),
})

const root = process.cwd()
const parsed = catalogSchema.parse(
  JSON.parse(await readFile(path.join(root, 'seed', 'catalog.json'), 'utf8')),
)

const ids = new Set<string>()
const slugs = new Set<string>()
let imageCount = 0
let videoCount = 0

for (const variant of parsed.variants) {
  if (ids.has(variant.id))
    throw new Error(`ID de variante duplicado: ${variant.id}`)
  if (slugs.has(variant.slug))
    throw new Error(`Slug duplicado: ${variant.slug}`)
  ids.add(variant.id)
  slugs.add(variant.slug)
  if ((variant.difficultyMin === null) !== (variant.difficultyMax === null)) {
    throw new Error(`Rango de dificultad incompleto: ${variant.slug}`)
  }

  for (const media of variant.media) {
    if (ids.has(media.id)) throw new Error(`ID de medio duplicado: ${media.id}`)
    ids.add(media.id)
    if (media.kind === 'IMAGE') {
      imageCount += 1
      if (!media.storageKey) throw new Error(`Imagen sin fichero: ${media.id}`)
      await access(
        path.join(
          root,
          'Desencadenado-Entrenos con peso corporal',
          'files',
          media.storageKey,
        ),
      )
    } else {
      videoCount += 1
    }
  }
}

if (imageCount !== 145)
  throw new Error(`Se esperaban 145 imágenes, hay ${imageCount}`)
if (videoCount !== 19)
  throw new Error(`Se esperaban 19 vídeos, hay ${videoCount}`)

console.log(
  'Catálogo válido: 13 ejercicios, 71 variantes, 145 imágenes, 19 vídeos y 25 niveles.',
)
