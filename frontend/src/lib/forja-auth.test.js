// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  ROLES, SEXES, validateSignup, signupBody, parseAuthHash, profileFromUser, errorMessage,
  createAuth, loadSession, saveSession, SESSION_KEY,
} from './forja-auth.js'

const good = { name: 'Ana Pérez', email: 'ana@example.com', password: 'secreto123', password2: 'secreto123', sex: 'female', role: 'trainer', accept: true }

describe('validateSignup', () => {
  it('accepts a complete form', () => { expect(validateSignup(good)).toEqual({}) })
  it('requires every field', () => {
    expect(Object.keys(validateSignup({})).sort()).toEqual(['accept', 'email', 'name', 'password', 'role', 'sex'])
  })
  it('rejects a malformed e-mail', () => {
    expect(validateSignup({ ...good, email: 'ana@' }).email).toBeTruthy()
    expect(validateSignup({ ...good, email: 'ana example.com' }).email).toBeTruthy()
  })
  it('wants 8 characters and a matching repeat', () => {
    expect(validateSignup({ ...good, password: 'corta', password2: 'corta' }).password).toBeTruthy()
    expect(validateSignup({ ...good, password2: 'otra-cosa' }).password2).toBeTruthy()
  })
  it('only knows the two roles and the two sexes', () => {
    expect(ROLES).toEqual(['trainer', 'client']); expect(SEXES).toEqual(['male', 'female'])
    expect(validateSignup({ ...good, role: 'admin' }).role).toBeTruthy()
    expect(validateSignup({ ...good, sex: 'x' }).sex).toBeTruthy()
  })
  it('does not go ahead without the terms', () => { expect(validateSignup({ ...good, accept: false }).accept).toBeTruthy() })
})

describe('signupBody', () => {
  it('sends the profile as user metadata and never a plan', () => {
    const b = signupBody({ ...good, email: '  Ana@Example.com ', name: '  Ana Pérez ' })
    expect(b).toEqual({ email: 'ana@example.com', password: 'secreto123', data: { name: 'Ana Pérez', sex: 'female', role: 'trainer' } })
    expect(JSON.stringify(b)).not.toMatch(/plan/)
  })
})

