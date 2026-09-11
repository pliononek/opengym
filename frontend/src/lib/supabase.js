// Supabase-backed auth + state sync for a static (Cloudflare Pages / Netlify) build.
//
// Everything here is off unless VITE_SUPABASE_URL is present at build time; without it the
// app behaves exactly as before (self-hosted server). This module is imported dynamically
// (never statically) so supabase-js only ever lands in a build that actually uses it.
//
// The anon key is public on purpose (it sits in a static site), so the security boundary is
// RLS: every query goes through the JWT of the signed-in user, and the state row is reachable
// only by auth.uid(). Never put a service-role key anywhere in this codebase.

import { SUPA_URL, SUPA_ANON, SUPA, mapUser } from './supabase-meta.js'

let _sb = null
/** Lazy singleton — supabase-js is only pulled in when a Supabase build runs. */
export async function sb() {
  if (SUPA && !_sb) {
    const { createClient } = await import('@supabase/supabase-js')
    _sb = createClient(SUPA_URL, SUPA_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  }
  return SUPA ? _sb : null
}

export { SUPA, mapUser }

/* ============================ session ============================ */

/** Returns the live session user, or null. Refreshes the token if Supabase needs it. */
export async function currentUser() {
  const c = await sb()
  if (!c) return null
  const { data, error } = await c.auth.getSession()
  if (error || !data.session) return null
  return mapUser(data.session.user)
}

/* ============================ auth actions ============================ */

export async function supaLogin(email, password) {
  const c = await sb()
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: 401 })
  return mapUser(data.user)
}

export async function supaSignUp(name, email, password) {
  const c = await sb()
  const { data, error } = await c.auth.signUp({
    email,
    password,
    options: { data: { name } }
  })
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: 400 })
  // signUp with email confirmation ON returns a session-less user until the link is clicked.
  return { user: mapUser(data.user), needsConfirm: !data.session }
}

/** `scope`: 'local' (this device) or 'global' (all sessions — "sign out everywhere"). */
export async function supaSignOut(scope = 'local') {
  const c = await sb()
  if (!c) return
  await c.auth.signOut({ scope })
}

/* ============================ state sync ============================ */

// Mirror of the server's GET/PUT /api/data contract: one JSON blob per user.
// Next-write-wins (upsert on user_id) — the client already resolves merges via _ts, so the
// store logic (pullState/pushState) works unchanged against this adapter.
export async function statePush(userId, state) {
  const c = await sb()
  const { error } = await c
    .from('state')
    .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
}

export async function statePull(userId) {
  const c = await sb()
  const { data, error } = await c
    .from('state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return data?.data || null
}