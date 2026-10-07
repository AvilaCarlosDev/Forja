// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true, LEGAL: {},
}))
const { wantsVideo } = await import('./Auth.jsx')

const win = ({ reduce = false, saveData = false } = {}) => ({
  matchMedia: q => ({ matches: reduce && q.includes('reduce') }),
  navigator: { connection: { saveData } },
})

describe('login background video', () => {
  it('plays by default', () => { expect(wantsVideo(win())).toBe(true) })
  it('stays a still image for reduced motion or data saver', () => {
    expect(wantsVideo(win({ reduce: true }))).toBe(false)
    expect(wantsVideo(win({ saveData: true }))).toBe(false)
  })
})