describe('parseAuthHash', () => {
  it('reads the tokens of a confirmation link', () => {
    expect(parseAuthHash('#access_token=AAA&refresh_token=RRR&expires_in=3600&token_type=bearer&type=signup'))
      .toMatchObject({ access_token: 'AAA', refresh_token: 'RRR', type: 'signup', expires_in: 3600 })
  })
  it('reads an error link', () => {
    expect(parseAuthHash('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ error: 'Email link is invalid or has expired' })
  })
  it('leaves the app routes alone', () => {
    expect(parseAuthHash('#/plan')).toBe(null); expect(parseAuthHash('')).toBe(null); expect(parseAuthHash('#/x?access_token=1')).toBe(null)
  })
})

describe('profileFromUser', () => {
  it('takes name, sex and role from the metadata', () => {
    expect(profileFromUser({ id: 'u1', email: 'a@b.co', user_metadata: { name: 'Ana', sex: 'female', role: 'trainer' } }))
      .toEqual({ id: 'u1', email: 'a@b.co', name: 'Ana', sex: 'female', role: 'trainer' })
  })
  it('falls back to a client with no sex rather than inventing one', () => {
    expect(profileFromUser({ id: 'u2', email: 'c@d.co', user_metadata: { role: 'root' } }))
      .toEqual({ id: 'u2', email: 'c@d.co', name: 'c', sex: null, role: 'client' })
  })
})

describe('errorMessage', () => {
  it('names the usual failures in plain words', () => {
    expect(errorMessage({ error_code: 'invalid_credentials' })).toMatch(/correo o contraseña/i)
    expect(errorMessage({ error_code: 'email_not_confirmed' })).toMatch(/confirma/i)
    expect(errorMessage({ error_code: 'user_already_exists' })).toMatch(/ya existe/i)
    expect(errorMessage({ msg: 'User already registered' })).toMatch(/ya existe/i)
    expect(errorMessage({ error_code: 'over_email_send_rate_limit' })).toMatch(/espera/i)
    expect(errorMessage({ error_code: 'weak_password' })).toMatch(/contraseña/i)
  })
  it('never shows an empty message', () => { expect(errorMessage({})).toBeTruthy(); expect(errorMessage(null)).toBeTruthy() })
})

describe('session storage', () => {
  beforeEach(() => localStorage.clear())
  it('round-trips and survives garbage', () => {
    expect(loadSession()).toBe(null)
    saveSession({ access_token: 'A', refresh_token: 'R', expires_at: 99, profile: { id: 'u' } })
    expect(loadSession()).toMatchObject({ access_token: 'A', profile: { id: 'u' } })
    localStorage.setItem(SESSION_KEY, '{nope'); expect(loadSession()).toBe(null)
    saveSession(null); expect(localStorage.getItem(SESSION_KEY)).toBe(null)
  })
})

describe('createAuth', () => {
  const user = { id: 'u1', email: 'ana@example.com', user_metadata: { name: 'Ana', sex: 'female', role: 'trainer' } }
  const mk = answers => {
    const calls = []
    const fetch = async (url, init) => {
      calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null })
      const a = answers.shift()
      return { ok: a.status < 400, status: a.status, json: async () => a.body }
    }
    return { calls, auth: createAuth({ url: 'https://x.supabase.co/', key: 'ANON', fetch, now: () => 1000_000 }) }
  }
  beforeEach(() => localStorage.clear())

  it('signs up against /auth/v1/signup with the anon key and asks for a confirmation', async () => {
    const { calls, auth } = mk([{ status: 200, body: { id: 'u1', email: 'ana@example.com', user_metadata: user.user_metadata } }])
    const r = await auth.signUp(good, 'https://forja.app/')
    expect(calls[0].url).toBe('https://x.supabase.co/auth/v1/signup?redirect_to=' + encodeURIComponent('https://forja.app/'))
    expect(calls[0].init.headers.apikey).toBe('ANON')
    expect(calls[0].body.data).toEqual({ name: 'Ana Pérez', sex: 'female', role: 'trainer' })
    expect(r).toEqual({ needsConfirmation: true, email: 'ana@example.com' })
    expect(loadSession()).toBe(null)
  })
  it('is signed in at once where the project does not confirm e-mails', async () => {
    const { auth } = mk([{ status: 200, body: { access_token: 'A', refresh_token: 'R', expires_in: 3600, user } }])
    const r = await auth.signUp(good)
    expect(r.session.profile.role).toBe('trainer')
    expect(loadSession()).toMatchObject({ access_token: 'A', expires_at: 1000 + 3600 })
  })
  it('signs in with the password grant and keeps the session', async () => {
    const { calls, auth } = mk([{ status: 200, body: { access_token: 'A', refresh_token: 'R', expires_in: 3600, user } }])
    const s = await auth.signIn(' Ana@Example.com ', 'secreto123')
    expect(calls[0].url).toBe('https://x.supabase.co/auth/v1/token?grant_type=password')
    expect(calls[0].body).toEqual({ email: 'ana@example.com', password: 'secreto123' })
    expect(s.profile).toEqual({ id: 'u1', email: 'ana@example.com', name: 'Ana', sex: 'female', role: 'trainer' })
  })
  it('turns a refusal into a readable error and stores nothing', async () => {
    const { auth } = mk([{ status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }])
    await expect(auth.signIn('ana@example.com', 'mala')).rejects.toThrow(/correo o contraseña/i)
    expect(loadSession()).toBe(null)
  })
  it('asks for a recovery mail', async () => {
    const { calls, auth } = mk([{ status: 200, body: {} }])
    await auth.recover('ana@example.com', 'https://forja.app/')
    expect(calls[0].url).toBe('https://x.supabase.co/auth/v1/recover?redirect_to=' + encodeURIComponent('https://forja.app/'))
    expect(calls[0].body).toEqual({ email: 'ana@example.com' })
  })
  it('adopts the tokens of a mail link by asking who they belong to', async () => {
    const { calls, auth } = mk([{ status: 200, body: user }])
    const s = await auth.adopt({ access_token: 'A', refresh_token: 'R', expires_in: 3600, type: 'signup' })
    expect(calls[0].url).toBe('https://x.supabase.co/auth/v1/user')
    expect(calls[0].init.headers.Authorization).toBe('Bearer A')
    expect(s.profile.name).toBe('Ana'); expect(loadSession().refresh_token).toBe('R')
  })
  it('sets a new password with the session of a recovery link', async () => {
    const { calls, auth } = mk([{ status: 200, body: user }])
    saveSession({ access_token: 'A', refresh_token: 'R', expires_at: 2000, profile: {} })
    await auth.setPassword('nuevaClave99')
    expect(calls[0].init.method).toBe('PUT'); expect(calls[0].body).toEqual({ password: 'nuevaClave99' })
  })
  it('signs out locally even when the server cannot be reached', async () => {
    const auth = createAuth({ url: 'https://x.supabase.co', key: 'ANON', fetch: async () => { throw new Error('offline') }, now: () => 0 })
    saveSession({ access_token: 'A', refresh_token: 'R', expires_at: 2000, profile: {} })
    await auth.signOut(); expect(loadSession()).toBe(null)
  })
  it('says so when the network is down', async () => {
    const auth = createAuth({ url: 'https://x.supabase.co', key: 'ANON', fetch: async () => { throw new TypeError('Failed to fetch') }, now: () => 0 })
    await expect(auth.signIn('ana@example.com', 'secreto123')).rejects.toThrow(/conexión/i)
  })
})
