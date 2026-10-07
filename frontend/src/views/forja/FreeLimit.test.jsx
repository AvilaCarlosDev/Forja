// @vitest-environment happy-dom
// Forja: al vencer Pro, el entrenador ve solo sus 5 clientes más antiguos (0011), en cualquier
// gimnasio, con un aviso para renovar que lleva al WhatsApp de los planes.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: () => {} }) } }))

const { ClientsHome } = await import('./Clients.jsx')
const session = await import('../../lib/forja-session.js')
const { api } = await import('../../lib/forja-api.js')

let host, root
afterEach(() => { act(() => root.unmount()); host.remove() })
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

async function start(plan, plan_expires_at = null) {
  localStorage.clear()
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: 'preview', email: 'coach@demo.forja', name: 'Coach Demo', sex: 'male', role: 'trainer' } })
    await session.loadProfile()
    await session.updateProfile({ role: 'trainer', plan, plan_expires_at })
    await api().listGyms()
    if (!localStorage.getItem('forja_preview_db_v1')) await api().setGoal('preview', {})
  })
  const d = JSON.parse(localStorage.getItem('forja_preview_db_v1'))
  for (let i = 1; i <= 7; i++) {
    d.people.push({ id: 'c-' + i, name: 'Cliente ' + i, role: 'client', gym_id: i % 2 ? 'g-gs-sambil' : 'g-altitude' })
    d.links.push({ id: 'l-' + i, client_id: 'c-' + i, trainer_id: 'preview', status: 'active',
      requested_at: `2026-0${i}-01T00:00:00Z`, decided_at: `2026-0${i}-02T00:00:00Z` })
  }
  d.trainerGyms.preview = ['g-gs-sambil', 'g-altitude']
  localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter><ClientsHome /></MemoryRouter>) })
  await flush()
}

it('with Pro the trainer sees all 7 clients and no warning', async () => {
  await start('pro')
  expect((await api().myLinks()).filter(l => l.status === 'active')).toHaveLength(7)
  expect(host.textContent).not.toMatch('Tu plan Pro venció')
})

it('when Pro expires only the 5 oldest stay visible, whatever the gym, and renewing goes to WhatsApp', async () => {
  await start('pro', '2026-01-01T00:00:00Z')
  const visible = (await api().myLinks()).filter(l => l.status === 'active').map(l => l.client_id).sort()
  expect(visible).toEqual(['c-1', 'c-2', 'c-3', 'c-4', 'c-5'])
  expect(await api().hiddenClients()).toBe(2)
  expect(host.textContent).toMatch('Tu plan Pro venció')
  expect(host.textContent).toMatch('otros 2 quedan ocultos')
  // «Estoy en… Todos» tampoco los muestra
  const sel = host.querySelector('#fj-here')
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'all')
  await act(async () => { sel.dispatchEvent(new Event('change', { bubbles: true })) }); await flush()
  expect(host.textContent).not.toMatch('Cliente 6')
  await act(async () => { [...host.querySelectorAll('button')].find(b => b.textContent === 'Renovar Pro').click() }); await flush()
  const wa = document.querySelector('a[href^="https://wa.me/13464919344"]')
  expect(wa).toBeTruthy()
  expect(decodeURIComponent(wa.href)).toMatch('quiero activar el plan Pro')
})
