// @vitest-environment happy-dom
// Forja: la casilla de términos y privacidad es obligatoria al entrar y al crear cuenta, también
// para Google/Apple.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../lib/forja-config.js', () => ({
  SUPABASE_URL: '', SUPABASE_KEY: '', FORJA_AUTH: false, FORJA_AUTH_PREVIEW: true, FORJA_AUTH_UI: true,
  LEGAL: { terms: '#t', privacy: '#p' },
}))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: () => {} }) } }))
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ S: {}, update: () => {}, setGuest: () => {} }) } }))
vi.mock('../../lib/forja-session.js', async orig => ({
  ...(await orig()),
  auth: { providers: async () => ['google'], oauthUrl: p => 'https://auth.example/' + p },
}))

const { default: ForjaAuth } = await import('./Auth.jsx')

let host, root
beforeEach(async () => {
  localStorage.clear()
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<ForjaAuth />) })
  await flush()
})
afterEach(() => { document.removeEventListener('click', stop); act(() => root.unmount()); host.remove() })

const $ = sel => host.querySelector(sel)
const byText = (tag, text) => [...host.querySelectorAll(tag)].find(e => e.textContent.trim().startsWith(text))
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const click = async el => { expect(el, 'element to click').toBeTruthy(); await act(async () => { el.click() }); await flush() }
async function type(el, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const errors = () => [...host.querySelectorAll('.fj-err')].map(e => e.textContent)
// El clic en un enlace que nadie frena navegaría: lo registramos en vez de dejarlo salir. Se
// escucha en document, después de React (que atiende el clic en la raíz).
let stop
function trackNavigation(a) {
  const nav = { went: false }
  stop = e => { if (e.target.closest('a') === a) { if (!e.defaultPrevented) nav.went = true; e.preventDefault() } }
  document.addEventListener('click', stop)
  return nav
}

describe('términos y privacidad en «Entrar»', () => {
  it('la casilla está en la pantalla, sin marcar, con los enlaces', () => {
    const box = $('#fj-login-accept')
    expect(box).toBeTruthy()
    expect(box.checked).toBe(false)
    expect(box.closest('label').querySelector('a[href="#t"]').textContent).toBe('términos de uso')
    expect(box.closest('label').querySelector('a[href="#p"]').textContent).toBe('política de privacidad')
  })

  it('sin marcarla no deja entrar con correo', async () => {
    await type($('#fj-login-email'), 'ana@example.com')
    await type($('#fj-login-password'), 'secreta123')
    await click(byText('button', 'Entrar'))
    expect(errors()).toContain('Debes aceptar los términos y la política de privacidad')
    expect(document.activeElement).toBe($('#fj-login-accept'))
  })

  it('marcada, sigue al inicio de sesión', async () => {
    await type($('#fj-login-email'), 'ana@example.com')
    await type($('#fj-login-password'), 'secreta123')
    await click($('#fj-login-accept'))
    await click(byText('button', 'Entrar'))
    expect(errors().join()).not.toMatch(/términos/)
    expect(errors().join()).toMatch(/Vista previa/) // en la vista previa, el paso siguiente
  })

  it('Google no sale sin la casilla, y sí con ella', async () => {
    const google = $('.fj-oauth-btn.google')
    const nav = trackNavigation(google)
    await click(google)
    expect(nav.went).toBe(false)
    expect(errors()).toContain('Debes aceptar los términos y la política de privacidad')
    await click($('#fj-login-accept'))
    expect(errors()).toEqual([])
    await click(google)
    expect(nav.went).toBe(true)
  })
})

describe('términos y privacidad en «Crear cuenta»', () => {
  it('Google tampoco sale sin la casilla', async () => {
    await click(byText('button', 'Crear cuenta'))
    const google = $('.fj-oauth-btn.google')
    const nav = trackNavigation(google)
    await click(google)
    expect(nav.went).toBe(false)
    expect(errors()).toContain('Debes aceptar los términos y la política de privacidad')
    await click($('#fj-reg-accept'))
    await click(google)
    expect(nav.went).toBe(true)
  })
})
