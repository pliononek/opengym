// Open Food Facts client.
//
// Two jobs: exact lookup by barcode (product endpoint) for the scanner, and fuzzy
// search (search.pl) that doubles as the "instant pick" list while typing a meal —
// same API, no key, CORS is wide open. QR payloads from a label often carry the
// product URL rather than the bare code; extractCodeFromQr handles both.

const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

// OFF stores its own name for a field next to the EU one; `nutrition-facts` orders:
// energy-kcal_100g (fallback energy_100g/4.184), proteins_100g, carbohydrates_100g, fat_100g.
function per100From(n) {
  if (!n) return null
  const kcal = num(n['energy-kcal_100g'] != null ? n['energy-kcal_100g'] : (n.energy_100g != null ? n.energy_100g / 4.184 : 0))
  const p = num(n['proteins_100g'] ?? n.proteins)
  const c = num(n['carbohydrates_100g'] ?? n.carbohydrates)
  const f = num(n['fat_100g'] ?? n.fat)
  if (!kcal && !p && !c && !f) return null
  return { kcal, p, c, f }
}

const clean = p => ({
  name: (p.product_name || p.generic_name || '').trim().slice(0, 120),
  code: (p.code || '').trim(),
  per100: per100From(p.nutriments)
})

/**
 * Exact product lookup. Returns null when the code is unknown, and also when the
 * product exists but lists no nutrition — the caller must distinguish "not found"
 * from "found but useless" (the UI offers a manual fallback for the latter).
 */
export async function lookupBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`)
  if (!r.ok) throw new Error('Open Food Facts HTTP ' + r.status)
  const data = await r.json()
  if (data.status !== 1 || !data.product) return null
  const c = clean(data.product)
  return c.per100 ? c : null
}

/** Fuzzy search → up to 6 products with nutrition. */
export async function searchFood(q) {
  const params = new URLSearchParams({ search_terms: q, json: '1', page_size: '6', fields: 'code,product_name,generic_name,nutriments' })
  const r = await fetch('https://world.openfoodfacts.org/cgi/search.pl?' + params.toString())
  if (!r.ok) throw new Error('Open Food Facts HTTP ' + r.status)
  const data = await r.json()
  const out = []
  for (const p of data.products || []) {
    const c = clean(p)
    if (!c.per100 || !c.name) continue
    out.push(c)
  }
  return out
}

/** A QR payload is often a product URL; some scanners hand back the bare EAN-13. */
export function extractCodeFromQr(text) {
  const t = String(text || '').trim()
  if (/^\d{8,14}$/.test(t)) return t
  const m = t.match(/openfoodfacts\.org\/product\/(\d{8,14})/)
  return m ? m[1] : null
}

/** Scale a per-100g basis to grams, integer-rounded (the way entries store totals). */
export const scalePer100 = (per100, g) => ({
  kcal: Math.round((per100.kcal || 0) * g / 100),
  p: Math.round((per100.p || 0) * g / 100),
  c: Math.round((per100.c || 0) * g / 100),
  f: Math.round((per100.f || 0) * g / 100)
})