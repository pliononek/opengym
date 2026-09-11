// Client-side Gemini calls for food estimation.
//
// Design rule for this feature: the AI key belongs to the person using the browser,
// not to the instance — so it lives in localStorage (separate keys `gym_gemini_key`
// / `gym_gemini_model`), never inside the synced state. The same goes for the model
// selection: each browser remembers which model last answered, and the fallback chain
// below walks the newest model first, mirroring the behaviour the vanilla app proved
// out (3.5 Flash Lite works on most accounts; 3.1 Flash Lite and 2.x cover the rest).
//
// No images ever leave here resized bigger than needed: a photo is downscaled to a
// max 1024 px JPEG on the client before it is sent, which keeps the request small
// without losing the plate-level detail the model actually uses.

import { parseEstimate } from './nutrition.js'
import { t } from './i18n.js'

export const MODEL_CHAIN = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT = 45_000

const KEY_STORE = 'gym_gemini_key'
const MODEL_STORE = 'gym_gemini_model'

export const getGeminiKey = () => { try { return localStorage.getItem(KEY_STORE) || '' } catch { return '' } }
export const setGeminiKey = k => { try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE) } catch { /* storage full/denied */ } }
export const getModel = () => { try { return localStorage.getItem(MODEL_STORE) || '' } catch { return '' } }
const setModel = m => { try { if (m) localStorage.setItem(MODEL_STORE, m); else localStorage.removeItem(MODEL_STORE) } catch { /* ignore */ } }
export { setModel }

export const hasKey = () => !!getGeminiKey()

const isModelError = msg => /\b404\b|not\s*found|not\s*supported|deprecated|does\s*not\s*exist|invalid[_\s-]*model|model_not_found/i.test(msg || '')
const isTransient = msg => /\b429\b|quota|rate\s*limit|\b503\b|unavailable/i.test(msg || '')

async function _aiCall(model, key, parts, maxTokens) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const r = await fetch(`${API}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens || 1024,
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

/** Candids from Open Food Facts appended to the prompt as reliable per-100g facts. */
export const offFacts = cands => !cands || !cands.length
  ? ''
  : '\nOpen Food Facts matches (reliable per-100g data — prefer them when they fit what is in front of you):\n' +
    cands.map(c => `- ${c.name} (barcode ${c.code}): per 100 g ${c.per100.kcal} kcal, protein ${c.per100.p} g, carbs ${c.per100.c} g, fat ${c.per100.f} g`).join('\n')

const basePrompt = (hint, grams, cands) =>
  `Estimate the nutrition of a food item. Answer with STRICT JSON only, schema:
{"nazwa":"short food name","g":<portion weight in grams, 0 if unknown>,"kcal":<portion total kcal>,"bialko":<protein g, portion total>,"weglowodany":<carbs g, portion total>,"tluszcze":<fat g, portion total>,"per100":{"kcal":<kcal per 100 g>,"bialko":<protein g per 100 g>,"weglowodany":<carbs g per 100 g>,"tluszcze":<fat g per 100 g>}|null,"confidence":<0-1>}
Rules: kcal MUST equal bialko*4 + weglowodany*4 + tluszcze*9 (within 10%). If you can state a per-100g basis, fill "per100" AND set "g" and derive portion totals from it; a photo with no reference for weight should still estimate a portion weight ("g") from the plate. Never invent nutrition for a genuinely unknown item — set confidence low (below 0.5) and keep totals plausible.${hint ? `\nUser hint about this meal: "${hint}"` : ''}${grams > 0 ? `\nThe logged portion has a measured weight: ${grams} g — use it for "g".` : ''}${offFacts(cands)}`

/**
 * Run an estimation prompt across the model chain.
 * Throws a retryable-aware error when every candidate model fails; the caller decides
 * what to tell the user. `image` is a base64 JPEG data-URL (from imageToBase64).
 */
export async function estimateFood({ prompt, image, maxTokens }) {
  const key = getGeminiKey()
  const userModel = getModel()
  // The cached model leads the chain when it is still offered; otherwise start fresh.
  const lead = MODEL_CHAIN.includes(userModel) ? userModel : MODEL_CHAIN[0]
  const chain = [lead, ...MODEL_CHAIN.filter(m => m !== lead)]

  const parts = []
  if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image.split(',')[1] } })
  parts.push({ text: prompt })

  let lastErr = null
  for (const model of chain) {
    try {
      const raw = await _aiCall(model, key, parts, maxTokens)
      setModel(model)
      return { model, text: raw }
    } catch (e) {
      lastErr = e
      if (!e.retryable) throw e   // auth, network, timeout — no point trying the next model
      continue
    }
  }
  throw Object.assign(new Error((lastErr?.message || 'all models failed')), { code: 'all-models' })
}

/** Text → estimate draft (already validated/clamped by parseEstimate). */
export async function estimateFromText(description, { grams = 0, cands = [] } = {}) {
  const { text } = await estimateFood({ prompt: basePrompt(description, grams, cands) })
  return parseEstimate(text, grams)
}

/** Photo → estimate draft. base64 = data URL from imageToBase64. */
export async function estimateFromPhoto(base64, { grams = 0, nameHint = '', cands = [] } = {}) {
  const prompt = basePrompt(nameHint, grams, cands) +
    '\nThis meal is photographed. Look at the food, identify it, estimate the portion size, and return the JSON above.'
  const { text, model } = await estimateFood({ prompt, image: base64 })
  const draft = parseEstimate(text, grams)
  return { draft, model }
}

/**
 * Downscale an uploaded photo so the AI request stays small. Never enlarges.
 * Returns a JPEG data URL (max 1024 px on the long edge, quality 0.72).
 */
export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const MAX = 1024
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = cv.toDataURL('image/jpeg', 0.72)
        resolve(dataUrl)
      } catch (e) { reject(e) }
      finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('Could not read that image'))) }
    img.src = url
  })
}