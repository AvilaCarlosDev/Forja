import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { applyDemoSession, blockedReason, SESSION_KEY, STATE_KEY } from './cargar.js'

function memory(init = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }
}
const demo = { [SESSION_KEY]: { access_token: 'preview', preview: true }, [STATE_KEY]: { sessions: [] }, gym_guest: 1 }

describe('cargador de sesiones demo (CN-004)', () => {
  it('no se publica: public/ no tiene el cargador ni las sesiones', () => {
    const pub = new URL('../public/', import.meta.url)
    expect(readdirSync(pub).filter(f => /^(cargar-sesiones|sesion-)/.test(f))).toEqual([])
    expect(existsSync(new URL('cargar-sesiones.html', pub))).toBe(false)
  })

  it('en un navegador vacío carga la sesión sin borrar otras claves', () => {
    const s = memory({ ajena: 'x' })
    applyDemoSession(s, demo)
    expect(JSON.parse(s.getItem(SESSION_KEY)).preview).toBe(true)
    expect(s.getItem('gym_guest')).toBe('1')
    expect(s.getItem('ajena')).toBe('x')
  })

  it('reemplaza otra sesión demo', () => {
    const s = memory({ [SESSION_KEY]: JSON.stringify({ access_token: 'preview', preview: true }), [STATE_KEY]: '{"viejo":1}' })
    applyDemoSession(s, demo)
    expect(JSON.parse(s.getItem(STATE_KEY))).toEqual({ sessions: [] })
  })

  it('se niega si hay una sesión real y no toca nada', () => {
    const real = JSON.stringify({ access_token: 'eyJ.real', refresh_token: 'r' })
    const s = memory({ [SESSION_KEY]: real, [STATE_KEY]: '{"mio":1}' })
    expect(blockedReason(s)).toMatch(/sesión real/)
    expect(() => applyDemoSession(s, demo)).toThrow(/sesión real/)
    expect(s.getItem(SESSION_KEY)).toBe(real)
    expect(s.getItem(STATE_KEY)).toBe('{"mio":1}')
  })

  it('se niega si hay entrenamientos de invitado sin sesión', () => {
    const s = memory({ [STATE_KEY]: '{"mio":1}' })
    expect(() => applyDemoSession(s, demo)).toThrow(/entrenamientos/)
    expect(s.getItem(STATE_KEY)).toBe('{"mio":1}')
  })

  it('rechaza un archivo que no es una sesión demo', () => {
    expect(() => applyDemoSession(memory(), { [SESSION_KEY]: { access_token: 'eyJ.real' } })).toThrow(/no es válida/)
  })
})
