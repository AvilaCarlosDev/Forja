// Forja: genera las dos sesiones demo (frontend/public/sesion-trainer.js y sesion-cliente.js)
// con datos completos para ver la app llena: rutinas, 12 semanas de entrenamientos y pesajes,
// medidas que avanzan, meta, mensualidades y pagos. Todo vive en el localStorage del navegador
// (modo vista previa); nada toca Supabase.
//
// Las fechas salen relativas al día en que se corre (el estado de pago depende del mes en curso),
// así que conviene volver a correrlo antes de una demo:
//   node scripts/forja-demo-sessions.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDemoState } from '../frontend/src/lib/demoSeed.js'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'public')
const TODAY = new Date(); TODAY.setHours(12, 0, 0, 0)
const iso = d => d.toISOString().slice(0, 10)
const daysAgo = n => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d }
const monthKey = d => iso(d).slice(0, 7)
const monthsAgo = n => { const d = new Date(TODAY); d.setDate(1); d.setMonth(d.getMonth() - n); return d }
const stamp = d => d.toISOString()
let seq = 0
const id = p => `${p}-${(++seq).toString(36).padStart(4, '0')}`

const GYMS = [
  { id: 'g-gs-sambil', name: 'Gold Stars Gym', branch: 'Sambil Paraguaná', address: 'Sambil Paraguaná, entrada Terrazas del Sambil', verified: true },
  { id: 'g-gs-virtudes', name: 'Gold Stars Gym', branch: 'Las Virtudes', address: 'C.C. Las Virtudes', verified: true },
  { id: 'g-gs-cdv', name: 'Gold Stars Gym', branch: 'Ciudad del Viento', address: 'C.C. Ciudad del Viento', verified: true },
  { id: 'g-altitude', name: 'Altitude', branch: null, address: 'C.C. Mediterráneo, Av. Ollarvides', verified: true },
  { id: 'g-nltc', name: 'New Life Training Center', branch: null, address: null, verified: true },
]
const TRAINERS = [
  { id: 't-demo-1', name: 'Andrea Rojas (demo)', role: 'trainer', remote: false, gyms: ['g-gs-sambil', 'g-gs-virtudes'], plan: 'free' },
  { id: 't-demo-2', name: 'Carlos Medina (demo)', role: 'trainer', remote: true, gyms: ['g-altitude'], plan: 'pro' },
  { id: 't-demo-3', name: 'Luisa Pérez (demo)', role: 'trainer', remote: false, gyms: ['g-nltc', 'g-gs-cdv'], plan: 'free' },
]
const trainerGyms = Object.fromEntries(TRAINERS.map(t => [t.id, t.gyms]))

// Una serie de medidas cada `every` días, de `from` a `to` con un poco de ruido determinista.
function series(clientId, by, { weeks, every = 14, from, to, height, girthsFrom, girthsTo, notes = {} }) {
  const rows = []
  const steps = Math.floor(weeks * 7 / every)
  for (let i = 0; i <= steps; i++) {
    const p = i / steps
    const wobble = Math.sin(i * 1.7) * 0.25
    const lerp = (a, b, k = 1) => Math.round((a + (b - a) * p + wobble * k) * 10) / 10
    const m = {}
    for (const k of Object.keys(girthsFrom)) m[k] = lerp(girthsFrom[k], girthsTo[k], 0.6)
    const day = daysAgo((steps - i) * every)
    const row = {
      id: id('m'), client_id: clientId, recorded_by: by, measured_on: iso(day),
      weight_kg: lerp(from.weight_kg, to.weight_kg),
      body_fat_pct: lerp(from.body_fat_pct, to.body_fat_pct),
      visceral_fat: Math.round(from.visceral_fat + (to.visceral_fat - from.visceral_fat) * p),
      muscle_mass_kg: lerp(from.muscle_mass_kg, to.muscle_mass_kg, 0.4),
      measurements: m, created_at: stamp(day),
    }
    if (i === 0) row.height_cm = height
    if (notes[i]) row.note = notes[i]
    rows.push(row)
  }
  return rows
}

// Un pago por mes, del más viejo al `lastAgo` (0 = mes en curso), cobrado el día 3–6.
function payments(clientId, trainerId, amount, firstAgo, lastAgo, methods) {
  const rows = []
  for (let n = firstAgo, i = 0; n >= lastAgo; n--, i++) {
    const m = monthsAgo(n)
    const paid = new Date(m); paid.setDate(3 + (i % 4))
    if (paid > TODAY) paid.setTime(TODAY.getTime())
    rows.push({ id: id('pay'), client_id: clientId, trainer_id: trainerId, amount, period: monthKey(m),
      paid_at: iso(paid), note: methods[i % methods.length], created_at: stamp(paid) })
  }
  return rows
}

