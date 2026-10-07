// Forja: capturas del README (PC e iPhone) sobre la vista previa local. Requiere la app en
// http://localhost:5179 (VITE_FORJA_AUTH_PREVIEW=1 npx vite --port 5179) y puppeteer-core con un
// Chromium del sistema: node scripts/forja-screenshots.mjs <carpeta-de-salida>
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5179/'
const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const DEVICES = {
  pc: { width: 1440, height: 900, deviceScaleFactor: 2 },
  movil: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}
const HIDE_PREVIEW = '.fj-note.warn{display:none!important}'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const session = (role, id, name) => ({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true, profile: { id, email: id + '@forja.app', name, sex: role === 'trainer' ? 'male' : 'female', role } })

async function page(browser, kind) {
  const p = await browser.newPage()
  await p.setViewport(DEVICES[kind])
  if (kind === 'movil') {
    await p.setUserAgent(IPHONE_UA)
    // Safari en iPhone no tiene el evento de instalación de Chrome; el Chromium que hace las capturas sí.
    await p.evaluateOnNewDocument(() => window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true))
  }
  await p.evaluateOnNewDocument(css => {
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) })
  }, HIDE_PREVIEW)
  return p
}
async function setState(p, entries) {
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.evaluate(e => { localStorage.clear(); for (const [k, v] of Object.entries(e)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) }, entries)
}
async function shot(p, name, path = '', wait = 1800) {
  await p.goto('about:blank')
  await p.goto(BASE + path, { waitUntil: 'networkidle2' })
  await sleep(wait)
  await p.screenshot({ path: `${OUT}/${name}.png` })
  console.log('ok', name)
}
const clickText = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(t)); b?.click(); return !!b }, text)

