// @vitest-environment happy-dom
// Forja: el lado del entrenador (solicitudes, clientes, medidas) y el del cliente vinculado
// (solo lectura), en modo vista previa.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [] }))
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))

const { ClientsHome, ClientDetail } = await import('./Clients.jsx')
const { default: MyCoach } = await import('./MyCoach.jsx')
const session = await import('../../lib/forja-session.js')
const { previewApi } = await import('../../lib/forja-api.js')

let host, root
const flush = () => act(async () => { for (let i = 0; i < 3; i++) await new Promise(r => setTimeout(r, 0)) })
async function start(role, url, profile = {}) {
  localStorage.clear(); mocks.toasts.length = 0
  await act(async () => {
    session.setSession({ access_token: 'preview', preview: true, profile: { id: 'preview', email: 'x@example.com', name: 'Yo', role } })
    await session.loadProfile()
    await session.updateProfile({ onboarded_at: '2026-10-06T00:00:00Z', ...profile })
  })
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
}
async function render(url) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}><Routes>
      <Route path="/clientes" element={<ClientsHome />} />
      <Route path="/clientes/:id" element={<ClientDetail />} />
      <Route path="/mi-coach" element={<MyCoach />} />
    </Routes></MemoryRouter>)
  })
  await flush()
}
afterEach(() => { act(() => root.unmount()); host.remove() })

const $ = sel => host.querySelector(sel)
const btn = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text))
const click = async el => { expect(el, 'element to click').toBeTruthy(); await act(async () => { el.click() }); await flush() }
async function type(el, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const db = () => JSON.parse(localStorage.getItem('forja_preview_db_v1'))

describe('trainer side', () => {
  it('gets the request as a notification, accepts it and sees the client with her history', async () => {
    await start('trainer')
    await act(async () => { await previewApi.setTrainerGyms(['g-gs-sambil'], false) }) // siembra la solicitud de María Demo
    await render('/clientes')
    expect(host.textContent).toMatch('María Demo quiere entrenar contigo')
    expect(host.textContent).toMatch('Solicitudes')
    await click(btn('Aceptar'))
    expect(mocks.toasts).toContain('Ahora entrenas a María Demo')
    expect(host.textContent).toMatch('Mis clientes')
    expect(host.textContent).toMatch('1 de 5 · plan Free')
    expect(db().notifications.some(n => n.user_id === 'c-demo-1' && n.kind === 'link_accepted')).toBe(true)

    await click([...host.querySelectorAll('button')].find(b => b.textContent.includes('María Demo')))
    await render('/clientes/c-demo-1')
    expect(host.textContent).toMatch('María Demo')
    // Lo que ella cargó antes de tener entrenador forma parte de su historial.
    expect(host.textContent).toMatch('Peso 64 kg')
    await click(btn('Nueva medición'))
    await type($('#fj-m-weight_kg'), '62,8')
    await type($('#fj-m-body_fat_pct'), '26')
    await act(async () => { $('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush()
    expect(host.textContent).toMatch('2 registros')
    expect(host.textContent).toMatch('Peso 62,8 kg')
    expect(db().metrics.find(m => m.weight_kg === 62.8)).toMatchObject({ client_id: 'c-demo-1', recorded_by: 'preview' })
  })

  it('cannot accept a sixth client on the Free plan', async () => {
    await start('trainer')
    await act(async () => { await previewApi.setTrainerGyms(['g-gs-sambil'], false) })
    const d = db()
    for (let i = 0; i < 5; i++) d.links.push({ id: 'a' + i, client_id: 'x' + i, trainer_id: 'preview', status: 'active', requested_at: '2026-10-01' })
    localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
    await render('/clientes')
    expect(host.textContent).toMatch('máximo del plan Free')
    expect(btn('Aceptar').disabled).toBe(true)
  })
})

describe('client side', () => {
  it('a client with a trainer sees the metrics read-only', async () => {
    await start('client', null, { gym_id: 'g-gs-sambil', sex: 'female' })
    await act(async () => { await previewApi.requestTrainer('t-demo-1') })
    const d = db(); const l = d.links.find(x => x.client_id === 'preview'); l.status = 'active'
    d.metrics.push({ id: 'm1', client_id: 'preview', recorded_by: 't-demo-1', measured_on: '2026-10-01', weight_kg: 70, measurements: {}, created_at: '2026-10-01' })
    localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
    await render('/mi-coach')
    expect(host.textContent).toMatch('Andrea Rojas (demo)')
    expect(host.textContent).toMatch('solo lectura')
    expect(host.textContent).toMatch('Peso 70 kg')
    expect(btn('Nueva medición')).toBeUndefined()
    await expect(previewApi.addMetric({ client_id: 'preview', measured_on: '2026-10-06', weight_kg: 60, measurements: {} })).rejects.toThrow(/permiso/)
  })

  it('a client without a trainer loads her own basics and can pick one', async () => {
    await start('client', null, { gym_id: 'g-gs-sambil', sex: 'female' })
    await render('/mi-coach')
    expect(host.textContent).toMatch('acceso básico')
    expect(btn('Nueva medición')).toBeTruthy()
    await click(btn('Elegir entrenador'))
    expect($('[role=dialog]').textContent).toMatch('Andrea Rojas (demo)')
  })
})
