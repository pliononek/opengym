import { describe, it, expect } from 'vitest'
import {
  emptyFood, hasGoals, goalsOf, clampGoals,
  entriesOf, dayTotals, ringPct, macroPct,
  clampEntry, addEntry, removeEntry, updateEntry,
  favoritesOf, addFavorite, removeFavorite, updateFavorite, touchFavorite, isFavorite, getFavoriteMatch,
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

describe('favorites', () => {
  it('adds a favorite and computes per100 when missing', () => {
    const f = emptyFood()
    const fav = addFavorite(f, { name: 'Eggs & toast', g: 200, kcal: 400, p: 20, c: 40, f: 16, source: 'manual' })
    expect(favoritesOf(f)).toHaveLength(1)
    expect(fav.id).toBeTruthy()
    expect(fav.name).toBe('Eggs & toast')
    expect(fav.per100).toEqual({ kcal: 200, p: 10, c: 20, f: 8 })
    expect(fav.createdAt).toBeTruthy()
    expect(fav.lastUsedAt).toBeTruthy()
  })

  it('preserves existing per100 when provided', () => {
    const f = emptyFood()
    const fav = addFavorite(f, {
      name: 'Skyr', g: 150, kcal: 99, p: 18, c: 6, f: 0,
      per100: { kcal: 66, p: 12, c: 4, f: 0 }, source: 'off'
    })
    expect(fav.per100).toEqual({ kcal: 66, p: 12, c: 4, f: 0 })
  })

  it('removes a favorite by id', () => {
    const f = emptyFood()
    const a = addFavorite(f, { name: 'Item A', kcal: 100 })
    const b = addFavorite(f, { name: 'Item B', kcal: 200 })
    expect(favoritesOf(f)).toHaveLength(2)
    removeFavorite(f, a.id)
    expect(favoritesOf(f)).toHaveLength(1)
    expect(favoritesOf(f)[0].id).toBe(b.id)
  })

  it('updates a favorite and scales totals if grams change', () => {
    const f = emptyFood()
    const fav = addFavorite(f, {
      name: 'Oats', g: 100, kcal: 370, p: 13, c: 60, f: 7,
      per100: { kcal: 370, p: 13, c: 60, f: 7 }
    })
    updateFavorite(f, fav.id, { g: 50, name: 'Small oats' })
    const updated = favoritesOf(f)[0]
    expect(updated.name).toBe('Small oats')
    expect(updated.g).toBe(50)
    expect(updated.kcal).toBe(185)
    expect(updated.p).toBe(7)
  })

  it('detects isFavorite case-insensitively and by barcode', () => {
    const f = emptyFood()
    addFavorite(f, { name: 'Protein Bar', code: '12345678', kcal: 200 })
    expect(isFavorite(f, { name: 'protein bar' })).toBe(true)
    expect(isFavorite(f, { name: 'Different', code: '12345678' })).toBe(true)
    expect(isFavorite(f, { name: 'Other' })).toBe(false)
    expect(getFavoriteMatch(f, { name: 'PROTEIN BAR' })?.name).toBe('Protein Bar')
  })

  it('touches favorite updating lastUsedAt', () => {
    const f = emptyFood()
    const fav = addFavorite(f, { name: 'Coffee', kcal: 50 })
    fav.lastUsedAt = 1000
    touchFavorite(f, fav.id)
    expect(favoritesOf(f)[0].lastUsedAt).toBeGreaterThan(1000)
  })

  it('derives per100 in parseEstimate when model only gave portion macros', () => {
    const e = parseEstimate('{"name":"Steak","g":200,"kcal":500,"p":50,"c":0,"f":30}')
    expect(e.g).toBe(200)
    expect(e.kcal).toBe(500)
    expect(e.per100).toEqual({ kcal: 250, p: 25, c: 0, f: 15 })
  })

  it('scales totals in parseEstimate when user specifies gramsHint', () => {
    const e = parseEstimate('{"name":"Rice","g":100,"kcal":130,"p":2.5,"c":28,"f":0.3}', 250)
    expect(e.g).toBe(250)
    expect(e.kcal).toBe(325)
    expect(e.p).toBe(6.3)
    expect(e.c).toBe(70)
  })

  it('addEntry automatically attaches per100 if missing', () => {
    const f = emptyFood()
    addEntry(f, '2026-01-01', { name: 'Chicken', g: 200, kcal: 330, p: 62, c: 0, f: 7, source: 'manual' })
    const e = f.day['2026-01-01'][0]
    expect(e.per100).toEqual({ kcal: 165, p: 31, c: 0, f: 3.5 })
  })

  it('updateEntry allows updating macros explicitly without being overwritten by old per100', () => {
    const f = emptyFood()
    addEntry(f, '2026-01-01', { name: 'Eggs', g: 100, kcal: 150, p: 13, c: 1, f: 10, source: 'manual' })
    const id = f.day['2026-01-01'][0].id
    updateEntry(f, '2026-01-01', id, { kcal: 180, f: 13 })
    const e = f.day['2026-01-01'][0]
    expect(e.kcal).toBe(180)
    expect(e.f).toBe(13)
    expect(e.per100.kcal).toBe(180)
    expect(e.per100.f).toBe(13)
  })
})

