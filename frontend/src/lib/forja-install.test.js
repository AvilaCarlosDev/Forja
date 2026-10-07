// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { platform, isStandalone, installMode, wasDismissed, dismiss } from './forja-install.js'

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
}

describe('platform', () => {
  it('tells Safari on iPhone from other iOS browsers', () => {
    expect(platform({ userAgent: UA.iphoneSafari })).toBe('ios-safari')
    expect(platform({ userAgent: UA.iphoneChrome })).toBe('ios-other')
  })
  it('recognises an iPad that says it is a Mac', () => {
    expect(platform({ userAgent: UA.ipad, maxTouchPoints: 5 })).toBe('ios-safari')
    expect(platform({ userAgent: UA.ipad, maxTouchPoints: 0 })).toBe('desktop')
  })
  it('knows Android and desktop', () => {
    expect(platform({ userAgent: UA.android })).toBe('android')
    expect(platform({ userAgent: UA.linux })).toBe('desktop')
  })
})

describe('isStandalone', () => {
  it('reads iOS home-screen mode and the display-mode query', () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true)
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) })).toBe(true)
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false)
  })
})

describe('installMode', () => {
  it('offers nothing once installed', () => {
    expect(installMode({ plat: 'android', standalone: true, canPrompt: true })).toBeNull()
  })
  it('prefers the native prompt, then Safari steps, then the browser menu', () => {
    expect(installMode({ plat: 'android', standalone: false, canPrompt: true })).toBe('prompt')
    expect(installMode({ plat: 'ios-safari', standalone: false, canPrompt: false })).toBe('ios')
    expect(installMode({ plat: 'ios-other', standalone: false, canPrompt: false })).toBe('ios-other')
    expect(installMode({ plat: 'android', standalone: false, canPrompt: false })).toBe('menu')
    expect(installMode({ plat: 'desktop', standalone: false, canPrompt: false })).toBeNull()
  })
  it('never offers it on a computer, even when Chrome could install', () => {
    expect(installMode({ plat: 'desktop', standalone: false, canPrompt: true })).toBeNull()
  })
})

describe('dismiss', () => {
  beforeEach(() => localStorage.clear())
  it('hides the banner for two weeks', () => {
    const t = Date.parse('2026-10-06T12:00:00Z')
    expect(wasDismissed(t)).toBe(false)
    dismiss(t)
    expect(wasDismissed(t + 13 * 864e5)).toBe(true)
    expect(wasDismissed(t + 15 * 864e5)).toBe(false)
  })
})
