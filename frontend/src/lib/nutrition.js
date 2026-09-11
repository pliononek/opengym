// Food & macro tracking — local to the browser, never synced.
//
// Goals and the food diary are personal per-device data ("what did I eat today"),
// so they deliberately live OUTSIDE the synced profile state (S) — localStorage
// only, via store/useFood.js. This module is the pure logic over a `food` object
// { goals, day } plus localStorage load/save. Nothing here touches S, Supabase
// or the network; an account is never required to track meals.

import { uid } from './format.js'

// Worst case per day. localStorage is generous, but a diary that never forgets
// a meal would grow without bound — 80 entries already covers months of days.
export const ENTRY_MAX = 80

export const FOOD_KEY = 'gym_food_v1'

export const emptyFood = () => ({ goals: { kcal: 0, p: 0, c: 0, f: 0 }, day: {} })

export function loadFood() {
  try {
    const raw = localStorage.getItem(FOOD_KEY)
    if (raw) {
      const f = JSON.parse(raw)
      return {
        goals: Object.assign(emptyFood().goals, f.goals || {}),
        day: f.day || {}
      }
    }
  } catch { /* corrupt or missing */ }
  return emptyFood()
}

export function saveFood(food) {
  try { localStorage.setItem(FOOD_KEY, JSON.stringify(food)) } catch { /* storage full/denied */ }
}

/* ============================ goals ============================ */

export const hasGoals = food => {
  const g = food?.goals
  return !!(g && (g.kcal > 0 || g.p > 0 || g.c > 0 || g.f > 0))
}
export const goalsOf = food => {
  const g = food?.goals
  return (g && (g.kcal > 0 || g.p > 0 || g.c > 0 || g.f > 0)) ? g : null
}

export const clampGoals = goals => {
  const clean = {}
  for (const k of ['kcal', 'p', 'c', 'f']) clean[k] = Math.max(0, Math.min(99999, Math.round(+goals?.[k] || 0)))
  return clean
}

/* ============================ daily reads ============================ */

export const entriesOf = (food, iso) => food?.day?.[iso] || []

export function dayTotals(food, iso) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 }
  for (const e of entriesOf(food, iso)) {
    t.kcal += e.kcal || 0
    t.p += e.p || 0
    t.c += e.c || 0
    t.f += e.f || 0
  }
  return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), f: Math.round(t.f) }
}

export const ringPct = (food, iso) => {
  const g = goalsOf(food)
  if (!g || !(g.kcal > 0)) return 0
  return Math.min(1.12, (dayTotals(food, iso).kcal || 0) / g.kcal)
}

export const macroPct = (food, iso, key) => {
  const g = goalsOf(food)
  const v = dayTotals(food, iso)[key]
  if (!g || !(g[key] > 0)) return v > 0 ? 1 : 0
  return Math.min(1, v / g[key])
}

/* ============================ entries ============================ */

function num(v, max, round = 1) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(max || 99999, round ? Math.round(n * 10) / 10 : Math.round(n)))
}

export function clampEntry(entry) {
  const q = v => num(v, 99999)
  return {
    name: String(entry.name || '').trim().slice(0, 120),
    g: q(entry.g),
    kcal: q(entry.kcal),
    p: q(entry.p),
    c: q(entry.c),
    f: q(entry.f),
    per100: entry.per100
      ? { kcal: q(entry.per100.kcal), p: q(entry.per100.p), c: q(entry.per100.c), f: q(entry.per100.f) }
      : null,
    code: entry.code || null,
    source: ['ai', 'photo', 'manual', 'off'].includes(entry.source) ? entry.source : 'manual'
  }
}

/* ============================ draft mutators ============================ */
// All three MUTATE the food object in place — call them inside useFood().update(f => …).

export function addEntry(food, iso, entry) {
  const day = (food.day[iso] = food.day[iso] || [])
  day.push({ id: uid(), t: Date.now(), ...clampEntry(entry) })
  if (day.length > ENTRY_MAX) day.shift()
}

export function removeEntry(food, iso, id) {
  if (!food.day[iso]) return
  food.day[iso] = food.day[iso].filter(e => e.id !== id)
}

export function updateEntry(food, iso, id, patch) {
  const day = food.day[iso]
  if (!day) return
  const i = day.findIndex(e => e.id === id)
  if (i === -1) return
  const next = clampEntry({ ...day[i], ...patch })
  if (next.per100 && next.g > 0) {
    const r = next.g / 100
    next.kcal = Math.round(next.per100.kcal * r)
    next.p = Math.round(next.per100.p * r)
    next.c = Math.round(next.per100.c * r)
    next.f = Math.round(next.per100.f * r)
  }
  day[i] = next
}

/* ============================ AI output parsing ============================ */

const grab = o => {
  const names = o.filter(v => v != null)
  return names.length ? String(names[0]) : null
}

export function parseEstimate(raw, gramsHint = 0) {
  const text = String(raw || '')
  let obj = null

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { obj = JSON.parse(fenced[1]) } catch { /* try bare object below */ }
  }
  if (!obj) {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) {
      try { obj = JSON.parse(text.slice(first, last + 1)) } catch { /* unrecoverable */ }
    }
  }
  if (!obj || typeof obj !== 'object') throw new Error('no JSON in model output')

  const name = grab([obj.nazwa, obj.name, obj.food_name, obj.food])
  if (!name) throw new Error('name missing')

  const per100 = obj.per100 && typeof obj.per100 === 'object'
    ? {
        kcal: num(grab([obj.per100.kcal, obj.per100.kalorie, obj.per100.energy]), 999),
        p: num(obj.per100.bialko ?? obj.per100.protein ?? obj.per100.p, 100),
        c: num(obj.per100.weglowodany ?? obj.per100.carbs ?? obj.per100.c, 100),
        f: num(obj.per100.tluszcze ?? obj.per100.fat ?? obj.per100.f, 100)
      }
    : null

  const g = num(grab([obj.g, obj.grams, obj.weight_g, obj.waga]), 99999) || num(gramsHint, 99999)

  const derive = (totals, per) =>
    totals != null ? num(totals, 99999) : (per100 && g > 0 ? Math.round(per100[per] * g / 100) : 0)

  const tot = {
    kcal: derive(grab([obj.kcal, obj.kalorie, obj.energy]), 'kcal'),
    p: derive(grab([obj.p, obj.bialko, obj.protein]), 'p'),
    c: derive(grab([obj.c, obj.weglowodany, obj.carbs]), 'c'),
    f: derive(grab([obj.f, obj.tluszcze, obj.fat]), 'f')
  }

  if (g > 0) {
    const implied = tot.p * 4 + tot.c * 4 + tot.f * 9
    if (implied > 0 && tot.kcal > 0 && Math.abs(implied - tot.kcal) / tot.kcal > 0.25) {
      tot.p = Math.round(tot.p * (tot.kcal / implied))
      tot.c = Math.round(tot.c * (tot.kcal / implied))
      tot.f = Math.round(tot.f * (tot.kcal / implied))
    }
  }

  return clampEntry({
    name: String(name).slice(0, 120),
    g, ...tot,
    per100: per100 && (per100.kcal > 0 || per100.p > 0 || per100.c > 0 || per100.f > 0) ? per100 : null,
    source: 'ai'
  })
}