// El historial de entrenamiento (rutinas, sesiones y pesajes) sale del perfil de ejemplo de la
// app; aquí se pasa a español y se ajusta a cada persona.
const ROUTINE_ES = { 'Push Day': 'Empuje · pecho, hombro y tríceps', 'Pull Day': 'Tirón · espalda y bíceps', 'Leg Day': 'Pierna y glúteo' }
function training({ loadScale = 1, bwFrom, bwTo, targetW, body }) {
  const s = buildDemoState()
  for (const r of s.routines) r.name = ROUTINE_ES[r.name] || r.name
  const names = Object.fromEntries(s.routines.map(r => [r.id, r.name]))
  const step = w => (w >= 20 ? 2.5 : 1)
  const scale = w => (w ? Math.max(step(w * loadScale), Math.round(w * loadScale / step(w * loadScale)) * step(w * loadScale)) : 0)
  for (const w of s.workouts) {
    w.name = names[w.routineId] || w.name
    for (const e of w.entries) { for (const set of e.sets) set.w = scale(set.w); e.topW = e.topW ? scale(e.topW) : null }
    w.vol = w.entries.reduce((v, e) => v + e.sets.reduce((n, x) => n + x.w * x.r, 0), 0)
  }
  for (const k of Object.keys(s.exWeights)) s.exWeights[k].w = scale(s.exWeights[k].w)
  const n = s.bodyweight.length
  s.bodyweight.forEach((b, i) => { b.w = Math.round((bwFrom + (bwTo - bwFrom) * (i / (n - 1)) + Math.sin(i * 2.3) * 0.3) * 10) / 10 })
  for (const w of s.workouts) w.bw = [...s.bodyweight].reverse().find(b => b.d <= w.d)?.w ?? bwFrom
  return { ...s, targetW, body, lang: 'es', langAuto: true, unit: 'kg', _ts: Date.now() }
}

