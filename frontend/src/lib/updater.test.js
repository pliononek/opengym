import { describe, it, expect } from 'vitest'
import { isNewerVersion } from './updater.js'

describe('isNewerVersion', () => {
  it('returns true when major version is higher', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true)
  })

  it('returns true when minor version is higher', () => {
    expect(isNewerVersion('1.3.0', '1.2.9')).toBe(true)
  })

  it('returns true when patch version is higher', () => {
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true)
  })

  it('returns false when remote version is equal', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
  })

  it('returns false when remote version is older', () => {
    expect(isNewerVersion('1.2.2', '1.2.3')).toBe(false)
    expect(isNewerVersion('1.1.9', '1.2.0')).toBe(false)
  })

  it('returns true when version is equal but remote buildTime is newer', () => {
    const localTime = '2026-09-22T10:00:00.000Z'
    const remoteTime = '2026-09-22T12:00:00.000Z'
    expect(isNewerVersion('1.2.3', '1.2.3', remoteTime, localTime)).toBe(true)
  })

  it('returns false when remote buildTime is older or identical', () => {
    const localTime = '2026-09-22T12:00:00.000Z'
    const remoteTime = '2026-09-22T10:00:00.000Z'
    expect(isNewerVersion('1.2.3', '1.2.3', remoteTime, localTime)).toBe(false)
  })

  it('handles falsy inputs safely', () => {
    expect(isNewerVersion(null, '1.2.3')).toBe(false)
    expect(isNewerVersion('1.2.3', null)).toBe(false)
    expect(isNewerVersion('', '')).toBe(false)
  })
})
