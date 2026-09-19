import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

type ExerciseType =
  'PUSH_UP' | 'VERTICAL_PUSH' | 'PULL_UP' | 'SQUAT' | 'ABDOMINAL' | 'FULL_BODY'

type Capability = Exclude<ExerciseType, 'FULL_BODY'>

interface SourceExercise {
  name: string
  exerciseType: ExerciseType
  bodyGroup: string
  pageStart: number
  pageEnd: number
  sharedImages: string[]
  variants: SourceVariant[]
}

interface SourceVariant {
  heading: string
  name: string
  slug: string
  difficultyMin: number | null
  difficultyMax: number | null
  description: string
  images: string[]
  videos: string[]
}

const root = process.cwd()
const sourcePath = path.join(
  root,
  'Desencadenado-Entrenos con peso corporal',
  'exercises.md',
)
const outputPath = path.join(root, 'seed', 'catalog.json')

const exerciseTypes: Record<string, ExerciseType> = {
  Flexión: 'PUSH_UP',
  'Flexión vertical': 'VERTICAL_PUSH',
  Dominada: 'PULL_UP',
  Sentadilla: 'SQUAT',
  Abdominales: 'ABDOMINAL',
  Burpees: 'FULL_BODY',
  Escaladores: 'FULL_BODY',
  'Escaladores inversos': 'FULL_BODY',
  'Jumping Jacks': 'FULL_BODY',
  'Flexión a Plancha': 'FULL_BODY',
  'Levantamiento con impulso': 'FULL_BODY',
  'Levantamientos de rodillas': 'FULL_BODY',
  Esprintar: 'FULL_BODY',
}

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”‘’'"()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function stableUuidV7(key: string) {
  const bytes = createHash('sha256')
    .update(`desencadenado:${key}`)
    .digest()
    .subarray(0, 16)
  const baseTimestamp = 1_767_225_600_000
  const offset = bytes.readUInt32BE(0) % (365 * 24 * 60 * 60 * 1000)
  const timestamp = baseTimestamp + offset
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff
  bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff
  bytes[5] = timestamp & 0xff
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function parseDifficulty(value: string | undefined) {
  if (!value || value.includes('No especificado')) {
    return { min: null, max: null }
  }
  const numbers = [...value.matchAll(/\d+/g)].map((match) => Number(match[0]))
  return { min: numbers[0] ?? null, max: numbers[1] ?? numbers[0] ?? null }
}

function parsePages(value: string | undefined) {
  const numbers = [...(value ?? '').matchAll(/\d+/g)].map((match) =>
    Number(match[0]),
  )
  return { start: numbers[0] ?? 0, end: numbers[1] ?? numbers[0] ?? 0 }
}

function extractField(block: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return block
    .match(new RegExp(`^- \\*\\*${escaped}:\\*\\*\\s*(.+)$`, 'm'))?.[1]
    ?.trim()
}

