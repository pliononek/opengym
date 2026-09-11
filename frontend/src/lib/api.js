// Backend + WebAuthn helpers (ported from the vanilla app).
// On a Supabase build (no server) the REST calls below are routed to the Supabase adapter —
// see lib/supabase.js. Self-hosted builds keep hitting /api exactly as before.
import { SUPA } from './supabase-meta.js'

export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'
export const webauthnOK = () => !!(window.PublicKeyCredential && navigator.credentials)

export async function api(path, opts) {
  // ---- Supabase (static) build: translate the handful of endpoints the store calls.
  if (SUPA) {
    const { currentUser, statePush, statePull, supaSignOut } = await import('./supabase.js')
    const body = opts?.body ? JSON.parse(opts.body) : {}
    switch (path) {
      case '/api/config':
        // No capabilities beyond the static app: no Coach, no push, no admin.
        return {}
      case '/api/me': {
        const u = await currentUser()
        return { user: u }
      }
      case '/api/data':
        if (opts?.method === 'PUT') {
          const userId = (await currentUser())?.id
          if (userId) { await statePush(userId, body.state); localStorage.removeItem('gym_dirty') }
          return {}
        }
        {
          const userId = (await currentUser())?.id
          const state = userId ? await statePull(userId) : null
          return { state }
        }
      case '/api/logout':
        await supaSignOut('local')
        return {}
      case '/api/logout/all':
        await supaSignOut('global')
        return {}
      default:
        throw Object.assign(new Error('No server in this build'), { status: 404 })
    }
  }

  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(data.error || ('HTTP ' + r.status)); e.status = r.status; throw e }
  return data
}

const bufToB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uToBuf = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer

// Passkey flows are a WebAuthn-only path (self-hosted); Supabase builds call the email
// helpers below instead — same return shape { id, name, admin }.
export async function passkeyRegister(name, code) {
  const { cid, options } = await api('/api/register/options', { method: 'POST', body: JSON.stringify({ name, code: code || '' }) })
  const cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) })
  const res = await api('/api/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}
export async function passkeyLogin() {
  const { cid, options } = await api('/api/login/options', { method: 'POST', body: '{}' })
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(options) })
  const res = await api('/api/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}

// Supabase build — replace the WebAuthn round-trips with email/password round-trips.
// Sign-up returns { user, needsConfirm } when email confirmation is on in the project.
export async function emailSignUp(name, email, password) {
  const { supaSignUp } = await import('./supabase.js')
  return supaSignUp(name, email.trim(), password)
}
export async function emailSignIn(email, password) {
  const { supaLogin } = await import('./supabase.js')
  return supaLogin(email.trim(), password)
}
