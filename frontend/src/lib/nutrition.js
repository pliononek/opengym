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

export const emptyFood = () => ({ goals: { kcal: 0, p: 0, c: 0, f: 0 }, day: {}, favorites: [] })

export function loadFood() {
  try {
    const raw = localStorage.getItem(FOOD_KEY)
    if (raw) {
      const f = JSON.parse(raw)
      return {
        goals: Object.assign(emptyFood().goals, f.goals || {}),
        day: f.day || {},
        favorites: Array.isArray(f.favorites) ? f.favorites : []
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
  const clamped = clampEntry(entry)
  if (!clamped.per100 && clamped.g > 0 && (clamped.kcal > 0 || clamped.p > 0 || clamped.c > 0 || clamped.f > 0)) {
    const factor = 100 / clamped.g
    clamped.per100 = {
      kcal: Math.round(clamped.kcal * factor),
      p: Math.round(clamped.p * factor * 10) / 10,
      c: Math.round(clamped.c * factor * 10) / 10,
      f: Math.round(clamped.f * factor * 10) / 10
    }
  }
  day.push({ id: uid(), t: Date.now(), ...clamped })
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
  const prev = day[i]
  const next = clampEntry({ ...prev, ...patch })
  const macrosExplicitlyPatched = patch.kcal != null || patch.p != null || patch.c != null || patch.f != null
  if (patch.g != null && !macrosExplicitlyPatched) {
    const p100 = next.per100 || (prev.g > 0 ? {
      kcal: Math.round((prev.kcal / prev.g) * 100),
      p: Math.round((prev.p / prev.g) * 1000) / 10,
      c: Math.round((prev.c / prev.g) * 1000) / 10,
      f: Math.round((prev.f / prev.g) * 1000) / 10,
    } : null)
    if (p100 && next.g > 0) {
      const r = next.g / 100
      next.kcal = Math.round(p100.kcal * r)
      next.p = Math.round(p100.p * r)
      next.c = Math.round(p100.c * r)
      next.f = Math.round(p100.f * r)
      next.per100 = p100
    }
  } else if (next.g > 0 && (!next.per100 || macrosExplicitlyPatched)) {
    const factor = 100 / next.g
    next.per100 = {
      kcal: Math.round(next.kcal * factor),
      p: Math.round(next.p * factor * 10) / 10,
      c: Math.round(next.c * factor * 10) / 10,
      f: Math.round(next.f * factor * 10) / 10,
    }
  }
  day[i] = next
}

/* ============================ favorites ============================ */

export const FAVORITES_MAX = 100

export const favoritesOf = food => (Array.isArray(food?.favorites) ? food.favorites : [])

export function addFavorite(food, entry) {
  const favs = (food.favorites = food.favorites || [])
  const clamped = clampEntry(entry)
  if (!clamped.per100 && clamped.g > 0) {
    const factor = 100 / clamped.g
    clamped.per100 = {
      kcal: Math.round(clamped.kcal * factor),
      p: Math.round(clamped.p * factor * 10) / 10,
      c: Math.round(clamped.c * factor * 10) / 10,
      f: Math.round(clamped.f * factor * 10) / 10
    }
  }
  const now = Date.now()
  const item = {
    id: uid(),
    ...clamped,
    createdAt: now,
    lastUsedAt: now
  }
  favs.unshift(item)
  if (favs.length > FAVORITES_MAX) favs.pop()
  return item
}

export function removeFavorite(food, id) {
  if (!food.favorites) return
  food.favorites = food.favorites.filter(f => f.id !== id)
}

export function updateFavorite(food, id, patch) {
  if (!food.favorites) return
  const i = food.favorites.findIndex(f => f.id === id)
  if (i === -1) return
  const prev = food.favorites[i]
  const next = clampEntry({ ...prev, ...patch })
  const macrosExplicitlyPatched = patch.kcal != null || patch.p != null || patch.c != null || patch.f != null
  if (patch.g != null && !macrosExplicitlyPatched) {
    const p100 = next.per100 || (prev.g > 0 ? {
      kcal: Math.round((prev.kcal / prev.g) * 100),
      p: Math.round((prev.p / prev.g) * 1000) / 10,
      c: Math.round((prev.c / prev.g) * 1000) / 10,
      f: Math.round((prev.f / prev.g) * 1000) / 10,
    } : null)
    if (p100 && next.g > 0) {
      const r = next.g / 100
      next.kcal = Math.round(p100.kcal * r)
      next.p = Math.round(p100.p * r)
      next.c = Math.round(p100.c * r)
      next.f = Math.round(p100.f * r)
      next.per100 = p100
    }
  } else if (next.g > 0 && (!next.per100 || macrosExplicitlyPatched)) {
    const factor = 100 / next.g
    next.per100 = {
      kcal: Math.round(next.kcal * factor),
      p: Math.round(next.p * factor * 10) / 10,
      c: Math.round(next.c * factor * 10) / 10,
      f: Math.round(next.f * factor * 10) / 10,
    }
  }
  food.favorites[i] = {
    ...prev,
    ...next,
    id: prev.id,
    createdAt: prev.createdAt,
    lastUsedAt: prev.lastUsedAt
  }
}

export function touchFavorite(food, id) {
  if (!food.favorites) return
  const item = food.favorites.find(f => f.id === id)
  if (item) {
    item.lastUsedAt = Date.now()
  }
}

export function isFavorite(food, entry) {
  if (!food?.favorites?.length || !entry) return false
  const nameNorm = String(entry.name || '').trim().toLowerCase()
  return food.favorites.some(f => {
    if (entry.code && f.code && entry.code === f.code) return true
    return String(f.name || '').trim().toLowerCase() === nameNorm
  })
}

export function getFavoriteMatch(food, entry) {
  if (!food?.favorites?.length || !entry) return null
  const nameNorm = String(entry.name || '').trim().toLowerCase()
  return food.favorites.find(f => {
    if (entry.code && f.code && entry.code === f.code) return true
    return String(f.name || '').trim().toLowerCase() === nameNorm
  }) || null
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
  const userG = num(gramsHint, 99999)
  const modelG = num(grab([obj.g, obj.grams, obj.weight_g, obj.waga]), 99999)
  const g = userG > 0 ? userG : modelG

  let per100 = obj.per100 && typeof obj.per100 === 'object'
    ? {
        kcal: num(grab([obj.per100.kcal, obj.per100.kalorie, obj.per100.energy]), 999),
        p: num(obj.per100.bialko ?? obj.per100.protein ?? obj.per100.p, 100),
        c: num(obj.per100.weglowodany ?? obj.per100.carbs ?? obj.per100.c, 100),
        f: num(obj.per100.tluszcze ?? obj.per100.fat ?? obj.per100.f, 100)
      }
    : null

  const rawKcal = grab([obj.kcal, obj.kalorie, obj.energy])
  const rawP = grab([obj.p, obj.bialko, obj.protein])
  const rawC = grab([obj.c, obj.weglowodany, obj.carbs])
  const rawF = grab([obj.f, obj.tluszcze, obj.fat])

  if (!per100 && modelG > 0 && (rawKcal != null || rawP != null || rawC != null || rawF != null)) {
    const factor = 100 / modelG
    per100 = {
      kcal: num(rawKcal != null ? num(rawKcal, 99999) * factor : 0, 999),
      p: num(rawP != null ? num(rawP, 99999) * factor : 0, 100),
      c: num(rawC != null ? num(rawC, 99999) * factor : 0, 100),
      f: num(rawF != null ? num(rawF, 99999) * factor : 0, 100)
    }
  }

  let tot = { kcal: 0, p: 0, c: 0, f: 0 }
  if (per100 && g > 0) {
    const r = g / 100
    tot = {
      kcal: Math.round(per100.kcal * r),
      p: Math.round(per100.p * r * 10) / 10,
      c: Math.round(per100.c * r * 10) / 10,
      f: Math.round(per100.f * r * 10) / 10
    }
  } else {
    tot = {
      kcal: rawKcal != null ? num(rawKcal, 99999) : 0,
      p: rawP != null ? num(rawP, 99999) : 0,
      c: rawC != null ? num(rawC, 99999) : 0,
      f: rawF != null ? num(rawF, 99999) : 0
    }
    if (!per100 && g > 0 && (tot.kcal > 0 || tot.p > 0 || tot.c > 0 || tot.f > 0)) {
      const factor = 100 / g
      per100 = {
        kcal: Math.round(tot.kcal * factor),
        p: Math.round(tot.p * factor * 10) / 10,
        c: Math.round(tot.c * factor * 10) / 10,
        f: Math.round(tot.f * factor * 10) / 10
      }
    }
  }

  if (g > 0) {
    const implied = tot.p * 4 + tot.c * 4 + tot.f * 9
    if (implied > 0 && tot.kcal > 0 && Math.abs(implied - tot.kcal) / tot.kcal > 0.25) {
      tot.p = Math.round(tot.p * (tot.kcal / implied))
      tot.c = Math.round(tot.c * (tot.kcal / implied))
      tot.f = Math.round(tot.f * (tot.kcal / implied))
      if (per100) {
        const factor = 100 / g
        per100 = {
          kcal: Math.round(tot.kcal * factor),
          p: Math.round(tot.p * factor * 10) / 10,
          c: Math.round(tot.c * factor * 10) / 10,
          f: Math.round(tot.f * factor * 10) / 10
        }
      }
    }
  }

  return clampEntry({
    name: String(name).slice(0, 120),
    g, ...tot,
    per100: per100 && (per100.kcal > 0 || per100.p > 0 || per100.c > 0 || per100.f > 0) ? per100 : null,
    source: 'ai'
  })
}
