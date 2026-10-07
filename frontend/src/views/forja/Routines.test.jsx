// @vitest-environment happy-dom
// Forja: rutinas asignadas (0012). El coach arma la rutina con el buscador de ejercicios y le pone
// series, repeticiones y peso; al cliente le llega el aviso y la rutina entra a su plan de la
// semana, marcada para entrenarse tal cual (sin progresión automática) y sin poder editarla.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [], S: { routines: [], week: {} }, pick: null }))
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ S: mocks.S, update: fn => fn(mocks.S) }) } }))
// El buscador de openGym es una hoja aparte: aquí «elegir» es llamar a su callback.
vi.mock('../../sheets.jsx', () => ({ exercisePicker: onPick => { mocks.pick = onPick } }))

const { default: Routines } = await import('./Routines.jsx')
const { syncAssigned } = await import('./AssignedSync.jsx')
const session = await import('../../lib/forja-session.js')
const { api } = await import('../../lib/forja-api.js')

let host, root
afterEach(() => { act(() => root?.unmount()); host?.remove() })
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const $ = sel => document.querySelector(sel)
const byText = (tag, text) => [...document.querySelectorAll(tag)].find(e => e.textContent.trim().startsWith(text))
const click = async el => { expect(el, 'element to click').toBeTruthy(); await act(async () => { el.click() }); await flush() }
async function type(el, value) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const db = () => JSON.parse(localStorage.getItem('forja_preview_db_v1'))

async function as(role, id = 'preview') {
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id, email: role + '@demo.forja', name: role === 'trainer' ? 'Coach Demo' : 'María Demo', sex: 'female', role } })
    await session.loadProfile()
    await session.updateProfile({ role, plan: 'free' })
  })
}
async function render(el) {
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(el) }); await flush()
}

describe('Forja — rutinas asignadas', () => {
  it('a Free coach assigns a routine with sets, reps and weight; the client gets the notice', async () => {
    localStorage.clear(); mocks.toasts.length = 0
    await as('trainer')
    await act(async () => { await api().listGyms(); await api().setGoal('preview', {}) })
    const d = db(); d.links.push({ id: 'l1', client_id: 'c-demo-1', trainer_id: 'preview', status: 'active', requested_at: '2026-01-01T00:00:00Z' })
    localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
    await render(<Routines clientId="c-demo-1" clientName="María Demo" canEdit />)
    expect(document.body.textContent).toMatch('Todavía no tiene rutinas')

    await click(byText('button', 'Asignar rutina'))
    await type($('#fj-rt-name'), 'Pecho y tríceps')
    await click($('[aria-label="Lunes"]'))
    await click($('[aria-label="Jueves"]'))
    await click(byText('button', '+ Agregar ejercicio'))
    await act(async () => { mocks.pick({ id: '0025' }) }); await flush()
    await type($('[aria-label^="Peso de"]'), '40')
    await type($('[aria-label^="Repeticiones de"]'), '12')
    await type($('[aria-label^="Indicación para"]'), 'bajar lento')
    await act(async () => { [...document.querySelectorAll('[role=dialog] form')].at(-1).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush()

    expect(mocks.toasts).toContain('Rutina asignada a María Demo')
    const r = db().routines[0]
    expect(r).toMatchObject({ client_id: 'c-demo-1', name: 'Pecho y tríceps', days: [1, 4] })
    expect(r.exercises).toEqual([{ id: '0025', sets: 3, reps: 12, weight: 40, note: 'bajar lento' }])
    expect(db().notifications.find(n => n.user_id === 'c-demo-1' && n.kind === 'routine_assigned')).toBeTruthy()
    expect(document.body.textContent).toMatch('Pecho y tríceps')
    expect(document.body.textContent).toMatch('3 × 12 · 40 kg')
  })

  it('without a name or exercises it does not save', async () => {
    await render(<Routines clientId="c-demo-1" clientName="María Demo" canEdit />)
    await click(byText('button', 'Asignar rutina'))
    await act(async () => { [...document.querySelectorAll('[role=dialog] form')].at(-1).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush()
    expect(document.body.textContent).toMatch('Ponle un nombre a la rutina')
    expect(document.body.textContent).toMatch('Agrega al menos un ejercicio')
  })

  it('the client sees it read-only, and it lands in the week plan to train as prescribed', async () => {
    // misma base: la cliente María, vinculada con Coach Demo
    const d = db()
    d.people.push({ id: 'preview-coach', name: 'Coach Demo', role: 'trainer' })
    d.links = d.links.map(l => ({ ...l, client_id: 'preview', trainer_id: 'preview-coach' }))
    d.routines = d.routines.map(r => ({ ...r, client_id: 'preview', trainer_id: 'preview-coach' }))
    localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
    await as('client')
    await render(<Routines clientId="preview" canEdit={false} coachName="Coach Demo" />)
    expect(document.body.textContent).toMatch('Te las asignó Coach Demo')
    expect(byText('button', 'Asignar rutina')).toBeFalsy()
    expect(byText('button', 'Editar')).toBeFalsy()
    // tocar el ejercicio abre lo que indicó el coach
    await click($('.fj-ex-open'))
    expect(document.body.textContent).toMatch('Indicación del coach: bajar lento')

    mocks.S = { routines: [{ id: 'mine', name: 'Mía', ex: [] }], week: { 3: ['mine'] } }
    await act(async () => { await syncAssigned('preview') })
    const local = mocks.S.routines.find(r => r.id.startsWith('coach-'))
    expect(local).toMatchObject({ name: 'Pecho y tríceps', excludeFromProgression: true, assigned: { by: 'Coach Demo', days: [1, 4] } })
    expect(local.ex[0]).toMatchObject({ id: '0025', sets: 3, reps: 12, weight: 40 })
    expect(mocks.S.week).toEqual({ 1: [local.id], 3: ['mine'], 4: [local.id] })
  })
})
