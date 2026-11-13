import { describe, expect, it } from 'vitest'
import {
  HISTORY_LIMIT, commitTo, current, emptyPlan, initialHistory, redoIn, undoIn,
} from './plan.ts'
import type { Plan } from './plan.ts'

/** A plan distinguishable by its single allocated id. */
const p = (n: number): Plan => ({ allocated: new Set([n]), variants: {} })
const idOf = (plan: Plan) => [...plan.allocated][0]

describe('undo history', () => {
  it('shows the state that was just committed', () => {
    let h = initialHistory()
    h = commitTo(h, p(1))
    expect(idOf(current(h))).toBe(1)
    h = commitTo(h, p(2))
    expect(idOf(current(h))).toBe(2)
  })

  it('still shows the newest state past the history limit', () => {
    // Regression: the slice used to keep HISTORY_LIMIT entries instead of
    // LIMIT - 1, so the array grew to LIMIT + 1 while the cursor clamped one
    // short. From the 100th commit the UI froze on a stale plan while Redo lit
    // up, and clicking nodes appeared to do nothing.
    let h = initialHistory()
    for (let i = 1; i <= HISTORY_LIMIT + 25; i++) {
      h = commitTo(h, p(i))
      expect(idOf(current(h))).toBe(i)
    }
  })

  it('never grows past the limit', () => {
    let h = initialHistory()
    for (let i = 1; i <= HISTORY_LIMIT * 2; i++) {
      h = commitTo(h, p(i))
      expect(h.entries.length).toBeLessThanOrEqual(HISTORY_LIMIT)
      expect(h.cursor).toBeLessThan(h.entries.length)
    }
  })

  it('has nothing to redo right after a commit, even past the limit', () => {
    let h = initialHistory()
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = commitTo(h, p(i))
    expect(h.cursor).toBe(h.entries.length - 1)
  })

  it('walks back and forward', () => {
    let h = initialHistory()
    for (const n of [1, 2, 3]) h = commitTo(h, p(n))
    h = undoIn(h)
    expect(idOf(current(h))).toBe(2)
    h = undoIn(h)
    expect(idOf(current(h))).toBe(1)
    h = redoIn(h)
    expect(idOf(current(h))).toBe(2)
  })

  it('stops at both ends rather than running off', () => {
    let h = initialHistory()
    h = commitTo(h, p(1))
    h = undoIn(undoIn(undoIn(h)))
    expect(h.cursor).toBe(0)
    h = redoIn(redoIn(redoIn(h)))
    expect(h.cursor).toBe(h.entries.length - 1)
  })

  it('discards the redo branch when you commit after undoing', () => {
    let h = initialHistory()
    for (const n of [1, 2, 3]) h = commitTo(h, p(n))
    h = undoIn(undoIn(h))        // back to 1
    h = commitTo(h, p(9))
    expect(idOf(current(h))).toBe(9)
    expect(h.cursor).toBe(h.entries.length - 1)
    h = undoIn(h)
    expect(idOf(current(h))).toBe(1) // 2 and 3 are gone
  })

  it('an empty plan is the starting point', () => {
    expect(current(initialHistory()).allocated.size).toBe(0)
    expect(emptyPlan().variants).toEqual({})
  })
})
