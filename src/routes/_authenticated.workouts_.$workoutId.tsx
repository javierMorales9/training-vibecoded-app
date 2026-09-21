import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  ImageIcon,
  Plus,
  Save,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import type { WorkoutInputData } from '../contracts/workout'
import { workoutInputSchema } from '../contracts/workout'
import type {
  ExerciseSelection,
  TrainingMethod,
  WorkoutBlockInput,
  WorkoutBlockItemInput,
  WorkoutTarget,
} from '../domain/workout'
import { trainingMethodLabels } from '../domain/workout'
import { capabilities, capabilityLabels } from '../domain/assessment'
import type { Capability } from '../domain/assessment'
import {
  exerciseTypeLabels,
  exerciseTypes,
  normalizeCatalogSearch,
} from '../domain/catalog'
import { getWorkoutFn, updateWorkoutFn } from '../server/functions/workouts'
import { listCatalogVariantsFn } from '../server/functions/catalog'
import { ProtectedImage } from '../components/protected-image'
import { VariantModal } from '../components/variant-modal'

export const Route = createFileRoute('/_authenticated/workouts_/$workoutId')({
  loader: async ({ params }) => {
    const [workout, catalog] = await Promise.all([
      getWorkoutFn({ data: { workoutId: params.workoutId } }),
      listCatalogVariantsFn({
        data: {
          q: '',
          exerciseTypes: [],
          difficultyMin: null,
          difficultyMax: null,
          primaryProgression: null,
          cursor: null,
          limit: 100,
        },
      }),
    ])
    return { workout, catalog: catalog.items }
  },
  component: WorkoutEditorPage,
})

type CatalogOption = ReturnType<typeof Route.useLoaderData>['catalog'][number]
type EnrichedWorkout = {
  name: string
  notes: string | null
  blocks: Array<
    Omit<WorkoutBlockInput, 'items'> & {
      items: Array<WorkoutBlockItemInput & { display: unknown }>
    }
  >
}

const emptySelection = (): ExerciseSelection => ({
  kind: 'EXPLICIT_VARIANT',
  exerciseVariantId: null,
})

const defaultTarget = (): WorkoutTarget => ({
  unitIndex: null,
  label: 'Objetivo',
  metricKind: 'REPETITIONS',
  scope: 'TOTAL',
  minimumValue: 10,
  maximumValue: 10,
})

const emptyItem = (withTarget: boolean): WorkoutBlockItemInput => ({
  selection: emptySelection(),
  targets: withTarget ? [defaultTarget()] : [],
})

function createBlock(method: TrainingMethod): WorkoutBlockInput {
  const common = {
    name: null,
    instructions: null,
    afterBlockRestMs: 60000,
  }
  if (method === 'PYRAMID') {
    return {
      ...common,
      method,
      pyramidDurationMs: 420000,
      pyramidInitialReps: 1,
      pyramidRestMsPerRep: 1000,
      items: [emptyItem(false)],
    }
  }
  return {
    ...common,
    method,
    unitCount: 3,
    betweenUnitsRestMs: 60000,
    items:
      method === 'SUPERSET'
        ? [emptyItem(true), emptyItem(true)]
        : [emptyItem(true)],
  }
}

function editableInput(workout: EnrichedWorkout) {
  return workoutInputSchema.parse({
    name: workout.name,
    notes: workout.notes,
    blocks: workout.blocks.map((block) => ({
      ...block,
      items: block.items.map(({ display: _display, ...item }) => item),
    })),
  })
}

function nullableNumber(value: string, multiplier = 1) {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * multiplier) : null
}

function seconds(milliseconds: number | null) {
  return milliseconds === null ? '' : String(milliseconds / 1000)
}

function selectionName(selection: ExerciseSelection, catalog: CatalogOption[]) {
  if (selection.kind === 'CAPABILITY_RELATIVE') {
    if (!selection.capability || selection.levelOffset === null) return null
    const offset =
      selection.levelOffset === 0
        ? 'nivel actual'
        : `nivel actual ${selection.levelOffset > 0 ? '+' : '−'} 1`
    return `${capabilityLabels[selection.capability]} · ${offset}`
  }
  const variant = catalog.find(
    (candidate) => candidate.id === selection.exerciseVariantId,
  )
  if (!variant) return null
  return variant.name === variant.exerciseName
    ? variant.name
    : `${variant.exerciseName} · ${variant.name}`
}

