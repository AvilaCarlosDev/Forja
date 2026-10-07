// Forja: rutinas que el entrenador asigna (0012). El cliente las recibe en su app como rutinas de
// openGym, así «Entrenar», el plan de la semana y el historial funcionan igual que con las suyas:
// se marcan `assigned` (no se editan) y `excludeFromProgression` (se entrenan con el peso, las
// repeticiones y las series que indicó el coach, sin que la app los cambie sola).

export const WEEKDAYS = [
  { d: 1, short: 'Lun', label: 'Lunes' }, { d: 2, short: 'Mar', label: 'Martes' }, { d: 3, short: 'Mié', label: 'Miércoles' },
  { d: 4, short: 'Jue', label: 'Jueves' }, { d: 5, short: 'Vie', label: 'Viernes' }, { d: 6, short: 'Sáb', label: 'Sábado' },
  { d: 0, short: 'Dom', label: 'Domingo' },
]
export const daysText = (days = []) => WEEKDAYS.filter(w => days.includes(w.d)).map(w => w.short).join(' · ') || 'Sin día fijo'

export const ROUTINE_LIMITS = { name: 60, exercises: 15, note: 500, exNote: 200 }
export const LOCAL_PREFIX = 'coach-'
export const isAssigned = r => !!r?.assigned || String(r?.id || '').startsWith(LOCAL_PREFIX)

const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

// Valida el formulario del entrenador y deja la rutina lista para guardar (los mismos límites que
// exige la base en forja_check_routine).
export function cleanRoutine(form = {}) {
  const errors = {}
  const name = String(form.name || '').trim()
  if (!name) errors.name = 'Ponle un nombre a la rutina'
  else if (name.length > ROUTINE_LIMITS.name) errors.name = `Máximo ${ROUTINE_LIMITS.name} caracteres`
  const days = [...new Set((form.days || []).map(Number))].filter(d => d >= 0 && d <= 6).sort()
  const list = form.exercises || []
  if (!list.length) errors.exercises = 'Agrega al menos un ejercicio'
  else if (list.length > ROUTINE_LIMITS.exercises) errors.exercises = `Máximo ${ROUTINE_LIMITS.exercises} ejercicios`
  const exercises = list.map((e, i) => {
    const sets = num(e.sets), reps = num(e.reps), weight = num(e.weight)
    const bad = !(Number.isInteger(sets) && sets >= 1 && sets <= 20) || !(Number.isInteger(reps) && reps >= 1 && reps <= 100)
      || (weight != null && !(weight >= 0 && weight <= 1000))
    if (bad) errors['ex' + i] = 'Series de 1 a 20, repeticiones de 1 a 100 y peso de 0 a 1000 kg'
    const out = { id: e.id, sets, reps, weight: weight == null ? 0 : Math.round(weight * 100) / 100 }
    const note = String(e.note || '').trim().slice(0, ROUTINE_LIMITS.exNote)
    if (note) out.note = note
    return out
  })
  const note = String(form.note || '').trim().slice(0, ROUTINE_LIMITS.note)
  return { routine: { name, days, exercises, note: note || null }, errors }
}

// Una rutina asignada como rutina de openGym.
export function toLocalRoutine(a, coachName) {
  return {
    id: LOCAL_PREFIX + a.id,
    name: a.name,
    emoji: 'barbell',
    ex: (a.exercises || []).map(e => ({ id: e.id, sets: e.sets, reps: e.reps, weight: e.weight || 0, ...(e.note ? { note: e.note } : {}) })),
    excludeFromProgression: true,
    assigned: { by: coachName || null, at: a.updated_at || a.created_at || null, note: a.note || null, days: a.days || [] },
  }
}

// Pone las rutinas asignadas en el estado de la app (mutando el borrador de `update`): agrega o
// actualiza las que vinieron, quita las que el coach borró y las ubica en sus días de la semana.
// Las rutinas propias del cliente no se tocan. Devuelve cuántas rutinas cambiaron.
export function mergeAssigned(S, assigned = [], coachName) {
  S.routines ||= []; S.week ||= {}
  const incoming = assigned.map(a => toLocalRoutine(a, coachName))
  const ids = new Set(incoming.map(r => r.id))
  const before = JSON.stringify(S.routines.filter(isAssigned)) + JSON.stringify(S.week)
  S.routines = S.routines.filter(r => !isAssigned(r) || ids.has(r.id))
  for (const r of incoming) {
    const i = S.routines.findIndex(x => x.id === r.id)
    if (i >= 0) S.routines[i] = { ...S.routines[i], ...r }
    else S.routines.push(r)
  }
  // La semana: fuera las asignadas de todos los días; luego cada una en los suyos.
  for (const d of Object.keys(S.week)) {
    const left = [].concat(S.week[d] || []).filter(id => !String(id).startsWith(LOCAL_PREFIX))
    if (left.length) S.week[d] = left; else delete S.week[d]
  }
  for (const r of incoming) for (const d of r.assigned.days) S.week[d] = [...[].concat(S.week[d] || []), r.id]
  const after = JSON.stringify(S.routines.filter(isAssigned)) + JSON.stringify(S.week)
  return before === after ? 0 : incoming.length || 1
}
