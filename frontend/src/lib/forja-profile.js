// Forja: reglas del perfil — edad, consentimiento del tutor y cuándo un perfil está completo.
// Funciones puras con su test al lado. La base comprueba lo mismo (0002_forja_profile_details.sql):
// esto solo sirve para avisar antes de enviar.

export const MIN_AGE = 13
export const ADULT_AGE = 18
export const RELATIONSHIPS = [
  { value: 'madre', label: 'Madre' },
  { value: 'padre', label: 'Padre' },
  { value: 'tutor', label: 'Tutor legal' },
]
export const SEX_OPTIONS = [{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Fecha local de hoy como AAAA-MM-DD, sin pasar por UTC (en Venezuela, de noche, UTC ya es mañana).
export function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// Años cumplidos el día `today`. Se compara como texto AAAA-MM-DD para no depender de zonas horarias.
export function ageOn(birthDate, today = todayISO()) {
  if (!ISO_DATE.test(String(birthDate || '')) || !ISO_DATE.test(today)) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export const needsGuardian = (birthDate, today = todayISO()) => {
  const a = ageOn(birthDate, today)
  return a != null && a < ADULT_AGE
}

export function validateDetails(f = {}, today = todayISO()) {
  const e = {}
  if (!String(f.name || '').trim()) e.name = 'Escribe tu nombre'
  if (!['male', 'female'].includes(f.sex)) e.sex = 'Elige una opción'
  const age = ageOn(f.birth_date, today)
  if (age == null) e.birth_date = 'Escribe tu fecha de nacimiento'
  else if (f.birth_date > today) e.birth_date = 'La fecha no puede estar en el futuro'
  else if (age > 100) e.birth_date = 'Revisa la fecha de nacimiento'
  else if (age < MIN_AGE) e.birth_date = `Forja es para mayores de ${MIN_AGE} años`
  return e
}

// Peso (obligatorio) y talla (opcional) al completar el perfil: son el punto de partida de la
// curva de peso y de las medidas, así la app no vuelve a pedirlos.
export function validateBody(f = {}) {
  const e = {}
  const n = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
  const w = n(f.weight_kg), h = n(f.height_cm)
  if (w == null) e.weight_kg = 'Escribe tu peso'
  else if (!(w >= 20 && w <= 400)) e.weight_kg = 'Peso: entre 20 y 400 kg'
  if (h != null && !(h >= 80 && h <= 250)) e.height_cm = 'Talla: entre 80 y 250 cm'
  return { errors: e, weight_kg: Number.isFinite(w) ? Math.round(w * 10) / 10 : null, height_cm: Number.isFinite(h) ? Math.round(h) : null }
}

export function validateGuardian(g = {}) {
  const e = {}
  const name = String(g.guardian_name || '').trim()
  if (name.length < 3) e.guardian_name = 'Escribe el nombre completo de tu madre, padre o tutor'
  if (!EMAIL.test(String(g.guardian_email || '').trim())) e.guardian_email = 'Escribe un correo válido'
  if (!RELATIONSHIPS.some(r => r.value === g.relationship)) e.relationship = 'Elige el parentesco'
  if (g.accept !== true) e.accept = 'Tu madre, padre o tutor debe aceptar'
  return e
}

export const guardianBody = (userId, g) => ({
  user_id: userId,
  guardian_name: String(g.guardian_name).trim(),
  guardian_email: String(g.guardian_email).trim().toLowerCase(),
  relationship: g.relationship,
})

export const profileIsComplete = row => !!row?.onboarded_at

// La foto vive en una carpeta por usuario; el nombre cambia en cada subida para que ninguna
// caché enseñe la anterior.
export const avatarPath = (userId, stamp = Date.now()) => `${userId}/avatar-${stamp}.webp`

// Medidas de la foto reducida: lado mayor de `max` px como mucho, sin agrandar.
export function fitSize(w, h, max = 512) {
  if (!(w > 0 && h > 0)) return null
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * k), h: Math.round(h * k) }
}
