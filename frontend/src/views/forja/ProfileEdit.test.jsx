// @vitest-environment happy-dom
// Forja: editar el perfil después del registro — datos, validaciones y gimnasio(s).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [], S: { body: null } }))
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ update: fn => fn(mocks.S) }) } }))

const { default: ProfileEdit } = await import('./ProfileEdit.jsx')
const session = await import('../../lib/forja-session.js')
const { todayISO } = await import('../../lib/forja-profile.js')

let host, root, onClose
async function start(role = 'client', patch = {}) {
  localStorage.clear()
  mocks.toasts.length = 0
  onClose = vi.fn()
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: 'preview', email: 'ana@example.com', name: 'Ana', sex: null, role } })
    await session.loadProfile()
    await session.updateProfile(patch)
  })
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<ProfileEdit row={session.getProfile().row} onClose={onClose} />) })
}
afterEach(() => { act(() => root.unmount()); host.remove() })

const $ = sel => host.querySelector(sel)
const byText = (tag, text) => [...host.querySelectorAll(tag)].find(e => e.textContent.trim().startsWith(text))
async function type(el, value) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const click = async el => { expect(el, 'element to click').toBeTruthy(); await act(async () => { el.click() }); await flush() }
const submit = async () => { await act(async () => { $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush() }
const yearsAgo = n => { const [y, m, d] = todayISO().split('-'); return `${Number(y) - n}-${m}-${d}` }
const row = () => session.getProfile().row
const previewDb = () => JSON.parse(localStorage.getItem('forja_preview_db_v1'))

describe('Forja — editar perfil (cliente)', () => {
  beforeEach(() => start('client', { name: 'Ana', sex: 'female', birth_date: '1995-05-20', gym_id: 'g-altitude' }))

  it('saves name, sex and birth date', async () => {
    await type($('#fj-pe-name'), 'Ana María')
    await click(byText('button', 'Hombre'))
    await type($('#fj-pe-birth'), '1996-03-15')
    await submit()
    expect(row()).toMatchObject({ name: 'Ana María', sex: 'male', birth_date: '1996-03-15' })
    expect(mocks.toasts).toContain('Perfil actualizado')
    expect(onClose).toHaveBeenCalled()
  })

  it('refuses anyone under 13 and keeps the row untouched', async () => {
    await type($('#fj-pe-birth'), yearsAgo(12))
    await submit()
    expect(host.textContent).toMatch('mayores de 13')
    expect(row().birth_date).toBe('1995-05-20')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('changes the gym', async () => {
    await flush()
    await click(byText('button', 'Gold Stars Gym · Sambil'))
    await submit()
    expect(row().gym_id).toBe('g-gs-sambil')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Forja — editar perfil (cliente sin gimnasio)', () => {
  beforeEach(() => start('client', { name: 'Ana', sex: 'female', birth_date: '1995-05-20', gym_id: null, remote: false }))

  it('needs a gym or the remote option', async () => {
    await submit()
    expect(host.textContent).toMatch('Elige tu gimnasio o marca que entrenas en casa')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Forja — editar perfil (campos vacíos)', () => {
  beforeEach(() => start('client', { name: '', sex: null, birth_date: '1995-05-20', gym_id: 'g-altitude' }))

  it('asks for name and sex before saving', async () => {
    await submit()
    expect(host.textContent).toMatch('Escribe tu nombre')
    expect(host.textContent).toMatch('Elige una opción')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Forja — editar perfil (entrenador)', () => {
  it('saves several gyms at once', async () => {
    await start('trainer', { name: 'Carlos', sex: 'male', birth_date: '1988-07-01' })
    await flush()
    await click(byText('button', 'Gold Stars Gym · Sambil'))
    await click(byText('button', 'New Life Training Center'))
    await submit()
    expect(previewDb().trainerGyms.preview).toEqual(['g-gs-sambil', 'g-nltc'])
    expect(onClose).toHaveBeenCalled()
  })

  it('needs at least one gym or the remote option', async () => {
    await start('trainer', { name: 'Carlos', sex: 'male', birth_date: '1988-07-01' })
    await flush()
    await submit()
    expect(host.textContent).toMatch('Elige al menos un gimnasio o marca que trabajas a distancia')
    expect(onClose).not.toHaveBeenCalled()
  })
})
