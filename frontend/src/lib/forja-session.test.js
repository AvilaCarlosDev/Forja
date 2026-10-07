// @vitest-environment happy-dom
// Forja: el perfil propio se lee con forja_me(), porque de profiles solo se pueden leer las
// columnas públicas (0013, CN-003). Un select=* sobre la tabla lo rechazaría Supabase.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./forja-config.js', () => ({
  SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: 'anon', FORJA_AUTH: true, FORJA_AUTH_PREVIEW: false,
}))

const calls = []
const me = { id: 'u1', name: 'Ana', role: 'client', role_chosen: true, terms_accepted_at: '2026-10-01T00:00:00Z' }
vi.stubGlobal('fetch', async (url, init = {}) => {
  calls.push({ url, method: init.method || 'GET', body: init.body })
  const body = url.endsWith('/rpc/forja_me') ? me : url.includes('/profiles?') ? [{ id: 'u1' }] : null
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
})

const session = await import('./forja-session.js')

beforeEach(async () => {
  session.setSession({ access_token: 'tok', refresh_token: 'r', expires_at: 0, profile: { id: 'u1', name: 'Ana', role: 'client' } })
  await new Promise(r => setTimeout(r, 0)) // abrir la sesión ya carga el perfil por su cuenta
  calls.length = 0
})

describe('perfil propio (CN-003)', () => {
  it('se carga con forja_me(), no con select=* sobre profiles', async () => {
    const row = await session.loadProfile()
    expect(row).toEqual(me)
    expect(calls.map(c => c.method + ' ' + c.url)).toEqual(['POST https://x.supabase.co/rest/v1/rpc/forja_me'])
    expect(session.getProfile().row.terms_accepted_at).toBe(me.terms_accepted_at)
  })

  it('al editarlo pide de vuelta solo el id y relee la fila con forja_me()', async () => {
    const row = await session.updateProfile({ name: 'Ana María' })
    expect(calls.map(c => c.method + ' ' + c.url)).toEqual([
      'PATCH https://x.supabase.co/rest/v1/profiles?id=eq.u1&select=id',
      'POST https://x.supabase.co/rest/v1/rpc/forja_me',
    ])
    expect(JSON.parse(calls[0].body)).toEqual({ name: 'Ana María' })
    expect(row).toEqual(me)
  })

  it('ninguna llamada pide todas las columnas de profiles', async () => {
    await session.loadProfile()
    await session.updateProfile({ name: 'Ana' })
    expect(calls.filter(c => /\/profiles\?/.test(c.url) && !/select=id\b/.test(c.url))).toEqual([])
  })
})
