import { describe, it, expect } from 'vitest'
import {
  emptyFood, hasGoals, goalsOf, clampGoals,
  entriesOf, dayTotals, ringPct, macroPct,
  clampEntry, addEntry, removeEntry, updateEntry,
  parseEstimate
} from './nutrition.js'

const F = (over = {}) => ({
  goals: { kcal: 2000, p: 150, c: 200, f: 70 },
  day: {},
  ...over
})

describe('goals', () => {
  it('reports absent when null or empty', () => {
    expect(hasGoals(null)).toBe(false)
    expect(hasGoals({ goals: { kcal: 0, p: 0, c: 0, f: 0 }, day: {} })).toBe(false)
  })
  it('detects when any goal is set', () => {
    expect(hasGoals(F())).toBe(true)
    expect(hasGoals({ goals: { kcal: 1800, p: 0, c: 0, f: 0 }, day: {} })).toBe(true)
    expect(goalsOf(F())).not.toBeNull()
    expect(goalsOf({ goals: { kcal: 0, p: 0, c: 0, f: 0 }, day: {} })).toBe(null)
  })
  it('clamps goals to sane bounds and drops negatives', () => {
    expect(clampGoals({ kcal: -5, p: 199999, c: '200', f: 3.7 })).toEqual({ kcal: 0, p: 99999, c: 200, f: 4 })
  })
})

describe('daily totals', () => {
  it('adds across entries', () => {
    const f = F({ day: { '2026-01-01': [
      { kcal: 300, p: 20, c: 30, f: 10, source: 'manual' },
      { kcal: 500, p: 40, c: 50, f: 15, source: 'manual' }
    ] } })
    expect(dayTotals(f, '2026-01-01')).toEqual({ kcal: 800, p: 60, c: 80, f: 25 })
  })
  it('is zero for an empty or missing day', () => {
    expect(dayTotals(F(), '2026-01-02')).toEqual({ kcal: 0, p: 0, c: 0, f: 0 })
  })
})

describe('ring / macro progress', () => {
  const f = F({ day: { '2026-01-01': [
    { kcal: 1000, p: 75, c: 100, f: 35, source: 'manual' }
  ] } })
  it('is proportional to calories', () => expect(ringPct(f, '2026-01-01')).toBeCloseTo(0.5))
  it('caps slightly over 1 so overage reads without wrapping', () => {
    const over = F({ goals: { kcal: 1000, p: 0, c: 0, f: 0 }, day: { '2026-01-01': [{ kcal: 3000, source: 'manual' }] } })
    expect(ringPct(over, '2026-01-01')).toBe(1.12)
  })
  it('returns 0 when there is no calorie goal', () => {
    expect(ringPct(F({ goals: { kcal: 0, p: 0, c: 0, f: 0 } }), '2026-01-01')).toBe(0)
  })
  it('macro pct is capped at 1 and defaults to full when no goal set', () => {
    expect(macroPct(f, '2026-01-01', 'p')).toBe(0.5)
    const noGoal = F({ goals: { kcal: 2000, p: 0, c: 0, f: 0 }, day: { '2026-01-01': [{ p: 5, source: 'manual' }] } })
    expect(macroPct(noGoal, '2026-01-01', 'p')).toBe(1)
  })
})

describe('clampEntry', () => {
  it('keeps numbers non-negative and finite, defaults a garbage name', () => {
    const e = clampEntry({ name: '  Breakfast  ', g: -3, kcal: NaN, p: Infinity, c: '40', f: null, source: 'ai' })
    expect(e.name).toBe('Breakfast')
    expect(e.g).toBe(0)
    expect(e.kcal).toBe(0)
    expect(e.p).toBe(0)
    expect(e.c).toBe(40)
    expect(e.f).toBe(0)
    expect(e.source).toBe('ai')
  })
  it('rejects an unknown source', () => {
    expect(clampEntry({ source: 'teleport' }).source).toBe('manual')
  })
  it('drops a falsy per100', () => {
    expect(clampEntry({ per100: null, source: 'manual' }).per100).toBe(null)
  })
})

describe('add / remove / update', () => {
  it('adds with generated id and timestamps', () => {
    const f = emptyFood()
    addEntry(f, '2026-01-01', { name: 'A', kcal: 100, p: 5, c: 10, f: 3, source: 'manual' })
    const day = f.day['2026-01-01']
    expect(day).toHaveLength(1)
    expect(day[0].id).toBeTruthy()
    expect(day[0].t).toBeTruthy()
    expect(day[0].kcal).toBe(100)
  })
  it('caps the day at ENTRY_MAX, evicting the oldest', () => {
    const f = emptyFood()
    for (let i = 0; i < 85; i++) addEntry(f, '2026-01-01', { name: 'x' + i, kcal: i, source: 'manual' })
    expect(f.day['2026-01-01']).toHaveLength(80)
    expect(f.day['2026-01-01'].every(e => +e.name.slice(1) !== 0)).toBe(true)
  })
  it('removes by id', () => {
    const f = emptyFood()
    addEntry(f, '2026-01-01', { name: 'A', source: 'manual' })
    addEntry(f, '2026-01-01', { name: 'B', source: 'manual' })
    const id = f.day['2026-01-01'][0].id
    removeEntry(f, '2026-01-01', id)
    expect(f.day['2026-01-01'].map(e => e.name)).toEqual(['B'])
  })
  it('rescales per-100g totals when grams are edited', () => {
    const f = emptyFood()
    addEntry(f, '2026-01-01', { name: 'Oats', g: 100, kcal: 380, p: 13, c: 67, f: 7, per100: { kcal: 380, p: 13, c: 67, f: 7 }, source: 'off' })
    const id = f.day['2026-01-01'][0].id
    updateEntry(f, '2026-01-01', id, { g: 50 })
    const e = f.day['2026-01-01'][0]
    expect(e.g).toBe(50)
    expect(e.kcal).toBe(190)
    expect(e.p).toBe(7)
  })
})

describe('parseEstimate', () => {
  it('accepts fenced JSON', () => {
    const e = parseEstimate('```json\n{"nazwa":"Jajecznica","g":150,"kcal":210,"bialko":14,"weglowodany":3,"tluszcze":16}\n```')
    expect(e.name).toBe('Jajecznica')
    expect(e.kcal).toBe(210)
    expect(e.source).toBe('ai')
  })
  it('accepts a bare object with leading prose', () => {
    const e = parseEstimate('Sure: {"name":"Rice","grams":200,"energy":260,"protein":5,"carbs":57,"fat":0.5}')
    expect(e.name).toBe('Rice')
    expect(e.g).toBe(200)
    expect(e.c).toBe(57)
  })
  it('derives portion totals from a per100 basis and grams', () => {
    const e = parseEstimate('{"name":"Pasta","g":100,"per100":{"kcal":350,"p":12,"c":70,"f":2}}')
    expect(e.kcal).toBe(350)
    expect(e.p).toBe(12)
  })
  it('uses gramsHint when the model reports no weight', () => {
    const e = parseEstimate('{"name":"Soup","kcal":120,"p":6,"c":14,"f":4}', 250)
    expect(e.g).toBe(250)
  })
  it('quietly scales macros when kcal is inconsistent with macros', () => {
    const e = parseEstimate('{"name":"X","g":100,"kcal":100,"p":10,"c":50,"f":1}')
    expect(Math.abs((e.p * 4 + e.c * 4 + e.f * 9) - e.kcal)).toBeLessThanOrEqual(10)
  })
  it('throws on garbage', () => {
    expect(() => parseEstimate('no json here')).toThrow()
  })
})