function file(title, store) {
  const lines = [
    `// ${title} — pega esto en la consola (DevTools) de http://localhost:5180`,
    '// (borra la sesión preview actual de ese navegador)',
    `// Generado con scripts/forja-demo-sessions.mjs el ${iso(TODAY)}.`,
    'localStorage.clear();',
    ...Object.entries(store).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`),
    'location.reload();',
    '',
  ]
  return lines.join('\n')
}

// ---- Coach Demo: entrenador Pro en Gold Stars Sambil con cuatro clientes -----------------------
{
  const me = 'preview'
  const clients = [
    { id: 'c-demo-1', name: 'María Demo', role: 'client', sex: 'female', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', remote: false },
    { id: 'c-demo-2', name: 'José Demo', role: 'client', sex: 'male', birth_date: '1999-11-02', gym_id: 'g-gs-sambil', remote: false },
    { id: 'c-demo-3', name: 'Ana Demo', role: 'client', sex: 'female', birth_date: '1988-07-21', gym_id: 'g-gs-virtudes', remote: false },
    { id: 'c-demo-4', name: 'Pedro Demo', role: 'client', sex: 'male', birth_date: '2001-01-30', gym_id: 'g-gs-sambil', remote: false },
  ]
  const link = (c, ago, fee) => ({ id: id('l'), client_id: c, trainer_id: me, status: 'active',
    requested_at: stamp(daysAgo(ago + 1)), decided_at: stamp(daysAgo(ago)), monthly_fee: fee })
  const links = [
    link('c-demo-1', 84, 30),   // 12 semanas, al día
    link('c-demo-2', 56, 35),   // 8 semanas, le falta el mes en curso
    link('c-demo-3', 70, 25),   // 10 semanas, debe dos meses
    { id: id('l'), client_id: 'c-demo-4', trainer_id: me, status: 'pending', requested_at: stamp(daysAgo(1)) },
  ]
  const metrics = [
    ...series('c-demo-1', me, { weeks: 12, height: 162,
      from: { weight_kg: 72.4, body_fat_pct: 32.5, visceral_fat: 7, muscle_mass_kg: 25.1 },
      to: { weight_kg: 66.8, body_fat_pct: 27.6, visceral_fat: 5, muscle_mass_kg: 26.2 },
      girthsFrom: { waist: 82, hip: 104, arm: 30, thigh: 60 }, girthsTo: { waist: 75.5, hip: 99, arm: 29.5, thigh: 57 },
      notes: { 0: 'Evaluación inicial. Objetivo: bajar grasa sin perder fuerza.', 3: 'Buena adherencia; subimos cardio a 3 días.' } }),
    ...series('c-demo-2', me, { weeks: 8, height: 176,
      from: { weight_kg: 68.2, body_fat_pct: 14, visceral_fat: 3, muscle_mass_kg: 30.4 },
      to: { weight_kg: 71.6, body_fat_pct: 14.6, visceral_fat: 3, muscle_mass_kg: 32.5 },
      girthsFrom: { chest: 92, waist: 76, arm: 31, thigh: 52 }, girthsTo: { chest: 96, waist: 77, arm: 33.5, thigh: 55 },
      notes: { 0: 'Volumen limpio: superávit moderado.' } }),
    ...series('c-demo-3', me, { weeks: 10, every: 21, height: 158,
      from: { weight_kg: 79, body_fat_pct: 38, visceral_fat: 10, muscle_mass_kg: 22.8 },
      to: { weight_kg: 76.9, body_fat_pct: 36.4, visceral_fat: 9, muscle_mass_kg: 23 },
      girthsFrom: { waist: 94, hip: 112 }, girthsTo: { waist: 91, hip: 110 } }),
  ]
  const goals = {
    'c-demo-1': { client_id: 'c-demo-1', goal: 'Bajar a 63 kg y llegar a 25 % de grasa', target_weight_kg: 63, target_date: iso(daysAgo(-70)), updated_by: me, updated_at: stamp(daysAgo(84)) },
    'c-demo-2': { client_id: 'c-demo-2', goal: 'Ganar 5 kg de masa muscular', target_weight_kg: 74, target_date: iso(daysAgo(-90)), updated_by: me, updated_at: stamp(daysAgo(56)) },
    'c-demo-3': { client_id: 'c-demo-3', goal: 'Bajar la grasa visceral y la cintura', target_weight_kg: 72, target_date: iso(daysAgo(-120)), updated_by: me, updated_at: stamp(daysAgo(70)) },
  }
  const pays = [
    ...payments('c-demo-1', me, 30, 2, 0, ['Pago móvil BDV', 'Zelle', 'Pago móvil BDV']),
    ...payments('c-demo-2', me, 35, 1, 1, ['Efectivo USD']),
    ...payments('c-demo-3', me, 25, 2, 2, ['Binance']),
  ]
  const notifications = [
    { id: id('n'), user_id: me, kind: 'link_request', link_id: links[3].id, actor_id: 'c-demo-4', actor_name: 'Pedro Demo', created_at: stamp(daysAgo(1)), read_at: null },
  ]
  const profile = { id: me, name: 'Coach Demo', sex: 'male', role: 'trainer', plan: 'pro', birth_date: '1990-05-10', remote: false, onboarded_at: stamp(daysAgo(90)) }
  writeFileSync(join(out, 'sesion-trainer.js'), file('Coach Demo (entrenador Pro)', {
    forja_preview_db_v1: { gyms: GYMS, people: [...TRAINERS, ...clients], trainerGyms: { ...trainerGyms, [me]: ['g-gs-sambil', 'g-gs-virtudes'] },
      links, notifications, metrics, goals, payments: pays, seededFor: me },
    gym_guest: 1,
    forja_session_v1: { access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: me, email: 'coach@demo.forja', name: 'Coach Demo', sex: 'male', role: 'trainer' } },
    gym_state_v1: training({ bwFrom: 82.4, bwTo: 79.1, targetW: 78, body: 'male' }),
    forja_preview_profile_v1: profile,
  }))
}

// ---- Lucía Demo: clienta de Andrea (Pro) en Gold Stars Sambil, 12 semanas de avance ------------
{
  const me = 'preview', coach = 't-demo-1'
  const trainers = TRAINERS.map(t => (t.id === coach ? { ...t, plan: 'pro' } : t))
  const l = { id: id('l'), client_id: me, trainer_id: coach, status: 'active', requested_at: stamp(daysAgo(86)), decided_at: stamp(daysAgo(85)), monthly_fee: 30 }
  const metrics = series(me, coach, { weeks: 12, height: 165,
    from: { weight_kg: 68.5, body_fat_pct: 31, visceral_fat: 6, muscle_mass_kg: 24.6 },
    to: { weight_kg: 63.9, body_fat_pct: 26.8, visceral_fat: 4, muscle_mass_kg: 25.7 },
    girthsFrom: { waist: 79, hip: 102, arm: 29, thigh: 58, calf: 36 }, girthsTo: { waist: 72.5, hip: 97.5, arm: 28.5, thigh: 55, calf: 35.5 },
    notes: { 0: 'Evaluación inicial con bioimpedancia.', 4: 'Va excelente: -3 kg y la cintura bajando.' } })
  const goals = { [me]: { client_id: me, goal: 'Llegar a 62 kg y marcar abdomen', target_weight_kg: 62, target_date: iso(daysAgo(-60)), updated_by: coach, updated_at: stamp(daysAgo(85)) } }
  const notifications = [
    { id: id('n'), user_id: me, kind: 'link_accepted', link_id: l.id, actor_id: coach, actor_name: 'Andrea Rojas (demo)', created_at: stamp(daysAgo(85)), read_at: stamp(daysAgo(85)) },
  ]
  const profile = { id: me, name: 'Lucía Demo', sex: 'female', role: 'client', plan: 'free', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', remote: false, onboarded_at: stamp(daysAgo(86)) }
  writeFileSync(join(out, 'sesion-cliente.js'), file('Lucía Demo (clienta)', {
    forja_preview_db_v1: { gyms: GYMS, people: trainers, trainerGyms, links: [l], notifications, metrics, goals,
      payments: payments(me, coach, 30, 2, 0, ['Pago móvil Provincial', 'Pago móvil Provincial', 'Zelle']) },
    gym_guest: 1,
    forja_session_v1: { access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: me, email: 'lucia@demo.forja', name: 'Lucía Demo', sex: 'female', role: 'client' } },
    gym_state_v1: training({ loadScale: 0.55, bwFrom: 68.5, bwTo: 63.9, targetW: 62, body: 'female' }),
    forja_preview_profile_v1: profile,
  }))
}
console.log('listo: frontend/public/sesion-trainer.js y sesion-cliente.js')
