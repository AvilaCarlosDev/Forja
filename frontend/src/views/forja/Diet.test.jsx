// @vitest-environment happy-dom
// Forja: la dieta del cliente (Pro). El entrenador la arma con alimentos de la lista o propios
// y ve los totales contra el objetivo; el cliente la lee sin poder cambiarla; en Free no aparece.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ toasts: [] }))
vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: m => mocks.toasts.push(m) }) } }))

const { default: Diet } = await import('./Diet.jsx')
const session = await import('../../lib/forja-session.js')
const { api } = await import('../../lib/forja-api.js')

let host, root
async function start({ plan = 'pro', canEdit = true, pro = plan === 'pro', diet } = {}) {
  localStorage.clear()
  mocks.toasts.length = 0
  await act(async () => {
    session.setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: 'preview', email: 'coach@demo.forja', name: 'Coach Demo', sex: 'male', role: 'trainer' } })
    await session.loadProfile()
    await session.updateProfile({ role: 'trainer', plan })
    await api().listGyms()
    if (!localStorage.getItem('forja_preview_db_v1')) await api().setGoal('preview', {})
  })
  const d = JSON.parse(localStorage.getItem('forja_preview_db_v1'))
  d.links.push({ id: 'l-diet', client_id: 'c-demo-1', trainer_id: 'preview', status: 'active', requested_at: new Date().toISOString() })
  if (diet) d.diets = { 'c-demo-1': { client_id: 'c-demo-1', trainer_id: 'preview', updated_at: new Date().toISOString(), ...diet } }
  localStorage.setItem('forja_preview_db_v1', JSON.stringify(d))
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<Diet clientId="c-demo-1" clientName="María Demo" canEdit={canEdit} pro={pro} />) })
  await flush()
}
afterEach(() => { act(() => root.unmount()); host.remove() })

const $ = sel => document.querySelector(sel)
const byText = (tag, text) => [...document.querySelectorAll(tag)].find(e => e.textContent.trim().startsWith(text))
const withText = (sel, text) => [...document.querySelectorAll(sel)].find(e => e.textContent.includes(text))
async function type(el, value) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const click = async el => { expect(el, 'element to click').toBeTruthy(); await act(async () => { el.click() }); await flush() }
const submit = async () => { await act(async () => { $('[role=dialog] form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }); await flush() }
const saved = () => JSON.parse(localStorage.getItem('forja_preview_db_v1')).diets?.['c-demo-1']

const SAMPLE = {
  targets: { kcal: 1650, protein: 120 },
  meals: [{ name: 'Desayuno', time: '07:00', items: [{ food: 'huevo', name: 'Huevo entero', grams: 100, kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }] }],
  notes: '2 L de agua al día',
}

describe('Forja — dieta (entrenador Pro)', () => {
  it('builds a diet from the food list and a custom food, with live totals', async () => {
    await start()
    expect(document.body.textContent).toMatch('Todavía no tiene dieta')
    await click(byText('button', 'Armar dieta'))
    await type($('#fj-t-kcal'), '1650')
    // Desayuno: 2 huevos desde la grilla, con el botón de porción (agrega de una vez)
    await click(byText('button', '+ Agregar alimento'))
    expect(document.body.textContent).toMatch('Proteínas')
    await click(withText('.fj-food-btn', 'Huevo entero'))
    await click(withText('.fj-grams button', '100 g'))
    expect(document.body.textContent).toMatch('≈ 2 huevos')
    expect(document.body.textContent).toMatch('143 / 1650 kcal')
    // y un alimento propio, con las calorías calculadas por los macros
    await click(byText('button', '+ Agregar alimento'))
    await type($('#fj-food-q'), 'tequeño')
    expect(document.body.textContent).toMatch('No está en la lista')
    await click(byText('button', 'Alimento propio'))
    expect($('#fj-own-name').value).toBe('tequeño')
    await type($('#fj-own-g'), '40')
    await type($('#fj-own-protein'), '5')
    await type($('#fj-own-carbs'), '12')
    await type($('#fj-own-fat'), '6')
    await click(byText('button', 'Agregar'))
    await type($('#fj-diet-notes'), '2 L de agua al día')
    await submit()
    expect(mocks.toasts).toContain('Dieta guardada')
    const d = saved()
    expect(d.targets).toEqual({ kcal: 1650 })
    expect(d.meals[0].items.map(i => i.name)).toEqual(['Huevo entero', 'tequeño'])
    expect(d.meals[0].items[1]).toMatchObject({ food: null, grams: 40, kcal: 122 })
    expect(d.notes).toBe('2 L de agua al día')
    expect(document.body.textContent).toMatch('Indicaciones: 2 L de agua al día')
  })

  it('starts from a template, browses by category and types its own portion', async () => {
    await start()
    await click(byText('button', 'Armar dieta'))
    const sel = $('#fj-diet-tpl')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'volumen')
    await act(async () => { sel.dispatchEvent(new Event('change', { bubbles: true })) }); await flush()
    expect($('#fj-t-kcal').value).toBe('3300')
    expect([...document.querySelectorAll('[aria-label^="Nombre de la comida"]')].map(i => i.value)).toContain('Post-entreno')
    expect(mocks.toasts.at(-1)).toMatch('Plantilla cargada')
    // Frutas → piña con 120 g escritos a mano, en el desayuno
    await click(byText('button', '+ Agregar alimento'))
    await click(withText('[role=radiogroup] button', 'Frutas'))
    await click(withText('.fj-food-btn', 'Piña'))
    await type($('#fj-food-g'), '120')
    await click(withText('.fj-grams-own button', 'Agregar'))
    await submit()
    expect(saved().meals[0].items.at(-1)).toMatchObject({ food: 'pina', grams: 120, kcal: 60 })
    expect(saved().meals).toHaveLength(6)
  })

  it('edits and deletes an existing diet', async () => {
    await start({ diet: SAMPLE })
    expect(document.body.textContent).toMatch('Desayuno')
    expect(document.body.textContent).toMatch('143 / 1650 kcal')
    await click(byText('button', 'Editar'))
    await click(document.querySelector('[aria-label="Quitar Huevo entero"]'))
    await submit()
    expect(saved().meals[0].items).toEqual([])
    await click(byText('button', 'Borrar dieta'))
    expect(saved()).toBeUndefined()
    expect(document.body.textContent).toMatch('Todavía no tiene dieta')
  })
})

describe('Forja — dieta (cliente y plan Free)', () => {
  it('the client reads it and cannot edit', async () => {
    await start({ canEdit: false, diet: SAMPLE })
    expect(document.body.textContent).toMatch('solo lectura')
    expect(document.body.textContent).toMatch('Huevo entero')
    expect(byText('button', 'Editar')).toBeFalsy()
    expect(byText('button', 'Borrar dieta')).toBeFalsy()
  })

  it('with Free it shows the Pro door, and the preview api refuses to write like the database (0009)', async () => {
    await start({ plan: 'free', diet: SAMPLE })
    expect(document.body.textContent).toMatch('Las dietas son parte del plan Pro')
    expect(document.body.textContent).not.toMatch('Huevo entero')
    await act(async () => {
      await expect(api().setDiet('c-demo-1', SAMPLE)).rejects.toThrow('Pro')
      await expect(api().deleteDiet('c-demo-1')).rejects.toThrow('Pro')
    })
    expect(saved().notes).toBe('2 L de agua al día') // no se pierde al bajar a Free
  })

  it('only the active trainer of the client can write it', async () => {
    await start()
    await act(async () => {
      await expect(api().setDiet('c-demo-2', SAMPLE)).rejects.toThrow('vinculado')
    })
  })
})
