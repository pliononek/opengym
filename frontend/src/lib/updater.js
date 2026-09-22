import { create } from 'zustand'
import { useStore } from '../store/useStore.js'
import { t } from './i18n.js'
import { MOBILE } from './mobile.js'

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.3'
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''

/**
 * Compare two semver strings or timestamps.
 * Returns true if remote is newer than local.
 */
export function isNewerVersion(remote, local, remoteBuildTime, localBuildTime) {
  if (!remote || !local) return false
  const rParts = remote.split('.').map(n => parseInt(n, 10) || 0)
  const lParts = local.split('.').map(n => parseInt(n, 10) || 0)

  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0
    const l = lParts[i] || 0
    if (r > l) return true
    if (r < l) return false
  }

  // If versions are equal, compare build timestamps if provided
  if (remoteBuildTime && localBuildTime) {
    try {
      const rTime = new Date(remoteBuildTime).getTime()
      const lTime = new Date(localBuildTime).getTime()
      if (!isNaN(rTime) && !isNaN(lTime) && rTime > lTime + 5000) {
        return true
      }
    } catch {
      /* ignore */
    }
  }

  return false
}

export const useUpdater = create((set, get) => ({
  currentVersion: APP_VERSION,
  buildTime: BUILD_TIME,
  availableUpdate: null, // { version, buildTime }
  checking: false,
  lastChecked: null,
  dismissed: false,

  setDismissed: v => set({ dismissed: v }),

  async checkForUpdate({ manual = false, toast } = {}) {
    // In Capacitor native shell, web asset hot-updates are handled differently
    if (MOBILE) {
      if (manual && toast) toast(t('App is up to date'))
      return { isNewer: false }
    }

    set({ checking: true })

    try {
      // Trigger Service Worker update check if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {})
      }

      // Fetch version.json directly with cache-busting
      const res = await fetch(`version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const remoteVersion = data?.version
      const remoteBuild = data?.buildTime

      const isNewer = isNewerVersion(remoteVersion, get().currentVersion, remoteBuild, get().buildTime)

      set({ checking: false, lastChecked: Date.now() })

      if (isNewer) {
        const updateInfo = { version: remoteVersion, buildTime: remoteBuild }
        const autoUpdate = useStore.getState().S.autoUpdate !== false
        const activeWorkout = !!useStore.getState().S.active

        // If auto-update is enabled AND no active workout is in progress, apply automatically
        if (autoUpdate && !activeWorkout && !manual) {
          console.log('[Updater] Auto-updating application to version', remoteVersion)
          get().applyUpdate()
          return { isNewer: true, autoUpdated: true, version: remoteVersion }
        }

        set({ availableUpdate: updateInfo, dismissed: false })
        if (manual && toast) {
          toast(t('New version {0} is available!', remoteVersion))
        }
        return { isNewer: true, autoUpdated: false, version: remoteVersion }
      } else {
        set({ availableUpdate: null })
        if (manual && toast) {
          toast(t('App is up to date'))
        }
        return { isNewer: false }
      }
    } catch (err) {
      console.warn('[Updater] Could not check for updates:', err)
      set({ checking: false })
      if (manual && toast) {
        toast(t('Could not check for updates'))
      }
      return { isNewer: false, error: err }
    }
  },

  applyUpdate() {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      }
    } catch {
      /* ignore */
    }

    // Clear runtime cache key if supported
    if ('caches' in window) {
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(k => k.startsWith('opengym-rt-')).map(k => caches.delete(k))
        )
      }).catch(() => {})
    }

    // Reload with cache bypass
    setTimeout(() => {
      window.location.reload()
    }, 150)
  }
}))

let initialized = false

/**
 * Initialize updater listeners and background polling.
 */
export function initUpdater() {
  if (initialized || MOBILE || typeof window === 'undefined') return
  initialized = true

  const updater = useUpdater.getState()

  // First check 3 seconds after boot
  setTimeout(() => {
    updater.checkForUpdate()
  }, 3000)

  // Re-check when window gains focus or tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const last = updater.lastChecked
      // Check at most once every 10 minutes on focus
      if (!last || Date.now() - last > 10 * 60 * 1000) {
        updater.checkForUpdate()
      }
    }
  })

  // Re-check every 30 minutes in background
  setInterval(() => {
    updater.checkForUpdate()
  }, 30 * 60 * 1000)

  // Listen for Service Worker update found
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (installing) {
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              const autoUpdate = useStore.getState().S.autoUpdate !== false
              const activeWorkout = !!useStore.getState().S.active
              if (autoUpdate && !activeWorkout) {
                updater.applyUpdate()
              } else {
                updater.checkForUpdate()
              }
            }
          })
        }
      })
    }).catch(() => {})
  }
}
