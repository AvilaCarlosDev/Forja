// @vitest-environment happy-dom
// Forja: completar el perfil, en modo vista previa (sin servidor). Datos → (tutor si es menor)
// → gimnasio → (si es cliente) entrenador.
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

const { default: Onboarding } = await import('./Onboarding.jsx')
const session = await import('../../lib/forja-session.js')
const { todayISO } = await import('../../lib/forja-profile.js')

let host, root
async function start(role) {
  localStorage.clear()
  mocks.toasts.length = 0
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: 'preview', email: 'ana@example.com', name: 'Ana', sex: null, role } })
    await session.loadProfile()
  })
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<Onboarding />) })
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

async function details(sex, birth) {
  await click(byText('button', sex))
  await type($('#fj-ob-birth_date'), birth)
  await submit()
}

describe('Forja onboarding', () => {
  beforeEach(() => start('client'))

  it('blocks until every field is valid', async () => {
    await submit()
    expect(host.textContent).toMatch('Elige una opción')
    expect(host.textContent).toMatch('Escribe tu fecha de nacimiento')
    expect(row().onboarded_at).toBeUndefined()
  })

  it('refuses anyone under 13', async () => {
    await details('Hombre', yearsAgo(12))
    expect(host.textContent).toMatch('mayores de 13')
  })

  it('a client picks a gym, then a trainer of that gym, and the request is sent', async () => {
    await details('Mujer', '1995-05-20')
    expect(host.textContent).toMatch('¿En qué gimnasio entrenas?')
    await click(byText('button', 'Continuar'))
    expect(host.textContent).toMatch('Elige tu gimnasio')
    await click(byText('button', 'Altitude'))
    await click(byText('button', 'Continuar'))
    expect(row().gym_id).toBe('g-altitude')

    expect(host.textContent).toMatch('¿Tienes entrenador personal?')
    await click(byText('button', 'Sí, tengo'))
    expect(host.textContent).toMatch('Carlos Medina (demo)')
    expect(host.textContent).not.toMatch('Andrea Rojas (demo)') // trabaja en otro gimnasio
    await click([...host.querySelectorAll('button')].find(b => b.textContent.includes('Carlos Medina (demo)')))
    await click(byText('button', 'Enviar solicitud'))
    expect(row().onboarded_at).toBeTruthy()
    const l = previewDb().links.find(x => x.client_id === 'preview')
    expect(l).toMatchObject({ trainer_id: 't-demo-2', status: 'pending' })
    expect(previewDb().notifications.some(n => n.user_id === 't-demo-2' && n.kind === 'link_request')).toBe(true)
  })

  it('a client without a trainer goes on with basic access', async () => {
    await details('Hombre', '1990-01-01')
    await click(byText('button', 'Entreno en casa o a distancia'))
    await click(byText('button', 'Continuar'))
    expect(row()).toMatchObject({ gym_id: null, remote: true })
    await click(byText('button', 'No tengo'))
    expect(host.textContent).toMatch('acceso básico')
    await click(byText('button', 'Continuar sin entrenador'))
    expect(row().onboarded_at).toBeTruthy()
  })

  it('"Otro" adds a missing gym with its Instagram and selects it', async () => {
    await details('Hombre', '1990-01-01')
    await click(byText('button', 'Otro'))
    expect($('[role=dialog]')).toBeTruthy()
    await type($('#fj-gym-name'), 'Gym del Barrio')
    await submit()
    expect(host.textContent).toMatch('red social o una foto del logo')
    await type($('#fj-gym-social'), '@gymdelbarrio')
    await act(async () => { $('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush()
    expect($('[role=dialog]')).toBeNull()
    const g = previewDb().gyms.find(x => x.name === 'Gym del Barrio')
    expect(g).toMatchObject({ social_url: 'https://www.instagram.com/gymdelbarrio/', verified: false })
    expect(host.textContent).toMatch('por verificar')
    await click(byText('button', 'Continuar'))
    expect(row().gym_id).toBe(g.id)
  })

  it('a 16-year-old needs a guardian, and the guardian step opens clean', async () => {
    await details('Hombre', yearsAgo(16))
    expect(host.textContent).toMatch('Permiso de tu tutor')
    expect(host.querySelector('.fj-err')).toBeNull()
    await submit()
    expect(host.textContent).toMatch('debe aceptar')
    await type($('#fj-gd-guardian_name'), 'María Pérez')
    await click(byText('button', 'Madre'))
    await type($('#fj-gd-guardian_email'), 'maria@example.com')
    await click($('#fj-gd-accept'))
    await submit()
    expect(row().guardian).toEqual({ user_id: 'preview', guardian_name: 'María Pérez', guardian_email: 'maria@example.com', relationship: 'madre' })
    expect(host.textContent).toMatch('¿En qué gimnasio entrenas?')
    expect(row().onboarded_at).toBeUndefined()
  })
})

describe('Forja onboarding — trainer', () => {
  beforeEach(() => start('trainer'))

  it('a trainer picks several gyms and finishes', async () => {
    await details('Hombre', '1988-07-01')
    expect(host.textContent).toMatch('Puedes elegir varios')
    await click(byText('button', 'Gold Stars Gym · Sambil'))
    await click(byText('button', 'New Life Training Center'))
    await click(byText('button', 'Continuar'))
    expect(previewDb().trainerGyms.preview).toEqual(['g-gs-sambil', 'g-nltc'])
    expect(row().onboarded_at).toBeTruthy()
    expect(host.textContent).not.toMatch('¿Tienes entrenador personal?')
  })
})

describe('Forja onboarding — cuenta creada con Google', () => {
  beforeEach(async () => {
    localStorage.clear(); mocks.toasts.length = 0
    localStorage.setItem('forja_preview_profile_v1', JSON.stringify({ id: 'preview', name: 'Ana Google', sex: null, role: 'client', role_chosen: false, plan: 'free' }))
    await act(async () => {
      session.setSession({ access_token: 'preview', preview: true, profile: { id: 'preview', email: 'ana@gmail.com', name: 'Ana Google', sex: null, role: 'client' } })
      await session.loadProfile()
    })
    host = document.createElement('div'); document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => { root.render(<Onboarding />) })
  })

  it('asks for the account type and the terms first, then goes on as a trainer', async () => {
    expect(host.textContent).toMatch('¿Cómo vas a usar Forja?')
    expect(host.textContent).toMatch('paso 1 de 4') // rol, datos, gimnasio y, si es cliente, entrenador
    await click(byText('button', 'Continuar'))
    expect(host.textContent).toMatch('Elige si eres Personal Trainer o Cliente')
    await click([...host.querySelectorAll('button')].find(b => b.textContent.includes('Personal Trainer')))
    await click(byText('button', 'Continuar'))
    expect(host.textContent).toMatch('Debes aceptar los términos')
    await click(host.querySelector('.fj-check input'))
    await click(byText('button', 'Continuar'))
    expect(row()).toMatchObject({ role: 'trainer', role_chosen: true })
    expect(host.textContent).toMatch('Tus datos')
    expect(host.textContent).toMatch('paso 2 de 3')
  })
})
