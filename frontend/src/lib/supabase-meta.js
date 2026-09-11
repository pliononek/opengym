// Flags + pure mapping for a Supabase-backed static build.
// Kept free of any import from supabase-js so these handful of consts can be statically
// imported everywhere without dragging the (large-ish) client into every build variant.
// Heavy functions live in lib/supabase.js and are imported dynamically.

export const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const SUPA = !!SUPA_URL && !!SUPA_ANON

/** The user object the store expects: { id, name, admin }. */
export function mapUser(u) {
  if (!u) return null
  return {
    id: u.id,
    name: (u.user_metadata?.name || u.email || '').slice(0, 40),
    admin: false   // no admin surface in the static build
  }
}