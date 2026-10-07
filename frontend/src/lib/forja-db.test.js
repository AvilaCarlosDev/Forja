import { describe, it, expect } from 'vitest'
import { createDb, dbErrorMessage, eqQuery } from './forja-db.js'

const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) })

function fakeFetch(...replies) {
  const calls = []
  const f = async (url, init) => { calls.push({ url, init }); return replies.shift() }
  return { f, calls }
}

describe('eqQuery', () => {
  it('builds PostgREST equality filters', () => { expect(eqQuery({ id: 'a b', n: 1 })).toBe('id=eq.a%20b&n=eq.1') })
})

describe('dbErrorMessage', () => {
  it('passes through the Spanish messages of our SQL functions', () => {
    expect(dbErrorMessage(400, { code: '22023', message: 'Falta la fecha de nacimiento' })).toBe('Falta la fecha de nacimiento')
  })
  it('explains permission and session errors', () => {
    expect(dbErrorMessage(403, { code: '42501', message: 'permission denied for table profiles' })).toMatch(/permiso/)
    expect(dbErrorMessage(401, {})).toMatch(/sesión/)
  })
})

describe('createDb', () => {
  const opts = (f, token = 't1', refresh) => ({ url: 'https://x.supabase.co/', key: 'anon', getToken: () => token, refresh, fetch: f })

  it('reads one row with the session token and the public key', async () => {
    const { f, calls } = fakeFetch(reply(200, [{ id: 'u1', name: 'Ana' }]))
    const row = await createDb(opts(f)).one('profiles', { id: 'u1' })
    expect(row).toEqual({ id: 'u1', name: 'Ana' })
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/profiles?select=*&id=eq.u1&limit=1')
    expect(calls[0].init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer t1' })
  })

  it('patches and returns the new row', async () => {
    const { f, calls } = fakeFetch(reply(200, [{ id: 'u1', birth_date: '1995-05-20' }]))
    const row = await createDb(opts(f)).update('profiles', { id: 'u1' }, { birth_date: '1995-05-20' })
    expect(row.birth_date).toBe('1995-05-20')
    expect(calls[0].init.method).toBe('PATCH')
    expect(JSON.parse(calls[0].init.body)).toEqual({ birth_date: '1995-05-20' })
  })

  it('patches returning only the columns asked for', async () => {
    const { f, calls } = fakeFetch(reply(200, [{ id: 'u1' }]))
    expect(await createDb(opts(f)).update('profiles', { id: 'u1' }, { name: 'Ana' }, { select: 'id' })).toEqual({ id: 'u1' })
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/profiles?id=eq.u1&select=id')
  })

  it('upserts when asked', async () => {
    const { f, calls } = fakeFetch(reply(201, [{ user_id: 'u1' }]))
    await createDb(opts(f)).insert('guardian_consents', { user_id: 'u1' }, { upsert: true })
    expect(calls[0].init.headers.Prefer).toBe('return=representation,resolution=merge-duplicates')
  })

  it('calls SQL functions and surfaces their message', async () => {
    const { f } = fakeFetch(reply(400, { code: '22023', message: 'Falta el consentimiento de tu madre, padre o tutor' }))
    await expect(createDb(opts(f)).rpc('forja_finish_onboarding')).rejects.toThrow(/consentimiento/)
  })

  it('refreshes an expired token once and retries', async () => {
    let token = 'old'
    const { f, calls } = fakeFetch(reply(401, { code: 'PGRST301' }), reply(200, [{ id: 'u1' }]))
    const db = createDb({ ...opts(f), getToken: () => token, refresh: async () => { token = 'new'; return true } })
    expect(await db.one('profiles', { id: 'u1' })).toEqual({ id: 'u1' })
    expect(calls.map(c => c.init.headers.Authorization)).toEqual(['Bearer old', 'Bearer new'])
  })

  it('does not loop when the refresh fails', async () => {
    const { f, calls } = fakeFetch(reply(401, {}))
    await expect(createDb(opts(f, 't', async () => { throw new Error('x') })).one('profiles', { id: 'u1' })).rejects.toThrow(/sesión/)
    expect(calls).toHaveLength(1)
  })

  it('uploads files raw, without JSON encoding', async () => {
    const { f, calls } = fakeFetch(reply(200, { Key: 'avatars/u1/a.webp' }))
    const blob = new Blob(['x'], { type: 'image/webp' })
    await createDb(opts(f)).upload('avatars', 'u1/a.webp', blob, 'image/webp')
    expect(calls[0].url).toBe('https://x.supabase.co/storage/v1/object/avatars/u1/a.webp')
    expect(calls[0].init.body).toBe(blob)
    expect(calls[0].init.headers['Content-Type']).toBe('image/webp')
  })

  it('turns a signed path into a full URL', async () => {
    const { f } = fakeFetch(reply(200, { signedURL: '/object/sign/avatars/u1/a.webp?token=abc' }))
    expect(await createDb(opts(f)).signedUrl('avatars', 'u1/a.webp'))
      .toBe('https://x.supabase.co/storage/v1/object/sign/avatars/u1/a.webp?token=abc')
  })

  it('reports a network failure in Spanish', async () => {
    const db = createDb(opts(async () => { throw new TypeError('Failed to fetch') }))
    await expect(db.select('profiles')).rejects.toThrow(/Sin conexión/)
  })
})
