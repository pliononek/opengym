import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { webauthnOK, passkeyLogin, passkeyRegister, api, BIO, emailSignIn, emailSignUp } from '../lib/api.js'
import { hasData } from '../store/useStore.js'
import { SUPA } from '../lib/supabase-meta.js'
import { t } from '../lib/i18n.js'
import { DEMO, REPO } from '../lib/demo.js'
import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import { Button, TextField } from '../components/ui.jsx'

function RegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(false)
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 250) }, [])
  useEffect(() => { api('/api/config').then(c => setInviteOnly(!!c.invite_only)).catch(() => {}) }, [])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (inviteOnly && !code.trim()) { useUI.getState().toast(t('An invite code is required')); return }
    try {
      const u = await passkeyRegister(n, code.trim())
      setUser(u); close()
      if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
      else { await pullState(); useUI.getState().toast(t('Welcome, {0}', u.name)) }
    } catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Registration failed')) }
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('Pick a name, then confirm with {0}. The passkey is saved in your device — no password needed.', BIO)}</div>
    <input ref={ref} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
    {inviteOnly && <>
      <div style={{ height: 10 }} />
      <input className="input" placeholder={t('Invite code')} maxLength={40} value={code}
        onChange={e => setCode(e.target.value.toUpperCase())} style={{ letterSpacing: '.14em', fontWeight: 600, textAlign: 'center' }} />
      <div className="dim small" style={{ marginTop: 6 }}>{t('This app is invite-only — enter the code you were given.')}</div>
    </>}
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={go}>{t('Create passkey')}</Button>
  </>
}

/* Supabase build: sign up with name + email + password. */
export function SupaRegisterSheet({ close }) {
  const { setUser, pushState, pullState } = useStore()
  const nameRef = useRef(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 250) }, [])
  const go = async () => {
    const n = name.trim()
    if (!n) { useUI.getState().toast(t('Enter a name')); return }
    if (!/.+@.+\..+/.test(email.trim())) { useUI.getState().toast(t('Enter a valid email')); return }
    if (password.length < 8) { useUI.getState().toast(t('Password must be at least 8 characters')); return }
    if (busy) return
    setBusy(true)
    try {
      const res = await emailSignUp(n, email, password)
      if (res.needsConfirm) { close(); useUI.getState().toast(t('Check your email to confirm the account')) }
      else {
        setUser(res.user); close()
        if (hasData(useStore.getState().S)) { await pushState(); useUI.getState().toast(t('Profile created — data from this device moved into it')) }
        else { await pullState(); useUI.getState().toast(t('Welcome, {0}', res.user.name)) }
      }
    } catch (e) { useUI.getState().toast(e.message || t('Registration failed')) }
    setBusy(false)
  }
  return <>
    <h3>{t('Create your profile')}</h3>
    <div className="muted small" style={{ marginBottom: 14 }}>{t('An email and password keep your data synced between devices.')}</div>
    <form onSubmit={e => { e.preventDefault(); go() }}>
      <input ref={nameRef} className="input" placeholder={t('Your name')} maxLength={40} value={name} onChange={e => setName(e.target.value)} />
      <div style={{ height: 10 }} />
      <input className="input" type="email" inputMode="email" placeholder={t('Email')} value={email} onChange={e => setEmail(e.target.value)} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" placeholder={t('Password')} value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ height: 12 }} />
      <Button variant="primary" type="submit" disabled={busy}>{busy ? t('Creating…') : t('Create profile')}</Button>
    </form>
  </>
}

export default function Login() {
  const { setUser, pullState, setGuest } = useStore()
  const signIn = async () => {
    try { const u = await passkeyLogin(); setUser(u); await pullState(); useUI.getState().toast(t('Welcome back, {0}', u.name)) }
    catch (e) { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') useUI.getState().toast(e.message || t('Sign-in failed')) }
  }
  const head = <>
    <div style={{ fontSize: 54, display: 'flex', justifyContent: 'center', color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
    <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.028em', margin: '10px 0 4px' }}>openGym</h1>
  </>
  const wrap = { display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '78vh', textAlign: 'center' }

  // Demo build: no backend to sign in against — the only way in is the local guest profile.
  if (DEMO) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 30 }}>{t('Live demo — everything stays in this browser.')}</div>
      <Button variant="primary" icon="sparkles" onClick={() => setGuest(true)}>{t('Start the demo')}</Button>
      <div className="card small muted" style={{ textAlign: 'left', marginTop: 16 }}>
        {t('This demo runs entirely in your browser on example data — nothing is sent anywhere. Passkey sign-in and sync across your devices come with the openGym server, which you get by self-hosting it.')}
      </div>
      <div className="dim small" style={{ marginTop: 22, lineHeight: 1.6 }}>
        <a href={REPO} target="_blank" rel="noopener">{t('Self-host it in a minute →')}</a>
      </div>
    </div>
  )

  // Supabase build: email + password instead of WebAuthn.
  if (SUPA) return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts. Your weights. Your profile. Your data, synced.')}</div>
      <EmailLogin setUser={setUser} pullState={pullState} />
      <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <SupaRegisterSheet close={close} />)}>{t('Create new profile')}</Button>
      <div style={{ height: 10 }} />
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Your data syncs between every device you sign in on.')}</div>
    </div>
  )

  return (
    <div className="narrow" style={wrap}>
      {head}
      <div className="muted" style={{ marginBottom: 34 }}>{t('Your workouts. Your weights. Your profile.')}</div>
      {webauthnOK() ? <>
        <Button variant="primary" icon="person" onClick={signIn}>{t('Sign in with passkey')}</Button>
        <div style={{ height: 10 }} />
        <Button icon="sparkles" onClick={() => useUI.getState().openSheet(close => <RegisterSheet close={close} />)}>{t('Create new profile')}</Button>
        <div style={{ height: 10 }} />
      </> : <div className="card small muted" style={{ textAlign: 'left' }}>{t("This browser doesn't support passkeys — you can still use openGym locally on this device.")}</div>}
      <Button variant="ghost" className="dim" onClick={() => setGuest(true)}>{t('Continue without account')}</Button>
      <div className="dim small" style={{ marginTop: 26, lineHeight: 1.5 }}>{t('Passkeys use {0} — no passwords.', BIO)}<br />{t('Each profile keeps its own plan, workouts & body weight.')}</div>
    </div>
  )
}

function EmailLogin({ setUser, pullState }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async ev => {
    ev.preventDefault()
    if (busy) return
    if (!email.trim() || !password) { useUI.getState().toast(t('Enter your email and password')); return }
    setBusy(true)
    try {
      const u = await emailSignIn(email, password)
      setUser(u); await pullState()
      useUI.getState().toast(t('Welcome back, {0}', u.name))
    } catch (e) { useUI.getState().toast(e.message || t('Sign-in failed')) }
    setBusy(false)
  }
  return (
    <form onSubmit={go} style={{ maxWidth: 300, margin: '0 auto' }} className="card">
      <input className="input" type="email" inputMode="email" placeholder={t('Email')} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
      <div style={{ height: 10 }} />
      <input className="input" type="password" placeholder={t('Password')} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ height: 12 }} />
      <Button variant="primary" type="submit" disabled={busy}>{busy ? t('Signing in…') : t('Sign in')}</Button>
    </form>
  )
}
