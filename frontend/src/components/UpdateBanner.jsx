import { useUpdater } from '../lib/updater.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function UpdateBanner() {
  const availableUpdate = useUpdater(s => s.availableUpdate)
  const dismissed = useUpdater(s => s.dismissed)
  const setDismissed = useUpdater(s => s.setDismissed)
  const applyUpdate = useUpdater(s => s.applyUpdate)

  if (!availableUpdate || dismissed) return null

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        background: 'var(--surface-3, #242426)',
        borderBottom: '1px solid var(--acc, #30d158)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}
    >
      <div className="row" style={{ gap: 10, flex: 1, minWidth: 0, alignItems: 'center' }}>
        <span style={{ color: 'var(--acc)', fontSize: 18, flex: 'none', display: 'flex' }}>
          <Icon name="sparkles" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--label)' }}>
            {t('New version {0} is available', availableUpdate.version)}
          </div>
          <div className="small dim" style={{ fontSize: 12 }}>
            {t('Update to get the latest features and fixes.')}
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flex: 'none' }}>
        <Button
          size="sm"
          variant="primary"
          onClick={() => applyUpdate()}
          style={{ padding: '4px 12px', fontSize: 13 }}
        >
          {t('Update now')}
        </Button>
        <button
          type="button"
          className="iconbtn dim"
          style={{ width: 28, height: 28, fontSize: 14 }}
          onClick={() => setDismissed(true)}
          title={t('Later')}
          aria-label={t('Later')}
        >
          <Icon name="x" />
        </button>
      </div>
    </div>
  )
}
