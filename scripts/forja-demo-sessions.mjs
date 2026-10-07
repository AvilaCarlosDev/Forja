// Forja: genera las dos sesiones demo (frontend/public/sesion-trainer.js y sesion-cliente.js)
// con datos completos para ver la app llena: rutinas, 12 semanas de entrenamientos y pesajes,
// medidas que avanzan, meta, dieta, mensualidades y pagos. Todo vive en el localStorage del navegador
// (modo vista previa); nada toca Supabase.
//
// Las fechas salen relativas al día en que se corre (el estado de pago depende del mes en curso),
// así que conviene volver a correrlo antes de una demo:
//   node scripts/forja-demo-sessions.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDemoState } from '../frontend/src/lib/demoSeed.js'
import { foodById, itemFromFood } from '../frontend/src/lib/forja-diet.js'
import { toLocalRoutine } from '../frontend/src/lib/forja-routines.js'

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

// Una serie de medidas cada `every` días durante `weeks` semanas, como las carga un entrenador:
// el cambio es rápido al principio y se frena después (`ease`), con un rebote a mitad de camino
// (`bump`: kg que se recuperan, por ejemplo unas vacaciones) y el vaivén normal de semana a semana.
// Los perímetros se toman cada dos mediciones.
function series(clientId, by, { weeks, every = 7, ease = 2.2, bump = 0, bumpAt = 0.55, from, to, height, girthsFrom, girthsTo, notes = {} }) {
  const rows = []
  const steps = Math.floor(weeks * 7 / every)
  const curve = p => (1 - Math.exp(-ease * p)) / (1 - Math.exp(-ease))
  for (let i = 0; i <= steps; i++) {
    const p = i / steps, f = curve(p)
    const hump = Math.exp(-(((p - bumpAt) / 0.09) ** 2))      // 0..1 alrededor del rebote
    const noise = Math.sin(i * 2.31) * 0.6 + Math.sin(i * 0.87 + 1) * 0.4
    const towards = (a, b) => a + (b - a) * f
    const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
    const day = daysAgo((steps - i) * every)
    const dir = Math.sign(to.weight_kg - from.weight_kg) || 1
    const row = {
      id: id('m'), client_id: clientId, recorded_by: by, measured_on: iso(day),
      weight_kg: r(towards(from.weight_kg, to.weight_kg) - dir * bump * hump + noise * 0.35),
      body_fat_pct: r(towards(from.body_fat_pct, to.body_fat_pct) + (to.body_fat_pct < from.body_fat_pct ? 1 : -1) * bump * 0.4 * hump + noise * 0.25),
      visceral_fat: Math.round(towards(from.visceral_fat, to.visceral_fat)),
      muscle_mass_kg: r(towards(from.muscle_mass_kg, to.muscle_mass_kg) + noise * 0.12),
      measurements: {}, created_at: stamp(day),
    }
    if (i % 2 === 0 || i === steps) for (const k of Object.keys(girthsFrom)) row.measurements[k] = r(towards(girthsFrom[k], girthsTo[k]) + noise * 0.3)
    if (i === 0) row.height_cm = height
    if (notes[i] || notes[i - steps - 1]) row.note = notes[i] || notes[i - steps - 1]   // índice negativo = desde el final
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

// Una dieta: [[comida, hora, [[alimento, gramos], …]], …]; la arma `trainer`.
function diet(clientId, trainer, targets, meals, notes, ago = 20) {
  return { client_id: clientId, trainer_id: trainer, targets, notes, updated_at: stamp(daysAgo(ago)),
    meals: meals.map(([name, time, items]) => ({ name, time, items: items.map(([f, g]) => itemFromFood(foodById(f), g)) })) }
}
const CUT_F = [   // déficit para ella, ~1.700 kcal
  ['Desayuno', '07:00', [['huevo', 100], ['arepa', 90], ['queso-blanco', 30], ['cafe', 240]]],
  ['Merienda', '10:00', [['yogur-griego', 170], ['fresas', 150]]],
  ['Almuerzo', '13:00', [['pollo', 130], ['arroz', 120], ['caraotas', 85], ['ensalada', 150], ['aceite-oliva', 7]]],
  ['Merienda', '16:30', [['manzana', 180], ['almendras', 18]]],
  ['Cena', '19:30', [['pescado', 150], ['batata', 150], ['brocoli', 155]]],
]

// El historial de entrenamiento (rutinas, sesiones y pesajes) sale del perfil de ejemplo de la
// app; aquí se pasa a español y se ajusta a cada persona.
const ROUTINE_ES = { 'Push Day': 'Empuje · pecho, hombro y tríceps', 'Pull Day': 'Tirón · espalda y bíceps', 'Leg Day': 'Pierna y glúteo' }
function training({ weeks = 12, loadScale = 1, bwFrom, bwTo, targetW, body }) {
  const s = buildDemoState(weeks)
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

// Las rutinas de un historial como rutinas que asignó un coach (0012): mismos días y ejercicios,
// con el peso que el cliente viene levantando. `adopt` las deja además en su app, ya sincronizadas.
function assignedFrom(st, clientId, trainerId, coachName, adopt = false) {
  const daysOf = id => Object.entries(st.week).filter(([, v]) => [].concat(v).includes(id)).map(([d]) => Number(d))
  const rows = st.routines.map(r => ({ id: id('rt'), client_id: clientId, trainer_id: trainerId, name: r.name, days: daysOf(r.id),
    exercises: r.ex.map(e => ({ id: e.id, sets: e.sets, reps: e.reps, weight: st.exWeights[e.id]?.w || 0 })),
    note: 'Calienta 10 minutos antes de empezar.', created_at: stamp(daysAgo(60)), updated_at: stamp(daysAgo(3)), from: r.id }))
  if (adopt) {
    const local = Object.fromEntries(rows.map(r => [r.from, toLocalRoutine(r, coachName)]))
    for (const w of st.workouts) if (local[w.routineId]) w.routineId = local[w.routineId].id
    st.routines = Object.values(local)
    st.week = {}
    for (const r of st.routines) for (const d of r.assigned.days) st.week[d] = [...(st.week[d] || []), r.id]
  }
  return rows.map(({ from, ...r }) => r)
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
    link('c-demo-1', 26 * 7, 30),   // 6 meses, al día
    link('c-demo-2', 16 * 7, 35),   // 4 meses, le falta el mes en curso
    link('c-demo-3', 20 * 7, 25),   // 5 meses, debe dos meses
    { id: id('l'), client_id: 'c-demo-4', trainer_id: me, status: 'pending', requested_at: stamp(daysAgo(1)) },
  ]
  const metrics = [
    // María: 6 meses bajando grasa, con un rebote a mitad de camino
    ...series('c-demo-1', me, { weeks: 26, height: 162, bump: 1.1,
      from: { weight_kg: 72.4, body_fat_pct: 32.5, visceral_fat: 7, muscle_mass_kg: 25.1 },
      to: { weight_kg: 64.6, body_fat_pct: 26.1, visceral_fat: 4, muscle_mass_kg: 26.4 },
      girthsFrom: { waist: 82, hip: 104, arm: 30, thigh: 60 }, girthsTo: { waist: 72.5, hip: 97, arm: 29, thigh: 55.5 },
      notes: { 0: 'Evaluación inicial. Objetivo: bajar grasa sin perder fuerza.', 4: 'Buena adherencia; subimos cardio a 3 días.',
        14: 'Volvió de vacaciones con +1 kg. Retomamos el plan sin cambios.', '-1': 'Muy bien: −7,8 kg en 6 meses. Pasamos a mantenimiento activo.' } }),
    // José: 4 meses de volumen limpio, subiendo músculo
    ...series('c-demo-2', me, { weeks: 16, height: 176, ease: 0.6,
      from: { weight_kg: 66.5, body_fat_pct: 13.8, visceral_fat: 3, muscle_mass_kg: 29.8 },
      to: { weight_kg: 71.9, body_fat_pct: 14.9, visceral_fat: 3, muscle_mass_kg: 33.1 },
      girthsFrom: { chest: 91, waist: 75.5, arm: 30.5, thigh: 51.5 }, girthsTo: { chest: 97, waist: 77.5, arm: 34, thigh: 56 },
      notes: { 0: 'Volumen limpio: superávit moderado.', 8: 'Sube bien. Ajustamos +200 kcal en días de pierna.' } }),
    // Ana: 5 meses con altibajos (falta a entrenar y debe dos meses)
    ...series('c-demo-3', me, { weeks: 20, every: 14, height: 158, ease: 1.2, bump: 1.6, bumpAt: 0.7,
      from: { weight_kg: 81, body_fat_pct: 38.4, visceral_fat: 11, muscle_mass_kg: 22.6 },
      to: { weight_kg: 77.2, body_fat_pct: 36, visceral_fat: 9, muscle_mass_kg: 23.1 },
      girthsFrom: { waist: 95, hip: 113 }, girthsTo: { waist: 90.5, hip: 109.5 },
      notes: { 7: 'Faltó tres semanas. Hay que retomar la constancia.' } }),
  ]

  const goals = {
    'c-demo-1': { client_id: 'c-demo-1', goal: 'Bajar a 63 kg y llegar a 25 % de grasa', target_weight_kg: 63, target_date: iso(daysAgo(-70)), updated_by: me, updated_at: stamp(daysAgo(84)) },
    'c-demo-2': { client_id: 'c-demo-2', goal: 'Ganar 5 kg de masa muscular', target_weight_kg: 74, target_date: iso(daysAgo(-90)), updated_by: me, updated_at: stamp(daysAgo(56)) },
    'c-demo-3': { client_id: 'c-demo-3', goal: 'Bajar la grasa visceral y la cintura', target_weight_kg: 72, target_date: iso(daysAgo(-120)), updated_by: me, updated_at: stamp(daysAgo(70)) },
  }
  const pays = [
    ...payments('c-demo-1', me, 30, 5, 0, ['Pago móvil BDV', 'Zelle', 'Pago móvil BDV', 'Efectivo USD']),
    ...payments('c-demo-2', me, 35, 3, 1, ['Efectivo USD', 'Binance']),
    ...payments('c-demo-3', me, 25, 4, 2, ['Binance']),
  ]
  const diets = {
    'c-demo-1': diet('c-demo-1', me, { kcal: 1700, protein: 135, carbs: 185, fat: 45 }, CUT_F,
      '2 L de agua al día. Café sin azúcar. Una comida libre el domingo.'),
    'c-demo-2': diet('c-demo-2', me, { kcal: 3300, protein: 200, carbs: 420, fat: 90 }, [
      ['Desayuno', '06:30', [['avena', 60], ['leche-entera', 240], ['cambur', 120], ['mani', 16]]],
      ['Merienda', '10:00', [['arepa', 90], ['huevo', 100], ['queso-blanco', 30]]],
      ['Almuerzo', '13:00', [['carne-molida', 150], ['arroz', 240], ['caraotas', 170], ['platano', 100]]],
      ['Pre-entreno', '16:30', [['pan-integral', 60], ['mani', 16], ['cambur', 120]]],
      ['Post-entreno', '19:00', [['whey', 30], ['leche-desc', 240]]],
      ['Cena', '20:30', [['pollo', 180], ['pasta', 210], ['vegetales', 150], ['aceite-oliva', 7]]],
    ], 'Superávit moderado. Si el peso no sube en 2 semanas, agregar ½ taza de arroz al almuerzo.', 12),
  }
  const routines = [
    ...assignedFrom(training({ weeks: 2, loadScale: 0.55, bwFrom: 70, bwTo: 70, body: 'female' }), 'c-demo-1', me, 'Coach Demo'),
    ...assignedFrom(training({ weeks: 2, loadScale: 0.9, bwFrom: 70, bwTo: 70, body: 'male' }), 'c-demo-2', me, 'Coach Demo'),
  ]
  const notifications = [
    { id: id('n'), user_id: me, kind: 'link_request', link_id: links[3].id, actor_id: 'c-demo-4', actor_name: 'Pedro Demo', created_at: stamp(daysAgo(1)), read_at: null },
  ]
  const profile = { id: me, name: 'Coach Demo', sex: 'male', role: 'trainer', plan: 'pro', birth_date: '1990-05-10', remote: false, onboarded_at: stamp(daysAgo(90)) }
  writeFileSync(join(out, 'sesion-trainer.js'), file('Coach Demo (entrenador Pro)', {
    forja_preview_db_v1: { gyms: GYMS, people: [...TRAINERS, ...clients], trainerGyms: { ...trainerGyms, [me]: ['g-gs-sambil', 'g-gs-virtudes'] },
      links, notifications, metrics, goals, payments: pays, diets, routines, seededFor: me },
    gym_guest: 1,
    forja_session_v1: { access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: me, email: 'coach@demo.forja', name: 'Coach Demo', sex: 'male', role: 'trainer' } },
    gym_state_v1: training({ weeks: 26, bwFrom: 84.1, bwTo: 79.3, targetW: 78, body: 'male' }),
    forja_preview_profile_v1: profile,
  }))
}

// ---- Lucía Demo: clienta de Andrea (Pro) en Gold Stars Sambil, 12 semanas de avance ------------
{
  const me = 'preview', coach = 't-demo-1'
  const trainers = TRAINERS.map(t => (t.id === coach ? { ...t, plan: 'pro' } : t))
  const l = { id: id('l'), client_id: me, trainer_id: coach, status: 'active', requested_at: stamp(daysAgo(24 * 7 + 1)), decided_at: stamp(daysAgo(24 * 7)), monthly_fee: 30 }
  const metrics = series(me, coach, { weeks: 24, height: 165, bump: 0.8, bumpAt: 0.45,
    from: { weight_kg: 70.2, body_fat_pct: 31.8, visceral_fat: 6, muscle_mass_kg: 24.4 },
    to: { weight_kg: 63.6, body_fat_pct: 25.9, visceral_fat: 4, muscle_mass_kg: 25.9 },
    girthsFrom: { waist: 80, hip: 103, arm: 29.5, thigh: 58.5, calf: 36 }, girthsTo: { waist: 71.5, hip: 96.5, arm: 28.5, thigh: 54.5, calf: 35.5 },
    notes: { 0: 'Evaluación inicial con bioimpedancia.', 10: 'Semana de carnaval: +0,8 kg. Volvemos al plan.', '-1': 'Va excelente: −6,6 kg y 8,5 cm menos de cintura.' } })
  const goals = { [me]: { client_id: me, goal: 'Llegar a 62 kg y marcar abdomen', target_weight_kg: 62, target_date: iso(daysAgo(-60)), updated_by: coach, updated_at: stamp(daysAgo(85)) } }
  const diets = { [me]: diet(me, coach, { kcal: 1700, protein: 135, carbs: 185, fat: 45 }, CUT_F,
    'Toma 2 L de agua al día. Si entrenas de noche, pasa la merienda de la tarde a después del entreno.', 15) }
  const gym = training({ weeks: 24, loadScale: 0.55, bwFrom: 70.2, bwTo: 63.6, targetW: 62, body: 'female' })
  const routines = assignedFrom(gym, me, coach, 'Andrea Rojas (demo)', true)
  const notifications = [
    { id: id('n'), user_id: me, kind: 'routine_assigned', link_id: l.id, actor_id: coach, actor_name: 'Andrea Rojas (demo)', created_at: stamp(daysAgo(0)), read_at: null },
    { id: id('n'), user_id: me, kind: 'metrics_added', link_id: l.id, actor_id: coach, actor_name: 'Andrea Rojas (demo)', created_at: stamp(daysAgo(0)), read_at: null },
    { id: id('n'), user_id: me, kind: 'diet_updated', link_id: l.id, actor_id: coach, actor_name: 'Andrea Rojas (demo)', created_at: stamp(daysAgo(1)), read_at: null },
    { id: id('n'), user_id: me, kind: 'link_accepted', link_id: l.id, actor_id: coach, actor_name: 'Andrea Rojas (demo)', created_at: stamp(daysAgo(24 * 7)), read_at: stamp(daysAgo(24 * 7)) },
  ]
  const profile = { id: me, name: 'Lucía Demo', sex: 'female', role: 'client', plan: 'free', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', remote: false, onboarded_at: stamp(daysAgo(86)) }
  writeFileSync(join(out, 'sesion-cliente.js'), file('Lucía Demo (clienta)', {
    forja_preview_db_v1: { gyms: GYMS, people: trainers, trainerGyms, links: [l], notifications, metrics, goals,
      payments: payments(me, coach, 30, 5, 0, ['Pago móvil Provincial', 'Pago móvil Provincial', 'Zelle']), diets, routines },
    gym_guest: 1,
    forja_session_v1: { access_token: 'preview', refresh_token: '', expires_at: 0, preview: true,
      profile: { id: me, email: 'lucia@demo.forja', name: 'Lucía Demo', sex: 'female', role: 'client' } },
    gym_state_v1: gym,
    forja_preview_profile_v1: profile,
  }))
}
console.log('listo: frontend/public/sesion-trainer.js y sesion-cliente.js')