function blockDisplayName(block: WorkoutBlockInput, catalog: CatalogOption[]) {
  const selections = block.items
    .map((item) => selectionName(item.selection, catalog))
    .filter((name): name is string => Boolean(name))
  return selections.length
    ? selections.join(' + ')
    : trainingMethodLabels[block.method]
}

function targetMode(item: WorkoutBlockItemInput) {
  return item.targets.some((target) => target.unitIndex !== null)
    ? 'PER_UNIT'
    : 'COMMON'
}

function commonTarget(item: WorkoutBlockItemInput) {
  return (
    item.targets.find((target) => target.unitIndex === null) ??
    item.targets[0] ??
    defaultTarget()
  )
}

function targetsForUnitCount(item: WorkoutBlockItemInput, unitCount: number) {
  const count = Math.max(1, unitCount)
  const fallback = commonTarget(item)
  return Array.from({ length: count }, (_, unitIndex) => {
    const current = item.targets.find(
      (target) => target.unitIndex === unitIndex,
    )
    return {
      ...(current ?? fallback),
      unitIndex,
      label: 'Objetivo',
    }
  })
}

function WorkoutEditorPage() {
  const loaderData = Route.useLoaderData()
  const { workoutId } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const update = useServerFn(updateWorkoutFn)
  const initial = loaderData.workout
  const [draft, setDraft] = useState<WorkoutInputData>(() =>
    initial
      ? editableInput(initial)
      : { name: 'Entrenamiento', notes: null, blocks: [] },
  )
  const [version, setVersion] = useState(initial?.version ?? 0)
  const [validation, setValidation] = useState(initial?.validation ?? null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!initial) {
    return (
      <div className="workout-editor-page editor-not-found">
        <h1>Entrenamiento no encontrado</h1>
        <Link to="/workouts" className="secondary-button">
          Volver a la cola
        </Link>
      </div>
    )
  }

  const changeDraft = (next: WorkoutInputData) => {
    setDraft(next)
    setDirty(true)
    setMessage(null)
  }
  const replaceBlock = (index: number, block: WorkoutBlockInput) => {
    const blocks = [...draft.blocks]
    blocks[index] = block
    changeDraft({ ...draft, blocks })
  }
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.blocks.length) return
    const blocks = [...draft.blocks]
    ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
    changeDraft({ ...draft, blocks })
  }
  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const saved = await update({
        data: { workoutId, version, workout: draft },
      })
      if (saved) {
        setVersion(saved.version)
        setValidation(saved.validation)
        setDraft(editableInput(saved))
        setDirty(false)
        setMessage('Entrenamiento guardado.')
        await router.invalidate()
      }
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? `No se pudo guardar: ${caught.message}`
          : 'No se pudo guardar. Puede que el entrenamiento haya cambiado.',
      )
    } finally {
      setSaving(false)
    }
  }

  const statusTitle = dirty
    ? 'Guarda para actualizar la validación.'
    : validation?.startable
      ? 'Listo para iniciar.'
      : validation?.issues.map((issue) => issue.message).join('\n') ||
        'El entrenamiento aún está incompleto.'

  return (
    <div className="workout-editor-page">
      <header className="editor-topbar">
        <button
          type="button"
          className="runner-back"
          onClick={() => {
            if (
              !dirty ||
              window.confirm('Hay cambios sin guardar. ¿Quieres salir?')
            )
              void navigate({ to: '/workouts' })
          }}
        >
          <ArrowLeft size={18} /> Cola
        </button>
        <div className="editor-save-state">
          {dirty ? 'Cambios sin guardar' : 'Todo guardado'}
        </div>
        <div className="editor-topbar-actions">
          <span
            className={
              !dirty && validation?.startable
                ? 'plan-status plan-status-ready'
                : 'plan-status plan-status-warning'
            }
            title={statusTitle}
            aria-label={statusTitle}
          >
            {!dirty && validation?.startable ? (
              <CheckCircle2 size={20} />
            ) : (
              <TriangleAlert size={20} />
            )}
          </span>
          <button
            type="button"
            className="primary-button"
            disabled={saving || !dirty}
            onClick={() => void save()}
          >
            <Save size={17} /> Guardar
          </button>
        </div>
      </header>

      <div className="workout-editor-layout">
        <main className="workout-form">
          <section className="workout-identity">
            <p className="eyebrow">Entrenamiento pendiente</p>
            <input
              className="workout-name-input"
              value={draft.name}
              maxLength={120}
              aria-label="Nombre del entrenamiento"
              onChange={(event) =>
                changeDraft({ ...draft, name: event.target.value })
              }
            />
            <textarea
              value={draft.notes ?? ''}
              maxLength={2000}
              rows={2}
              placeholder="Notas generales opcionales"
              aria-label="Notas generales"
              onChange={(event) =>
                changeDraft({
                  ...draft,
                  notes: event.target.value || null,
                })
              }
            />
          </section>

          <div className="blocks-heading">
            <div>
              <p className="eyebrow">Composición</p>
              <h2>Bloques</h2>
            </div>
            <div className="add-block-buttons">
              {(Object.keys(trainingMethodLabels) as TrainingMethod[]).map(
                (method) => (
                  <button
                    type="button"
                    key={method}
                    onClick={() =>
                      changeDraft({
                        ...draft,
                        blocks: [...draft.blocks, createBlock(method)],
                      })
                    }
                  >
                    <Plus size={15} /> {trainingMethodLabels[method]}
                  </button>
                ),
              )}
            </div>
          </div>

          {draft.blocks.length ? (
            <div className="workout-blocks">
              {draft.blocks.map((block, index) => (
                <Fragment key={index}>
                  <BlockEditor
                    block={block}
                    index={index}
                    total={draft.blocks.length}
                    catalog={loaderData.catalog}
                    onChange={(next) => replaceBlock(index, next)}
                    onMove={(direction) => moveBlock(index, direction)}
                    onDelete={() =>
                      changeDraft({
                        ...draft,
                        blocks: draft.blocks.filter(
                          (_candidate, candidateIndex) =>
                            candidateIndex !== index,
                        ),
                      })
                    }
                  />
                  {index < draft.blocks.length - 1 ? (
                    <BlockRestConnector
                      value={block.afterBlockRestMs}
                      onChange={(afterBlockRestMs) =>
                        replaceBlock(index, { ...block, afterBlockRestMs })
                      }
                    />
                  ) : null}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="empty-blocks">
              <Plus size={28} />
              <strong>Añade el primer bloque</strong>
              <span>Puedes guardar el entrenamiento mientras lo preparas.</span>
            </div>
          )}
          {message ? <p className="editor-message">{message}</p> : null}
        </main>
      </div>
    </div>
  )
}

function BlockEditor({
  block,
  index,
  total,
  catalog,
  onChange,
  onMove,
  onDelete,
}: {
  block: WorkoutBlockInput
  index: number
  total: number
  catalog: CatalogOption[]
  onChange: (block: WorkoutBlockInput) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const setItems = (items: WorkoutBlockItemInput[]) =>
    onChange({ ...block, items })
  const unitCount = block.method === 'PYRAMID' ? null : block.unitCount
  const changeUnitCount = (value: number | null) => {
    if (block.method === 'PYRAMID') return
    const items =
      value === null
        ? block.items
        : block.items.map((item) =>
            targetMode(item) === 'PER_UNIT'
              ? { ...item, targets: targetsForUnitCount(item, value) }
              : item,
          )
    onChange({ ...block, unitCount: value, items })
  }
  return (
    <article className="workout-block-card" data-collapsed={collapsed}>
      <header className="block-card-header">
        <button
          type="button"
          className="block-collapse-button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? 'Desplegar bloque' : 'Colapsar bloque'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <span className="block-number">{index + 1}</span>
        <div className="block-heading-copy">
          <select
            value={block.method}
            aria-label={`Metodología del bloque ${index + 1}`}
            onChange={(event) =>
              onChange(createBlock(event.target.value as TrainingMethod))
            }
          >
            {(Object.keys(trainingMethodLabels) as TrainingMethod[]).map(
              (method) => (
                <option key={method} value={method}>
                  {trainingMethodLabels[method]}
                </option>
              ),
            )}
          </select>
          <strong>{blockDisplayName(block, catalog)}</strong>
        </div>
        <div className="block-actions">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Subir bloque"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Bajar bloque"
          >
            <ArrowDown size={16} />
          </button>
          <button type="button" onClick={onDelete} aria-label="Eliminar bloque">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {!collapsed ? (
        <>
          {block.method === 'PYRAMID' ? (
            <div className="method-fields three-columns">
              <label>
                Duración total (min)
                <input
                  type="number"
                  min="1"
                  value={
                    block.pyramidDurationMs === null
                      ? ''
                      : block.pyramidDurationMs / 60000
                  }
                  onChange={(event) =>
                    onChange({
                      ...block,
                      pyramidDurationMs: nullableNumber(
                        event.target.value,
                        60000,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Repeticiones iniciales
                <input
                  type="number"
                  min="1"
                  value={block.pyramidInitialReps ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      pyramidInitialReps: nullableNumber(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Descanso por repetición (s)
                <select
                  value={seconds(block.pyramidRestMsPerRep)}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      pyramidRestMsPerRep: nullableNumber(
                        event.target.value,
                        1000,
                      ),
                    })
                  }
                >
                  <option value="1">1 segundo</option>
                  <option value="2">2 segundos</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="method-fields two-columns">
              <label>
                {block.method === 'SUPERSET' ? 'Supersets' : 'Series'}
                <input
                  type="number"
                  min="1"
                  value={block.unitCount ?? ''}
                  onChange={(event) =>
                    changeUnitCount(nullableNumber(event.target.value))
                  }
                />
              </label>
              <label>
                Descanso entre{' '}
                {block.method === 'SUPERSET' ? 'parejas' : 'series'} (s)
                <input
                  type="number"
                  min="0"
                  value={seconds(block.betweenUnitsRestMs)}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      betweenUnitsRestMs: nullableNumber(
                        event.target.value,
                        1000,
                      ),
                    })
                  }
                />
              </label>
            </div>
          )}

          <div className="block-items" data-method={block.method}>
            {block.items.map((item, itemIndex) => (
              <ExerciseItemEditor
                key={itemIndex}
                item={item}
                label={
                  block.method === 'SUPERSET'
                    ? `Ejercicio ${itemIndex + 1}`
                    : 'Ejercicio'
                }
                showTargets={block.method !== 'PYRAMID'}
                unitCount={unitCount}
                unitLabel={block.method === 'SUPERSET' ? 'Ronda' : 'Serie'}
                catalog={catalog}
                onChange={(next) => {
                  const items = [...block.items]
                  items[itemIndex] = next
                  setItems(items)
                }}
              />
            ))}
          </div>

          <label className="instructions-field">
            Instrucciones opcionales
            <textarea
              rows={2}
              value={block.instructions ?? ''}
              placeholder="Técnica, ritmo o recordatorios para este bloque"
              onChange={(event) =>
                onChange({
                  ...block,
                  instructions: event.target.value || null,
                })
              }
            />
          </label>
        </>
      ) : null}
    </article>
  )
}

function BlockRestConnector({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  const options = [0, 30000, 45000, 60000, 90000, 120000, 180000]
  const current = value ?? 0
  const values = options.includes(current)
    ? options
    : [...options, current].sort((left, right) => left - right)
  return (
    <div className="block-rest-connector">
      <span />
      <label>
        <Clock3 size={15} aria-hidden="true" />
        <span className="sr-only">Descanso entre bloques</span>
        <select
          value={current}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {values.map((milliseconds) => (
            <option key={milliseconds} value={milliseconds}>
              {milliseconds === 0
                ? 'Sin descanso'
                : `${milliseconds / 1000} s de descanso`}
            </option>
          ))}
        </select>
      </label>
      <span />
    </div>
  )
}

function ExerciseItemEditor({
  item,
  label,
  showTargets,
  unitCount,
  unitLabel,
  catalog,
  onChange,
}: {
  item: WorkoutBlockItemInput
  label: string
  showTargets: boolean
  unitCount: number | null
  unitLabel: 'Serie' | 'Ronda'
  catalog: CatalogOption[]
  onChange: (item: WorkoutBlockItemInput) => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [progression, setProgression] = useState<
    'ALL' | 'PRIMARY' | 'SUPPLEMENTARY'
  >('ALL')
  const [viewingVariantId, setViewingVariantId] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const normalized = normalizeCatalogSearch(query)
    return catalog.filter(
      (variant) =>
        (!type || variant.exerciseType === type) &&
        (!difficulty ||
          (variant.difficultyMin !== null &&
            variant.difficultyMax !== null &&
            variant.difficultyMin <= difficulty &&
            variant.difficultyMax >= difficulty)) &&
        (progression === 'ALL' ||
          variant.isPrimaryProgression === (progression === 'PRIMARY')) &&
        (!normalized ||
          normalizeCatalogSearch(
            `${variant.exerciseName} ${variant.name} ${variant.exerciseTypeLabel} ${variant.bodyGroup}`,
          ).includes(normalized)),
    )
  }, [catalog, difficulty, progression, query, type])

  const selection = item.selection
  const selectedVariantId =
    selection.kind === 'EXPLICIT_VARIANT' ? selection.exerciseVariantId : null
  const selectedVariant = catalog.find(
    (variant) => variant.id === selectedVariantId,
  )
  const selectedName = selectionName(selection, catalog)

  return (
    <section className="exercise-item-editor">
      <div className="item-heading">
        <div className="item-heading-copy">
          <strong>{label}</strong>
          <span>{selectedName ?? 'Sin ejercicio seleccionado'}</span>
        </div>
      </div>

      {!selectedVariant ? (
        <div className="selection-tabs">
          <button
            type="button"
            data-active={selection.kind === 'EXPLICIT_VARIANT'}
            onClick={() => onChange({ ...item, selection: emptySelection() })}
          >
            Variante concreta
          </button>
          <button
            type="button"
            data-active={selection.kind === 'CAPABILITY_RELATIVE'}
            onClick={() =>
              onChange({
                ...item,
                selection: {
                  kind: 'CAPABILITY_RELATIVE',
                  capability: 'PUSH_UP',
                  levelOffset: 0,
                },
              })
            }
          >
            Según evaluación
          </button>
        </div>
      ) : null}

      {selection.kind === 'EXPLICIT_VARIANT' ? (
        selectedVariant ? (
          <div className="selected-variant">
            <PickerThumbnail variant={selectedVariant} />
            <div className="selected-variant-copy">
              <small>{selectedVariant.exerciseTypeLabel}</small>
              <strong>{selectedVariant.name}</strong>
              <span>{selectedVariant.exerciseName}</span>
            </div>
            <div className="selected-variant-actions">
              <button
                type="button"
                onClick={() => setViewingVariantId(selectedVariant.id)}
              >
                <Eye size={15} /> Ver detalle
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...item, selection: emptySelection() })
                }
              >
                <X size={15} /> Deseleccionar
              </button>
            </div>
          </div>
        ) : (
          <div className="variant-browser">
            <label className="search-field variant-browser-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Buscar variante para {label}</span>
              <input
                type="search"
                value={query}
                placeholder="Buscar por nombre o ejercicio…"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Borrar búsqueda"
                >
                  <X size={15} />
                </button>
              ) : null}
            </label>

            <div
              className="variant-browser-types"
              aria-label="Tipo de ejercicio"
            >
              <button
                type="button"
                data-active={!type}
                onClick={() => setType('')}
              >
                Todos
              </button>
              {exerciseTypes.map((exerciseType) => (
                <button
                  key={exerciseType}
                  type="button"
                  data-active={type === exerciseType}
                  onClick={() => setType(exerciseType)}
                >
                  {exerciseTypeLabels[exerciseType]}
                </button>
              ))}
            </div>

            <div className="variant-browser-refinements">
              <div className="variant-browser-filter-group">
                <span>Nivel</span>
                <div aria-label="Nivel de dificultad">
                  <button
                    type="button"
                    data-active={difficulty === null}
                    onClick={() => setDifficulty(null)}
                  >
                    Todos
                  </button>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      data-active={difficulty === level}
                      onClick={() => setDifficulty(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div className="variant-browser-filter-group">
                <span>Progresión</span>
                <div aria-label="Pertenencia a la progresión principal">
                  <button
                    type="button"
                    data-active={progression === 'ALL'}
                    onClick={() => setProgression('ALL')}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    data-active={progression === 'PRIMARY'}
                    onClick={() => setProgression('PRIMARY')}
                  >
                    Principal
                  </button>
                  <button
                    type="button"
                    data-active={progression === 'SUPPLEMENTARY'}
                    onClick={() => setProgression('SUPPLEMENTARY')}
                  >
                    Complementarias
                  </button>
                </div>
              </div>
            </div>

            <div className="variant-browser-result" aria-live="polite">
              {filtered.length} variante{filtered.length === 1 ? '' : 's'}
            </div>

            {filtered.length ? (
              <div
                className="variant-choice-strip"
                aria-label={`Variantes para ${label}`}
              >
                {filtered.map((variant) => {
                  const selected = selectedVariantId === variant.id
                  return (
                    <article
                      className="variant-choice"
                      data-selected={selected}
                      data-variant-id={variant.id}
                      key={variant.id}
                    >
                      <button
                        type="button"
                        className="variant-choice-select"
                        aria-pressed={selected}
                        onClick={() =>
                          onChange({
                            ...item,
                            selection: {
                              kind: 'EXPLICIT_VARIANT',
                              exerciseVariantId: variant.id,
                            },
                          })
                        }
                      >
                        <PickerThumbnail variant={variant} />
                        {selected ? (
                          <span className="variant-choice-selected">
                            <CheckCircle2 size={15} aria-hidden="true" />
                          </span>
                        ) : null}
                        <span className="variant-choice-copy">
                          <small>{variant.exerciseTypeLabel}</small>
                          <strong>{variant.name}</strong>
                          <span>{variant.exerciseName}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="variant-choice-view"
                        onClick={() => setViewingVariantId(variant.id)}
                        aria-label={`Ver detalle de ${variant.name}`}
                      >
                        <Eye size={13} /> Ver
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="variant-browser-empty">
                <Search size={20} />
                <span>No hay variantes con estos filtros.</span>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="relative-picker two-columns">
          <label>
            Capacidad
            <select
              value={selection.capability ?? ''}
              onChange={(event) =>
                onChange({
                  ...item,
                  selection: {
                    ...selection,
                    capability: (event.target.value ||
                      null) as Capability | null,
                  },
                })
              }
            >
              {capabilities.map((capability) => (
                <option value={capability} key={capability}>
                  {capabilityLabels[capability]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nivel
            <select
              value={selection.levelOffset ?? ''}
              onChange={(event) =>
                onChange({
                  ...item,
                  selection: {
                    ...selection,
                    levelOffset:
                      event.target.value === ''
                        ? null
                        : (Number(event.target.value) as -1 | 0 | 1),
                  },
                })
              }
            >
              <option value={-1}>Nivel actual − 1</option>
              <option value={0}>Nivel actual</option>
              <option value={1}>Nivel actual + 1</option>
            </select>
          </label>
        </div>
      )}

      {showTargets ? (
        <TargetEditor
          item={item}
          unitCount={unitCount}
          unitLabel={unitLabel}
          onChange={onChange}
        />
      ) : null}
      {viewingVariantId ? (
        <VariantModal
          variantId={viewingVariantId}
          onClose={() => setViewingVariantId(null)}
        />
      ) : null}
    </section>
  )
}

function TargetEditor({
  item,
  unitCount,
  unitLabel,
  onChange,
}: {
  item: WorkoutBlockItemInput
  unitCount: number | null
  unitLabel: 'Serie' | 'Ronda'
  onChange: (item: WorkoutBlockItemInput) => void
}) {
  const mode = targetMode(item)
  const targets =
    mode === 'COMMON'
      ? [{ ...commonTarget(item), unitIndex: null }]
      : [...item.targets].sort(
          (left, right) => (left.unitIndex ?? 0) - (right.unitIndex ?? 0),
        )

  return (
    <div className="target-list">
      <div className="target-heading">
        <div>
          <span>Objetivo</span>
          <small>
            {mode === 'COMMON'
              ? `Se aplica a todas las ${unitLabel.toLocaleLowerCase('es')}s.`
              : `Un objetivo distinto por ${unitLabel.toLocaleLowerCase('es')}.`}
          </small>
        </div>
        {mode === 'COMMON' ? (
          <button
            type="button"
            disabled={!unitCount || unitCount < 1}
            title={
              unitCount
                ? undefined
                : `Indica primero cuántas ${unitLabel.toLocaleLowerCase('es')}s hay.`
            }
            onClick={() =>
              onChange({
                ...item,
                targets: targetsForUnitCount(item, unitCount ?? 1),
              })
            }
          >
            Personalizar por {unitLabel.toLocaleLowerCase('es')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...item,
                targets: [
                  {
                    ...commonTarget(item),
                    unitIndex: null,
                    label: 'Objetivo',
                  },
                ],
              })
            }
          >
            Usar un objetivo común
          </button>
        )}
      </div>
      <div className="target-units">
        {targets.map((target, targetIndex) => (
          <TargetFields
            key={target.unitIndex ?? 'common'}
            target={target}
            title={
              target.unitIndex === null
                ? `Todas las ${unitLabel.toLocaleLowerCase('es')}s`
                : `${unitLabel} ${target.unitIndex + 1}`
            }
            onChange={(next) => {
              const nextTargets = [...targets]
              nextTargets[targetIndex] = next
              onChange({ ...item, targets: nextTargets })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TargetFields({
  target,
  title,
  onChange,
}: {
  target: WorkoutTarget
  title: string
  onChange: (target: WorkoutTarget) => void
}) {
  const multiplier = target.metricKind === 'DURATION' ? 1000 : 1
  return (
    <div className="target-unit">
      <strong>{title}</strong>
      <div className="target-fields">
        <select
          value={target.metricKind}
          aria-label={`Tipo de objetivo para ${title}`}
          onChange={(event) => {
            const metricKind = event.target.value as WorkoutTarget['metricKind']
            const conversion = metricKind === 'DURATION' ? 1000 : 0.001
            onChange({
              ...target,
              metricKind,
              minimumValue: Math.max(
                1,
                Math.round(target.minimumValue * conversion),
              ),
              maximumValue: Math.max(
                1,
                Math.round(target.maximumValue * conversion),
              ),
            })
          }}
        >
          <option value="REPETITIONS">Repeticiones</option>
          <option value="DURATION">Duración</option>
        </select>
        <select
          value={target.scope}
          aria-label={`Ámbito del objetivo para ${title}`}
          onChange={(event) =>
            onChange({
              ...target,
              scope: event.target.value as WorkoutTarget['scope'],
            })
          }
        >
          <option value="TOTAL">Total</option>
          <option value="PER_SIDE">Por lado</option>
          <option value="PER_HAND">Por mano</option>
          <option value="PER_LEG">Por pierna</option>
        </select>
        <label>
          Mín. {target.metricKind === 'DURATION' ? '(s)' : ''}
          <input
            type="number"
            min="1"
            value={target.minimumValue / multiplier}
            onChange={(event) =>
              onChange({
                ...target,
                minimumValue:
                  nullableNumber(event.target.value, multiplier) ?? 1,
              })
            }
          />
        </label>
        <label>
          Máx. {target.metricKind === 'DURATION' ? '(s)' : ''}
          <input
            type="number"
            min="1"
            value={target.maximumValue / multiplier}
            onChange={(event) =>
              onChange({
                ...target,
                maximumValue:
                  nullableNumber(event.target.value, multiplier) ?? 1,
              })
            }
          />
        </label>
      </div>
    </div>
  )
}

function PickerThumbnail({ variant }: { variant: CatalogOption }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = containerRef.current
    if (!target || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '240px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [visible])

  return (
    <span ref={containerRef} className="variant-choice-media">
      {visible && variant.cover ? (
        <ProtectedImage
          src={variant.cover.url}
          alt={variant.cover.altText}
          loading="lazy"
        />
      ) : (
        <ImageIcon aria-hidden="true" />
      )}
    </span>
  )
}