function extractMedia(block: string, kind: 'images' | 'videos') {
  if (kind === 'images') {
    return [...block.matchAll(/^- `files\/([^`]+)`$/gm)].map(
      (match) => match[1],
    )
  }
  return [...block.matchAll(/^- (https?:\/\/\S+)$/gm)].map((match) =>
    match[1].trim(),
  )
}

function extractDescription(block: string) {
  const marker = '**Descripción**'
  const start = block.indexOf(marker)
  if (start < 0) return ''
  const body = block.slice(start + marker.length)
  const endMarkers = ['\n**Imágenes**', '\n**Vídeos**']
    .map((candidate) => body.indexOf(candidate))
    .filter((index) => index >= 0)
  const end = endMarkers.length ? Math.min(...endMarkers) : body.length
  return body
    .slice(0, end)
    .trim()
    .replace(/\n{3,}/g, '\n\n')
}

function displayVariantName(exerciseName: string, heading: string) {
  if (heading === 'Ejecución estándar') return exerciseName
  const name = heading.replace(/^Nivel \d+\s*-\s*/i, '').trim()
  return `${name.charAt(0).toLocaleUpperCase('es')}${name.slice(1)}`
}

function parseExercises(markdown: string): SourceExercise[] {
  const headings = [...markdown.matchAll(/^## (.+)$/gm)]
  const exercises: SourceExercise[] = []

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const name = heading[1].trim()
    const exerciseType = exerciseTypes[name]
    if (!exerciseType) continue

    const start = heading.index ?? 0
    const end = headings[index + 1]?.index ?? markdown.length
    const block = markdown.slice(start, end)
    const variantsMarker = block.indexOf('### Variantes')
    if (variantsMarker < 0)
      throw new Error(`No se encontró la sección Variantes de ${name}`)

    const metaBlock = block.slice(0, variantsMarker)
    const bodyGroup = extractField(metaBlock, 'Grupo corporal')
    const pages = parsePages(extractField(metaBlock, 'Páginas del libro'))
    if (!bodyGroup || !pages.start)
      throw new Error(`Metadatos incompletos en ${name}`)

    const variantsBlock = block.slice(variantsMarker)
    const variantHeadings = [...variantsBlock.matchAll(/^#### (.+)$/gm)]
    const variants: SourceVariant[] = variantHeadings.map(
      (variantHeading, variantIndex) => {
        const variantStart = variantHeading.index ?? 0
        const variantEnd =
          variantHeadings[variantIndex + 1]?.index ?? variantsBlock.length
        const variantBlock = variantsBlock.slice(variantStart, variantEnd)
        const headingText = variantHeading[1].trim()
        const difficulty = parseDifficulty(
          extractField(variantBlock, 'Nivel de dificultad'),
        )
        const displayName = displayVariantName(name, headingText)
        const baseSlug =
          headingText === 'Ejecución estándar'
            ? slugify(name)
            : `${slugify(name)}-${slugify(displayName)}`

        return {
          heading: headingText,
          name: displayName,
          slug: baseSlug,
          difficultyMin: difficulty.min,
          difficultyMax: difficulty.max,
          description: extractDescription(variantBlock),
          images: extractMedia(variantBlock, 'images'),
          videos: extractMedia(variantBlock, 'videos'),
        }
      },
    )

    exercises.push({
      name,
      exerciseType,
      bodyGroup,
      pageStart: pages.start,
      pageEnd: pages.end,
      sharedImages: extractMedia(metaBlock, 'images'),
      variants,
    })
  }

  return exercises
}

function requirementFor(
  capability: Capability,
  level: number,
  description: string,
) {
  const criterion = description
    .match(/Hombres:\s*(.*?)\s*Mujeres:/s)?.[1]
    ?.trim()
  if (!criterion)
    throw new Error(
      `Falta criterio masculino para ${capability} nivel ${level}`,
    )

  if (capability === 'PULL_UP' && level === 1) {
    return {
      criterionText: criterion,
      requirements: [
        {
          label: 'Colgado con brazos estirados y hombros tensos',
          metricKind: 'DURATION',
          scope: 'TOTAL',
          requiredValue: 45_000,
        },
        {
          label: 'Colgado con brazos flexionados y barbilla sobre la barra',
          metricKind: 'DURATION',
          scope: 'TOTAL',
          requiredValue: 20_000,
        },
      ],
    }
  }

  const firstNumber = Number(criterion.match(/\d+/)?.[0])
  if (!firstNumber)
    throw new Error(`No se pudo interpretar el criterio: ${criterion}`)
  const isDuration = /segundo/i.test(criterion)
  const scope = /cada mano/i.test(criterion)
    ? 'PER_HAND'
    : /cada pierna/i.test(criterion)
      ? 'PER_LEG'
      : 'TOTAL'

  return {
    criterionText: criterion,
    requirements: [
      {
        label: criterion.replace(/\.$/, ''),
        metricKind: isDuration ? 'DURATION' : 'REPETITIONS',
        scope,
        requiredValue: isDuration ? firstNumber * 1000 : firstNumber,
      },
    ],
  }
}

const markdown = await readFile(sourcePath, 'utf8')
const exercises = parseExercises(markdown)
const variants = exercises.flatMap((exercise) =>
  exercise.variants.map((variant, variantIndex) => {
    const id = stableUuidV7(`variant:${variant.slug}`)
    const sharedImages = variantIndex === 0 ? exercise.sharedImages : []
    const images = [...sharedImages, ...variant.images]
    const media = [
      ...images.map((storageKey, position) => ({
        id: stableUuidV7(`media:image:${storageKey}`),
        position,
        kind: 'IMAGE',
        storageKind: 'LOCAL',
        storageKey,
        externalUrl: null,
        mimeType: 'image/png',
        altText: `${exercise.name} — ${variant.name} (${position + 1})`,
      })),
      ...variant.videos.map((externalUrl, videoIndex) => ({
        id: stableUuidV7(`media:video:${externalUrl}`),
        position: images.length + videoIndex,
        kind: 'VIDEO',
        storageKind: 'EXTERNAL_URL',
        storageKey: null,
        externalUrl: externalUrl.replace('http://', 'https://'),
        mimeType: 'text/html',
        altText: `Vídeo de ${exercise.name} — ${variant.name}`,
      })),
    ]

    return {
      id,
      slug: variant.slug,
      name: variant.name,
      exerciseName: exercise.name,
      exerciseType: exercise.exerciseType,
      bodyGroup: exercise.bodyGroup,
      difficultyMin: variant.difficultyMin,
      difficultyMax: variant.difficultyMax,
      description: variant.description,
      sourcePageStart: exercise.pageStart,
      sourcePageEnd: exercise.pageEnd,
      media,
    }
  }),
)

const capabilityDefinitions = exercises
  .filter(
    (exercise): exercise is SourceExercise & { exerciseType: Capability } =>
      exercise.exerciseType !== 'FULL_BODY',
  )
  .flatMap((exercise) =>
    exercise.variants.slice(0, 5).map((variant, index) => {
      const level = index + 1
      const parsed = requirementFor(
        exercise.exerciseType,
        level,
        variant.description,
      )
      return {
        id: stableUuidV7(`capability:${exercise.exerciseType}:${level}`),
        capability: exercise.exerciseType,
        level,
        exerciseVariantId: stableUuidV7(`variant:${variant.slug}`),
        instructions: parsed.criterionText,
        requirements: parsed.requirements.map(
          (requirement, requirementIndex) => ({
            id: stableUuidV7(
              `requirement:${exercise.exerciseType}:${level}:${requirementIndex}`,
            ),
            position: requirementIndex,
            ...requirement,
          }),
        ),
      }
    }),
  )

const output = {
  version: 1,
  generatedFrom: 'Desencadenado-Entrenos con peso corporal/exercises.md',
  exercises: exercises.map(
    ({ name, exerciseType, bodyGroup, pageStart, pageEnd }) => ({
      name,
      exerciseType,
      bodyGroup,
      pageStart,
      pageEnd,
    }),
  ),
  variants,
  capabilityDefinitions,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const imageCount = variants
  .flatMap((variant) => variant.media)
  .filter((media) => media.kind === 'IMAGE').length
const videoCount = variants
  .flatMap((variant) => variant.media)
  .filter((media) => media.kind === 'VIDEO').length
console.log(
  `Catálogo generado: ${exercises.length} ejercicios, ${variants.length} variantes, ${imageCount} imágenes, ${videoCount} vídeos y ${capabilityDefinitions.length} niveles.`,
)
