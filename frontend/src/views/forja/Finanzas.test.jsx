// @vitest-environment happy-dom
// Forja: finanzas del entrenador (Pro) — resumen del mes, mensualidad por cliente y
// registro/borrado de pagos en vista previa. El plan Free ve solo la puerta Pro.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [] }))
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))

const { default: Finanzas } = await import('./Finanzas.jsx')
const session = await import('../../lib/forja-session.js')
const { api } = await import('../../lib/forja-api.js')

let host, root
async function start(plan = 'pro', fee = 30) {
  localStorage.clear()
  mocks.toasts.length = 0
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: 'preview', email: 'coach@demo.forja', name: 'Coach Demo', sex: 'male', role: 'trainer' } })
    await session.loadProfile()
    await session.updateProfile({ role: 'trainer', plan })
  })
  await act(async () => {
    await api().listGyms()
    // load() siembra el db en memoria; la primera mutación lo persiste.
    if (!localStorage.getItem('forja_preview_db_v1')) await api().setGoal('preview', {})
  })
  const d = JSON.parse(localStorage.getItem('forja_preview_db_v1'))
  d.links.push({ id: 'l-fin', client_id: 'c-demo-1', trainer_id: 'preview', status: 'active',
    requested_at: new Date().toISOString(), monthly_fee: fee })
  localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MemoryRouter initialEntries={['/finanzas']}><Finanzas /></MemoryRouter>) })
  await flush()
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
const submitPanel = async () => { await act(async () => { $('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush() }
const previewDb = () => JSON.parse(localStorage.getItem('forja_preview_db_v1'))

describe('Forja — finanzas (entrenador Pro)', () => {
  beforeEach(() => start('pro', 30))

  it('shows the month summary and each client with their status', async () => {
    expect(host.textContent).toMatch('Cobrado en')
    expect(host.textContent).toMatch('Por cobrar')
    expect(host.textContent).toMatch('$30 / mes')
    expect(host.textContent).toMatch('María Demo')
    expect(host.textContent).toMatch('Pendiente')
    expect(host.textContent).not.toMatch('Función Pro')
  })

  it('sets the monthly fee and registers a payment', async () => {
    await click(byText('button', 'Mensualidad'))
    await type($('#fj-fin-fee'), '35')
    await click(byText('button', 'Guardar'))
    expect(mocks.toasts).toContain('Mensualidad guardada')
    expect(host.textContent).toMatch('$35 / mes')

    await click(byText('button', 'Registrar pago'))
    expect($('#fj-fin-amount').value).toBe('35') // arranca con la mensualidad del cliente
    await submitPanel()
    expect(mocks.toasts).toContain('Pago registrado')
    expect(host.textContent).toMatch('Al día')
    expect(previewDb().payments).toHaveLength(1)
    expect(previewDb().payments[0]).toMatchObject({ client_id: 'c-demo-1', amount: 35, period: new Date().toISOString().slice(0, 7) })
  })

  it('registers a payment without a fee if the amount is written', async () => {
    await start('pro', null)
    await click(byText('button', 'Registrar pago'))
    await submitPanel()
    expect(host.textContent).toMatch('Escribe un monto')
    await type($('#fj-fin-amount'), '20')
    await submitPanel()
    expect(previewDb().payments[0].amount).toBe(20)
    expect(host.textContent).toMatch('Al día')
  })

  it('lists the payments of a client and deletes one', async () => {
    await click(byText('button', 'Registrar pago'))
    await submitPanel()
    expect(mocks.toasts).toContain('Pago registrado')

    await click(byText('button', 'Pagos'))
    expect(host.textContent).toMatch('María Demo')
    expect(host.textContent).toMatch('pagado el')
    await click(byText('button', 'Borrar'))
    expect(mocks.toasts).toContain('Pago eliminado')
    expect(previewDb().payments).toHaveLength(0)
    expect(host.textContent).toMatch('Todavía no registras pagos')
  })

  it('only the trainer of the link can register its payments', async () => {
    await click(byText('button', 'Registrar pago'))
    await type($('#fj-fin-amount'), '10')
    await submitPanel()
    expect(mocks.toasts).toContain('Pago registrado')
    const d = previewDb()
    d.links[0].trainer_id = 'someone-else'
    localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
    await act(async () => {
      await expect(api().registerPayment({ client: 'c-demo-1', amount: 10, period: '2026-10', paid_at: '2026-10-07' }))
        .rejects.toThrow('vinculado')
    })
  })
})

describe('Forja — finanzas (plan Free)', () => {
  beforeEach(() => start('free', 30))

  it('shows the Pro door instead of the dashboard', async () => {
    expect(host.textContent).toMatch('Función Pro')
    expect(host.textContent).toMatch('plan Pro')
    expect(host.textContent).not.toMatch('María Demo')
    expect(host.textContent).not.toMatch('Registrar pago')
  })
})
