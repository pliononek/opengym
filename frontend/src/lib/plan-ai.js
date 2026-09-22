// AI parsing of workout plan notes and matching against the app's exercise database.
//
// Uses the client-stored Gemini API key (`gym_gemini_key`) and the same fallback model
// chain as nutrition-ai.js. No user data leaves the browser except the pasted workout note.

import { getGeminiKey, getModel, setModel, MODEL_CHAIN } from './nutrition-ai.js'
import { uid } from './format.js'
import { t } from './i18n.js'
import { GLYPHS, DEFAULT_GLYPH } from './glyphs.js'

const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT = 45_000

const isModelError = msg => /\b404\b|not\s*found|not\s*supported|deprecated|does\s*not\s*exist|invalid[_\s-]*model|model_not_found/i.test(msg || '')
const isTransient = msg => /\b429\b|quota|rate\s*limit|\b503\b|unavailable/i.test(msg || '')

async function _aiCall(model, key, prompt, maxTokens) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(`${API}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens || 2048,
          responseMimeType: 'application/json'
        }
      })
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = (data?.error?.message || '') + ' HTTP ' + r.status
      const e = new Error(msg)
      e.status = r.status
      if (isModelError(msg) || isTransient(msg)) e.retryable = true
      throw e
    }
    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')
    if (!text) throw new Error('empty model output')
    return text
  } finally { clearTimeout(to) }
}

/**
 * Call Gemini with the fallback model chain.
 */
export async function callGemini(prompt, maxTokens = 2048) {
  const key = getGeminiKey()
  if (!key) throw new Error('NO_KEY')

  const userModel = getModel()
  const lead = MODEL_CHAIN.includes(userModel) ? userModel : MODEL_CHAIN[0]
  const chain = [lead, ...MODEL_CHAIN.filter(m => m !== lead)]

  let lastErr = null
  for (const model of chain) {
    try {
      const text = await _aiCall(model, key, prompt, maxTokens)
      setModel(model)
      return { model, text }
    } catch (e) {
      lastErr = e
      if (!e.retryable) throw e
      continue
    }
  }
  throw Object.assign(new Error(lastErr?.message || 'all models failed'), { code: 'all-models' })
}

export const PLAN_PROMPT = (noteText) => `You are a fitness expert and workout routine parser for a gym tracking app.
The app uses the standard ExerciseDB exercise database with ~1300 exercises (English names, e.g. "barbell bench press", "incline dumbbell bench press", "pull-up", "cable lat pulldown", "barbell full squat", "barbell deadlift", "barbell romanian deadlift", "dumbbell lateral raise", "barbell standing overhead press", "dumbbell alternate bicep curl", "barbell lying triceps extension skull crusher", "cable pushdown", "seated leg curl", "lever leg extension", etc.).

The user pasted notes representing their workout plan. The notes may be in Polish or English, and often use Polish gym slang and abbreviations (e.g.:
- "WL" or "wyciskanie leżąc" or "klatka" -> barbell bench press / dumbbell bench press
- "OHP" or "żołnierskie" or "barki" -> barbell standing overhead press / dumbbell seated shoulder press
- "siady" or "przysiady" -> barbell full squat
- "martwy" or "martwy ciąg" or "klasyk" -> barbell deadlift
- "RDL" or "rumun" -> barbell romanian deadlift
- "wiosło" or "wiosłowanie" -> barbell bent over row / dumbbell bent over row
- "drążek" or "podciąganie" -> pull-up / chin-up
- "wyciąg górny" -> cable lat pulldown
- "wznosy" or "boki" -> dumbbell lateral raise
- "tył barku" / "facepull" -> cable standing rear delt row
- "francuz" -> barbell lying triceps extension skull crusher
- "tric" / "wyciąg" -> cable pushdown
- "biceps" / "młotki" -> dumbbell alternate bicep curl / dumbbell hammer curl
- "bułgary" -> dumbbell single leg split squat / split squat
- "łydki" -> standing calf raise
- "brzuch" / "allahy" -> cable kneeling crunch / crunch
).

Analyze the note and extract the routines (workouts) and exercises into STRICT JSON matching this schema:
{
  "routines": [
    {
      "name": "Routine name (e.g. 'Push', 'Klatka + Triceps', 'Dzień 1')",
      "dayOfWeek": 0-6 or null (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday if mentioned like 'Poniedziałek', 'Środa', 'Mon', etc., else null),
      "emoji": "best matching glyph from: figureStrength, arm, abs, legs, pullup, dumbbell, barbell, kettlebell, plate, machine, figureRun, bike, swim, boxing, timer, stretch, flame, bolt",
      "exercises": [
        {
          "rawName": "original name from user note",
          "searchQuery": "canonical English exercise name matching ExerciseDB (e.g. 'barbell bench press')",
          "bp": "one of: back, cardio, chest, lower arms, lower legs, neck, shoulders, upper arms, upper legs, waist",
          "sets": <number of sets, default 3 if not specified>,
          "reps": <target reps; if range like 8-10, use lower bound 8; default 10 if not specified>,
          "weight": <weight in kg/lbs if specified, else 0>,
          "isSupersetNext": <true if this exercise is linked in a superset with the immediate next one, e.g. indicated by '+', '&', 'superseria', 'w serii łączonej z'>
        }
      ]
    }
  ]
}

Rules:
1. If the user note contains only a list of exercises without a routine name, create 1 routine named "Trening" or matching the detected muscles (e.g. "Góra ciała" or "Klatka i Ramiona").
2. Sets: integer >= 1. Reps: integer >= 1. Weight: number >= 0.
3. Be as accurate as possible with canonical English ExerciseDB names in searchQuery to maximize database matching.
4. Output STRICT JSON only without Markdown backticks or prose.

User Note:
"""
${noteText}
"""`;

/**
 * Safely parse raw JSON output from the model.
 */
export function parsePlanResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') throw new Error(t('Empty AI response'))

  // Strip markdown fences if present
  let clean = rawText.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }

  // Find first { and last }
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(t('Could not parse AI response as JSON'))
  }
  clean = clean.slice(start, end + 1)

  let data
  try {
    data = JSON.parse(clean)
  } catch (err) {
    throw new Error(t('Invalid JSON from AI: {0}', err.message))
  }

  if (!data || !Array.isArray(data.routines) || data.routines.length === 0) {
    throw new Error(t('No workouts found in notes'))
  }

  return {
    routines: data.routines.map((r, ri) => {
      const name = (r.name || '').trim() || t('Routine {0}', ri + 1)
      let dayOfWeek = typeof r.dayOfWeek === 'number' && r.dayOfWeek >= 0 && r.dayOfWeek <= 6 ? r.dayOfWeek : null
      const emoji = GLYPHS.includes(r.emoji) ? r.emoji : DEFAULT_GLYPH
      const exercises = (Array.isArray(r.exercises) ? r.exercises : []).map(e => {
        const rawName = (e.rawName || e.searchQuery || t('Exercise')).trim()
        const searchQuery = (e.searchQuery || rawName).trim()
        const bp = (e.bp || '').trim().toLowerCase()
        const sets = Math.max(1, Math.min(30, Math.round(Number(e.sets) || 3)))
        const reps = Math.max(1, Math.min(200, Math.round(Number(e.reps) || 10)))
        const weight = Math.max(0, Math.min(1000, Math.round((Number(e.weight) || 0) * 10) / 10))
        const isSupersetNext = Boolean(e.isSupersetNext)
        return {
          rawName,
          searchQuery,
          bp,
          sets,
          reps,
          weight,
          isSupersetNext
        }
      })
      return {
        name,
        dayOfWeek,
        emoji,
        exercises
      }
    })
  }
}

/**
 * Common English/ExerciseDB aliases for fast lookup.
 */
const COMMON_ALIASES = {
  'bench press': '0025',
  'barbell bench press': '0025',
  'flat bench press': '0025',
  'incline bench press': '0047',
  'incline dumbbell press': '0314',
  'incline dumbbell bench press': '0314',
  'dumbbell bench press': '0289',
  'overhead press': '0107',
  'standing overhead press': '0107',
  'military press': '0107',
  'barbell standing overhead press': '0107',
  'squat': '0043',
  'back squat': '0043',
  'barbell squat': '0043',
  'barbell full squat': '0043',
  'front squat': '0042',
  'deadlift': '0032',
  'barbell deadlift': '0032',
  'romanian deadlift': '0085',
  'rdl': '0085',
  'barbell romanian deadlift': '0085',
  'pull up': '0652',
  'pull-up': '0652',
  'chin up': '0253',
  'chin-up': '0253',
  'lat pulldown': '2330',
  'cable lat pulldown': '2330',
  'barbell row': '0027',
  'bent over row': '0027',
  'barbell bent over row': '0027',
  'dumbbell row': '0292',
  'dumbbell bent over row': '0292',
  'lateral raise': '0334',
  'side lateral raise': '0334',
  'dumbbell lateral raise': '0334',
  'rear delt fly': '0290',
  'face pull': '0198',
  'cable face pull': '0198',
  'barbell curl': '0031',
  'bicep curl': '0285',
  'dumbbell bicep curl': '0285',
  'hammer curl': '0313',
  'dumbbell hammer curl': '0313',
  'skull crusher': '0060',
  'skullcrusher': '0060',
  'barbell skull crusher': '0060',
  'triceps pushdown': '0201',
  'cable pushdown': '0201',
  'dips': '0251',
  'chest dip': '0251',
  'leg press': '1379',
  'sled 45° leg press': '1379',
  'leg extension': '0585',
  'lever leg extension': '0585',
  'leg curl': '0599',
  'lying leg curl': '0599',
  'lever lying leg curl': '0599',
  'seated leg curl': '0716',
  'calf raise': '0803',
  'standing calf raise': '0803',
  'cable crunch': '0175',
  'hanging leg raise': '0472'
}

/**
 * Find best matching exercise in allEx (customEx + EXDB).
 */
export function matchExercise(item, allEx = []) {
  const query = (item.searchQuery || '').toLowerCase().trim()
  const raw = (item.rawName || '').toLowerCase().trim()
  const bp = (item.bp || '').toLowerCase().trim()

  // 1. Direct alias ID match
  if (COMMON_ALIASES[query]) {
    const found = allEx.find(e => e.id === COMMON_ALIASES[query])
    if (found) return { matched: found, score: 1.0, unmatched: false, candidates: [] }
  }

  // 2. Exact match on English name or custom name
  const exact = allEx.find(e => e.n.toLowerCase() === query || e.n.toLowerCase() === raw)
  if (exact) {
    return { matched: exact, score: 1.0, unmatched: false, candidates: [] }
  }

  // 3. Token-based scoring
  const cleanTokens = s => s.replace(/[^a-z0-9\s]/gi, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const qTokens = cleanTokens(query)
  const rawTokens = cleanTokens(raw)
  const targetTokens = [...new Set([...qTokens, ...rawTokens])]

  const scored = []
  for (const ex of allEx) {
    const exName = ex.n.toLowerCase()
    const exTokens = cleanTokens(exName)
    let tokenMatches = 0

    for (const t of targetTokens) {
      if (exTokens.some(et => et === t || et.includes(t) || t.includes(et))) {
        tokenMatches++
      }
    }

    let score = targetTokens.length ? tokenMatches / targetTokens.length : 0
    if (bp && ex.bp === bp) score += 0.25
    if (query && exName.includes(query)) score += 0.35
    if (raw && exName.includes(raw)) score += 0.25

    if (score > 0.25) {
      scored.push({ ex, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  const topCandidates = scored.slice(0, 5).map(s => s.ex)

  // If score is high enough (>= 0.60), accept match
  if (best && best.score >= 0.60) {
    return {
      matched: best.ex,
      score: best.score,
      unmatched: false,
      candidates: topCandidates
    }
  }

  // Otherwise mark unmatched, but provide suggestions
  const fallbackCandidates = topCandidates.length > 0
    ? topCandidates
    : allEx.filter(e => !bp || e.bp === bp).slice(0, 5)

  return {
    matched: best ? best.ex : (fallbackCandidates[0] || null),
    score: best ? best.score : 0,
    unmatched: true,
    candidates: fallbackCandidates
  }
}

/**
 * Full parsing pipeline: call AI, parse JSON, match exercises.
 */
export async function parseAndMatchPlan(noteText, allEx = []) {
  const prompt = PLAN_PROMPT(noteText)
  const { text, model } = await callGemini(prompt, 3000)
  const parsed = parsePlanResponse(text)

  const routines = parsed.routines.map(r => {
    const exercises = r.exercises.map(exItem => {
      const matchResult = matchExercise(exItem, allEx)
      return {
        ...exItem,
        matchedEx: matchResult.matched,
        unmatched: matchResult.unmatched,
        matchScore: matchResult.score,
        candidates: matchResult.candidates
      }
    })
    return {
      ...r,
      exercises
    }
  })

  return { routines, model }
}
