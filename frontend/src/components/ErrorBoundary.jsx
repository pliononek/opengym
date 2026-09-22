import { Component } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

/**
 * Last line of defence: one bad render used to blank the whole app, with no way back —
 * a workout referencing an exercise the build doesn't know would white-screen and, since
 * the running workout is persisted, do it again on every reload.
 *
 * Sits inside #app so the tab bar stays usable; the shell keys this subtree on the route,
 * so switching tabs re-mounts it and clears the error by itself.
 */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false, error: null } }
  static getDerivedStateFromError(error) { return { failed: true, error } }
  componentDidCatch(err) { console.error('openGym render error:', err) }

  render() {
    if (!this.state.failed) return this.props.children
    const active = useStore.getState().S.active
    return (
      <div className="narrow">
        <div className="empty" style={{ marginTop: '18vh' }}>
          <div className="ico"><Icon name="info" /></div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('Something went wrong')}</div>
          {t('This screen could not be drawn. Your data is safe on this device.')}
          {this.state.error && (
            <details style={{ marginTop: 14, textAlign: 'left' }}>
              <summary className="small dim" style={{ cursor: 'pointer', textAlign: 'center' }}>
                {t('Technical details')}
              </summary>
              <pre style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--sep)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--red)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {String(this.state.error?.message || this.state.error)}
              </pre>
            </details>
          )}
        </div>
        <Button variant="primary" icon="reset" onClick={() => location.reload()}>{t('Reload openGym')}</Button>
        {active && <>
          <div style={{ height: 8 }} />
          <Button variant="danger" icon="trash" onClick={() => {
            useStore.getState().update(s => { s.active = null })
            location.reload()
          }}>{t('Discard the running workout')}</Button>
        </>}
      </div>
    )
  }
}
