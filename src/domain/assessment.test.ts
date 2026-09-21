import { describe, expect, it } from 'vitest'
import { calculateStartingLevel, nextLevelAfterResult } from './assessment'

describe('assessment domain rules', () => {
  it('starts one level below the previous maximum within the 1-5 range', () => {
    expect(calculateStartingLevel(null)).toBe(1)
    expect(calculateStartingLevel(1)).toBe(1)
    expect(calculateStartingLevel(3)).toBe(2)
    expect(calculateStartingLevel(5)).toBe(4)
  })

  it('advances only after a pass below level five', () => {
    expect(nextLevelAfterResult(2, 'PASSED')).toBe(3)
    expect(nextLevelAfterResult(2, 'FAILED')).toBeNull()
    expect(nextLevelAfterResult(5, 'PASSED')).toBeNull()
  })
})
