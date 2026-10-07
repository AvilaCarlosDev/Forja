// @vitest-environment happy-dom
// Forja: completar el perfil, en modo vista previa (sin servidor). Un adulto termina en un paso;
// un menor tiene que pasar por el consentimiento de su madre, padre o tutor.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  localStorage.setItem('forja_session_v1', JSON.stringify({
    access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
    profile: { id: 'preview', email: 'ana@example.com', name: 'Ana', sex: null, role: 'client' },
  }))
  return { toasts: [], S: { body: null } }
})
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ update: fn => fn(mocks.S) }) } }))

const { default: Onboarding } = await import('./Onboarding.jsx')
const session = await import('../../lib/forja-session.js')
const { todayISO } = await import('../../lib/forja-profile.js')

let host, root
beforeEach(async () => {
  localStorage.removeItem('forja_preview_profile_v1')
  mocks.toasts.length = 0
  await act(async () => { await session.loadProfile() })
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<Onboarding />) })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const $ = sel => host.querySelector(sel)
const byText = (tag, text) => [...host.querySelectorAll(tag)].find(e => e.textContent.trim() === text)
async function type(el, value) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const click = async el => { await act(async () => { el.click() }) }
const submit = async () => { await act(async () => { $('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }) }
const yearsAgo = n => { const [y, m, d] = todayISO().split('-'); return `${Number(y) - n}-${m}-${d}` }

describe('Forja onboarding', () => {
  it('blocks until every field is valid', async () => {
    await submit()
    expect(host.textContent).toMatch('Elige una opción')
    expect(host.textContent).toMatch('Escribe tu fecha de nacimiento')
    expect(session.getProfile().row.onboarded_at).toBeUndefined()
  })

  it('an adult finishes in one step', async () => {
    await click(byText('button', 'Mujer'))
    await type($('#fj-ob-birth_date'), '1995-05-20')
    await submit()
    expect(session.getProfile().row.onboarded_at).toBeTruthy()
    expect(session.getProfile().row.birth_date).toBe('1995-05-20')
    expect(mocks.S.body).toBe('female')
  })

  it('refuses anyone under 13', async () => {
    await click(byText('button', 'Hombre'))
    await type($('#fj-ob-birth_date'), yearsAgo(12))
    await submit()
    expect(host.textContent).toMatch('mayores de 13')
    expect(session.getProfile().row.onboarded_at).toBeUndefined()
  })

  it('opens the guardian step clean, without errors, when Continuar is clicked', async () => {
    await click(byText('button', 'Hombre'))
    await type($('#fj-ob-birth_date'), yearsAgo(16))
    await click(byText('button', 'Continuar'))
    expect(host.textContent).toMatch('paso 2 de 2')
    expect(host.querySelector('.fj-err')).toBeNull()
  })

  it('a 16-year-old needs a guardian before finishing', async () => {
    await click(byText('button', 'Hombre'))
    await type($('#fj-ob-birth_date'), yearsAgo(16))
    expect(host.textContent).toMatch('te pediremos el permiso')
    await submit()
    expect(host.textContent).toMatch('paso 2 de 2')
    expect(session.getProfile().row.onboarded_at).toBeUndefined()

    await submit()
    expect(host.textContent).toMatch('debe aceptar')

    await type($('#fj-gd-guardian_name'), 'María Pérez')
    await click(byText('button', 'Madre'))
    await type($('#fj-gd-guardian_email'), 'maria@example.com')
    await click($('#fj-gd-accept'))
    await submit()
    const row = session.getProfile().row
    expect(row.onboarded_at).toBeTruthy()
    expect(row.guardian).toEqual({ user_id: 'preview', guardian_name: 'María Pérez', guardian_email: 'maria@example.com', relationship: 'madre' })
  })
})