// Base de datos de la vista previa con un entrenador, sus clientes y medidas.
function db(trainerId) {
  const gyms = [
    { id: 'g-gs-sambil', name: 'Gold Stars Gym', branch: 'Sambil Paraguaná', address: 'Sambil Paraguaná, entrada Terrazas del Sambil', verified: true },
    { id: 'g-gs-virtudes', name: 'Gold Stars Gym', branch: 'Las Virtudes', address: 'C.C. Las Virtudes', verified: true },
    { id: 'g-gs-cdv', name: 'Gold Stars Gym', branch: 'Ciudad del Viento', address: 'C.C. Ciudad del Viento', verified: true },
    { id: 'g-altitude', name: 'Altitude', branch: null, address: 'C.C. Mediterráneo, Av. Ollarvides', verified: true },
    { id: 'g-nltc', name: 'New Life Training Center', branch: null, address: null, verified: true },
  ]
  const people = [
    { id: 't-demo-1', name: 'Andrea Rojas', role: 'trainer', remote: false, plan: 'free' },
    { id: 't-demo-2', name: 'Carlos Medina', role: 'trainer', remote: true, plan: 'pro' },
    { id: 't-demo-3', name: 'Luisa Pérez', role: 'trainer', remote: false, plan: 'free' },
    { id: 'c-demo-1', name: 'María González', role: 'client', sex: 'female', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', remote: false },
    { id: 'c-demo-2', name: 'José Rodríguez', role: 'client', sex: 'male', birth_date: '1990-08-02', gym_id: 'g-gs-sambil', remote: false },
    { id: 'c-demo-3', name: 'Daniela Pérez', role: 'client', sex: 'female', birth_date: '2001-11-20', gym_id: 'g-gs-sambil', remote: false },
    { id: 'c-demo-4', name: 'Luis Hernández', role: 'client', sex: 'male', birth_date: '1999-05-05', gym_id: 'g-gs-sambil', remote: false },
  ]
  const now = '2026-10-06T12:00:00Z'
  const links = [
    { id: 'l1', client_id: 'c-demo-1', trainer_id: trainerId, status: 'active', requested_at: '2026-07-01T10:00:00Z', decided_at: '2026-07-01T12:00:00Z' },
    { id: 'l2', client_id: 'c-demo-2', trainer_id: trainerId, status: 'active', requested_at: '2026-08-10T10:00:00Z', decided_at: '2026-08-10T12:00:00Z' },
    { id: 'l3', client_id: 'c-demo-3', trainer_id: trainerId, status: 'active', requested_at: '2026-09-01T10:00:00Z', decided_at: '2026-09-01T12:00:00Z' },
    { id: 'l4', client_id: 'c-demo-4', trainer_id: trainerId, status: 'pending', requested_at: '2026-10-06T09:00:00Z' },
  ]
  const m = (d, w, f, extra = {}) => ({ id: 'm' + d, client_id: 'c-demo-1', recorded_by: trainerId, measured_on: d, weight_kg: w, body_fat_pct: f, measurements: {}, created_at: d + 'T10:00:00Z', ...extra })
  return {
    gyms, people, trainerGyms: { [trainerId]: ['g-gs-sambil', 'g-gs-virtudes'], 't-demo-1': ['g-gs-sambil', 'g-gs-virtudes'], 't-demo-2': ['g-altitude'], 't-demo-3': ['g-nltc', 'g-gs-cdv'] },
    links, seededFor: trainerId,
    notifications: [
      { id: 'n1', user_id: trainerId, kind: 'link_request', link_id: 'l4', actor_id: 'c-demo-4', actor_name: 'Luis Hernández', created_at: '2026-10-06T09:00:00Z', read_at: null },
      { id: 'n2', user_id: trainerId, kind: 'link_request', link_id: 'l3', actor_id: 'c-demo-3', actor_name: 'Daniela Pérez', created_at: '2026-09-01T10:00:00Z', read_at: now },
    ],
    metrics: [
      m('2026-07-01', 72.4, 31.2, { height_cm: 164, visceral_fat: 7, muscle_mass_kg: 45.1, measurements: { waist: 84, hip: 104, arm: 31 }, note: 'Punto de partida' }),
      m('2026-08-01', 70.1, 29.4, { measurements: { waist: 81 } }),
      m('2026-09-01', 68.6, 27.9, { muscle_mass_kg: 46.0, measurements: { waist: 78, hip: 100 } }),
      m('2026-10-01', 67.2, 26.5, { visceral_fat: 6, muscle_mass_kg: 46.6, measurements: { waist: 76, hip: 99, arm: 30 } }),
    ],
    goals: { 'c-demo-1': { client_id: 'c-demo-1', goal: 'Bajar grasa y ganar fuerza para su primera carrera de 10K', target_weight_kg: 64, target_date: '2026-12-15' } },
  }
}

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
try {
  for (const kind of ['pc', 'movil']) {
    const p = await page(browser, kind)
    // 1. Entrar
    await setState(p, {})
    await shot(p, `${kind}-01-entrar`, '', 3500)
    // 2. Crear cuenta
    await clickText(p, 'Crear cuenta'); await sleep(1200)
    await p.screenshot({ path: `${OUT}/${kind}-02-crear-cuenta.png` }); console.log('ok', kind, 'crear cuenta')
    if (kind === 'movil') {
      await p.goto('about:blank'); await p.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(2000)
      const has = await p.evaluate(() => { const b = document.querySelector('.fj-install-link'); b?.click(); return !!b })
      console.log('enlace instalar:', has); await sleep(1200)
      await p.screenshot({ path: `${OUT}/movil-03-instalar.png` }); console.log('ok instalar')
    }
    // 3. Asistente: gimnasio
    await setState(p, {
      gym_guest: '1', forja_session_v1: session('client', 'yo', 'Valentina Ruiz'),
      forja_preview_profile_v1: { id: 'yo', name: 'Valentina Ruiz', sex: 'female', role: 'client', plan: 'free', birth_date: '1998-02-10' },
      forja_preview_db_v1: db('t-demo-1'),
    })
    await p.goto('about:blank'); await p.goto(BASE, { waitUntil: 'networkidle2' }); await sleep(1500)
    await clickText(p, 'Continuar'); await sleep(900)
    await p.screenshot({ path: `${OUT}/${kind}-04-gimnasio.png` }); console.log('ok gimnasio')
    await clickText(p, 'Sambil Paraguaná'); await sleep(300)
    await clickText(p, 'Continuar'); await sleep(900)
    await clickText(p, 'Sí, tengo'); await sleep(900)
    await clickText(p, 'Andrea Rojas'); await sleep(400)
    await p.screenshot({ path: `${OUT}/${kind}-05-entrenador.png` }); console.log('ok entrenador')
    // 4. Entrenador: Clientes y ficha
    await setState(p, {
      gym_guest: '1', forja_session_v1: session('trainer', 'coach', 'Ricardo Salas'),
      forja_preview_profile_v1: { id: 'coach', name: 'Ricardo Salas', sex: 'male', role: 'trainer', plan: 'pro', birth_date: '1989-06-01', onboarded_at: '2026-06-01T00:00:00Z' },
      forja_preview_db_v1: db('coach'),
    })
    await shot(p, `${kind}-06-clientes`, '#/clientes')
    await shot(p, `${kind}-07-ficha-cliente`, '#/clientes/c-demo-1')
    // 5. Cliente: Mi coach
    const d = db('t-demo-1'); d.links = [{ id: 'lx', client_id: 'c-demo-1', trainer_id: 't-demo-1', status: 'active', requested_at: '2026-07-01T10:00:00Z', decided_at: '2026-07-01T12:00:00Z' }]
    d.people.find(x => x.id === 't-demo-1').plan = 'pro'
    d.notifications = []
    await setState(p, {
      gym_guest: '1', forja_session_v1: session('client', 'c-demo-1', 'María González'),
      forja_preview_profile_v1: { id: 'c-demo-1', name: 'María González', sex: 'female', role: 'client', plan: 'free', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', onboarded_at: '2026-07-01T00:00:00Z' },
      forja_preview_db_v1: d,
    })
    await shot(p, `${kind}-08-mi-coach`, '#/mi-coach')
    await p.close()
  }
} finally { await browser.close() }
