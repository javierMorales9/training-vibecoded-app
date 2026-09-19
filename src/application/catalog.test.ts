import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase } from '../infrastructure/db/database'
import { resetConfigForTests } from '../server/config'
import {
  CatalogCursorError,
  getCatalogHealth,
  getCatalogVariant,
  listCatalogVariants,
} from './catalog'

let testDirectory: string

const input = (overrides: Record<string, unknown> = {}) => ({
  q: '',
  exerciseTypes: [],
  difficultyMin: null,
  difficultyMax: null,
  cursor: null,
  limit: 24,
  ...overrides,
})

beforeAll(() => {
  testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'training-catalog-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_PATH = path.join(testDirectory, 'training.sqlite')
  resetConfigForTests()
  closeDatabase()
})

afterAll(() => {
  closeDatabase()
  fs.rmSync(testDirectory, { recursive: true, force: true })
})

describe('catalog', () => {
  it('migrates and seeds the exact source inventory', () => {
    expect(getCatalogHealth()).toEqual({
      variants: 71,
      images: 145,
      videos: 19,
      capabilityLevels: 25,
    })
  })

  it('walks every variant with a stable cursor and no duplicates', () => {
    const collected: string[] = []
    let cursor: string | null = null
    do {
      const result = listCatalogVariants(input({ cursor, limit: 17 }))
      collected.push(...result.items.map((variant) => variant.id))
      cursor = result.page.nextCursor
    } while (cursor)
    expect(collected).toHaveLength(71)
    expect(new Set(collected)).toHaveLength(71)
  })

  it('searches descriptions case-insensitively and combines filters', () => {
    const result = listCatalogVariants(
      input({
        q: 'SILLA',
        exerciseTypes: ['ABDOMINAL'],
        difficultyMax: 2,
        limit: 100,
      }),
    )
    expect(result.items.length).toBeGreaterThan(0)
    expect(
      result.items.every((variant) => variant.exerciseType === 'ABDOMINAL'),
    ).toBe(true)
    expect(
      result.items.every((variant) => (variant.difficultyMin ?? 99) <= 2),
    ).toBe(true)
  })

  it('returns an empty page for searches containing only punctuation', () => {
    expect(listCatalogVariants(input({ q: '---', limit: 100 })).items).toEqual(
      [],
    )
  })

  it('uses inclusive difficulty overlap and omits variants without levels', () => {
    const result = listCatalogVariants(
      input({ difficultyMin: 3, difficultyMax: 3, limit: 100 }),
    )
    expect(result.items.length).toBeGreaterThan(0)
    expect(
      result.items.every(
        (variant) =>
          variant.difficultyMin !== null &&
          variant.difficultyMax !== null &&
          variant.difficultyMin <= 3 &&
          variant.difficultyMax >= 3,
      ),
    ).toBe(true)
  })

  it('rejects a cursor reused with different filters', () => {
    const first = listCatalogVariants(input({ limit: 2 }))
    expect(first.page.nextCursor).not.toBeNull()
    expect(() =>
      listCatalogVariants(
        input({ q: 'flexión', cursor: first.page.nextCursor, limit: 2 }),
      ),
    ).toThrow(CatalogCursorError)
  })

  it('never exposes physical storage keys in catalog detail', () => {
    const first = listCatalogVariants(input({ limit: 1 })).items[0]
    const detail = getCatalogVariant(first.id, { api: true })
    expect(detail?.media.length).toBeGreaterThan(0)
    expect(JSON.stringify(detail)).not.toContain('storage_key')
    expect(
      detail?.media
        .filter((media) => media.kind === 'IMAGE')
        .every((media) => media.url.startsWith('/api/v1/media-assets/')),
    ).toBe(true)
  })
})
