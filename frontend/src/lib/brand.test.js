import { describe, it, expect } from 'vitest'
import { BRAND, brandText } from './brand.js'
import { t } from './i18n-core.js'

describe('brandText', () => {
  it('swaps the product name in prose', () => {
    expect(brandText('to install openGym as a full-screen app.')).toBe('to install Forja as a full-screen app.')
    expect(brandText('Made with openGym')).toBe('Made with Forja')
    expect(brandText("an answer that is not openGym's")).toBe("an answer that is not Forja's")
    expect(brandText('openGym, openGym.')).toBe('Forja, Forja.')
  })
  it('leaves real paths, file names and hosts alone', () => {
    expect(brandText('Saves a copy to Documents/openGym after')).toBe('Saves a copy to Documents/openGym after')
    expect(brandText('openGym.json')).toBe('openGym.json')
    expect(brandText('my-openGym-backup')).toBe('my-openGym-backup')
  })
  it('passes non-strings and unrelated text through', () => {
    expect(brandText('Routines')).toBe('Routines')
    expect(brandText(undefined)).toBe(undefined)
  })
})

describe('t() shows the brand', () => {
  it('on the English fallback, with arguments', () => {
    expect(t('Open openGym on {0}', 'your phone')).toBe(`Open ${BRAND} on your phone`)
  })
  it('does not rewrite what the caller passed in as an argument', () => {
    expect(t('File: {0}', 'openGym')).toBe('File: openGym')
  })
})
