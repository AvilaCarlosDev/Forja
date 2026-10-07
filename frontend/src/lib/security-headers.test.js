// Forja: cabeceras de seguridad del despliegue en Vercel (frontend/vercel.json, CN-005).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const all = Object.fromEntries(vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]))
const csp = Object.fromEntries(all['Content-Security-Policy'].split(';').map(d => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]))

describe('cabeceras de seguridad (vercel.json)', () => {
  it('ninguna página puede incrustar la app', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(all['X-Frame-Options']).toBe('DENY')
  })

  it('solo corre código propio: nada en línea ni eval', () => {
    expect(csp['script-src']).toEqual(["'self'"])
    expect(csp['object-src']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'self'"])
  })

  it('index.html no tiene scripts en línea (los bloquearía la CSP)', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    expect(scripts.length).toBeGreaterThan(0)
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc=/)
      expect(body.trim()).toBe('')
    }
  })

  it('la app llega a Supabase y al CDN de imágenes', () => {
    expect(csp['connect-src'].some(o => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(o))).toBe(true)
    expect(csp['img-src']).toContain('https://cdn.jsdelivr.net')
    expect(csp['worker-src']).toEqual(["'self'"])
  })

  it('el resto de cabeceras', () => {
    expect(all['X-Content-Type-Options']).toBe('nosniff')
    expect(all['Referrer-Policy']).toBe('same-origin')
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d{8}/)
    expect(all['Permissions-Policy']).not.toMatch(/camera/) // el escáner y la foto del logo la usan
    expect(vercel.headers.find(h => h.source === '/sw.js').headers[0].value).toBe('no-cache')
  })
})
