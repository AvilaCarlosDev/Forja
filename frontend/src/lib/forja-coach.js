// Forja: reglas de gimnasios, vínculo entrenador–cliente y medidas. Funciones puras con su test
// al lado; la base hace cumplir lo mismo con RLS (migraciones 0003–0005).

export const FREE_CLIENT_LIMIT = 5

// ---- Gimnasios -------------------------------------------------------------------------------

export const gymLabel = g => !g ? '' : g.branch ? `${g.name} · ${g.branch}` : g.name

// Acepta "@usuario" (se asume Instagram), "instagram.com/usuario" o una URL completa, y devuelve
// una URL https limpia. Devuelve null si no parece un perfil de red social.
const NETWORKS = ['instagram.com', 'x.com', 'twitter.com', 'facebook.com', 'fb.com', 'tiktok.com', 'threads.net', 'youtube.com']
export function normalizeSocial(input) {
  let v = String(input || '').trim()
  if (!v) return null
  if (/^@[\w.]{2,30}$/.test(v)) return `https://www.instagram.com/${v.slice(1)}/`
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  let u
  try { u = new URL(v) } catch { return null }
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')
  if (!NETWORKS.includes(host)) return null
  const path = u.pathname.replace(/\/+$/, '')
  if (!path || path === '/') return null
  return `https://${host === 'fb.com' ? 'facebook.com' : host === 'instagram.com' ? 'www.instagram.com' : host}${path}/`
}

export function validateGymSuggestion(f = {}, existing = []) {
  const e = {}
  const name = String(f.name || '').trim()
  if (name.length < 2) e.name = 'Escribe el nombre del gimnasio'
  else if (name.length > 80) e.name = 'El nombre es demasiado largo'
  const social = String(f.social || '').trim()
  if (social && !normalizeSocial(social)) e.social = 'Pega el enlace o el @usuario de Instagram, X, Facebook o TikTok'
  if (!social && !f.logo) e.proof = 'Agrega su red social o una foto del logo para poder validar que existe'
  const key = s => String(s || '').trim().toLowerCase()
  if (!e.name && existing.some(g => key(g.name) === key(name) && key(g.branch) === key(f.branch))) e.name = 'Ese gimnasio ya está en la lista'
  return e
}

// Busca sin importar mayúsculas ni tildes.
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const filterGyms = (gyms, q) => !String(q || '').trim() ? gyms
  : gyms.filter(g => fold(gymLabel(g) + ' ' + (g.address || '')).includes(fold(q).trim()))

// ---- Plan y vínculo --------------------------------------------------------------------------

export function effectivePlan(p, now = Date.now()) {
  if (p?.plan !== 'pro') return 'free'
  return !p.plan_expires_at || Date.parse(p.plan_expires_at) > now ? 'pro' : 'free'
}

// El cliente edita sus medidas solo si no tiene entrenador activo.
export const clientCanEditMetrics = activeLink => !activeLink

export function linkSummary(links = [], meId) {
  const mine = links.filter(l => l.client_id === meId)
  return {
    active: mine.find(l => l.status === 'active') || null,
    pending: mine.find(l => l.status === 'pending') || null,
  }
}

export const NOTIFICATION_TEXT = {
  link_request: n => `${n.actor_name || 'Un cliente'} quiere entrenar contigo`,
  link_accepted: n => `${n.actor_name || 'Tu entrenador'} aceptó ser tu entrenador`,
  link_rejected: n => `${n.actor_name || 'El entrenador'} no aceptó tu solicitud`,
  link_ended: n => `${n.actor_name || 'Un cliente'} ya no entrena contigo`,
  link_cancelled: n => `${n.actor_name || 'Un cliente'} retiró su solicitud`,
}
export const notificationText = n => (NOTIFICATION_TEXT[n?.kind] || (() => 'Novedad en tu cuenta'))(n || {})

// ---- Medidas ---------------------------------------------------------------------------------

export const METRIC_FIELDS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', min: 20, max: 400 },
  { key: 'height_cm', label: 'Talla', unit: 'cm', min: 80, max: 250 },
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%', min: 2, max: 75 },
  { key: 'visceral_fat', label: 'Grasa visceral', unit: 'nivel', min: 1, max: 60 },
  { key: 'muscle_mass_kg', label: 'Masa muscular', unit: 'kg', min: 5, max: 200 },
]
export const GIRTHS = [
  { key: 'neck', label: 'Cuello' }, { key: 'chest', label: 'Pecho' }, { key: 'waist', label: 'Cintura' },
  { key: 'hip', label: 'Cadera' }, { key: 'arm', label: 'Brazo' }, { key: 'thigh', label: 'Muslo' }, { key: 'calf', label: 'Pantorrilla' },
]

const num = v => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// Convierte el formulario en una fila; devuelve { row, errors }.
export function metricRow(form = {}, clientId, today) {
  const errors = {}
  const row = { client_id: clientId, measured_on: form.measured_on || today, measurements: {} }
  for (const f of METRIC_FIELDS) {
    const v = num(form[f.key])
    if (v === null) continue
    if (Number.isNaN(v) || v < f.min || v > f.max) errors[f.key] = `${f.label}: entre ${f.min} y ${f.max} ${f.unit}`
    else row[f.key] = v
  }
  for (const g of GIRTHS) {
    const v = num(form[g.key])
    if (v === null) continue
    if (Number.isNaN(v) || v < 10 || v > 250) errors[g.key] = `${g.label}: entre 10 y 250 cm`
    else row.measurements[g.key] = v
  }
  if (form.measured_on && today && form.measured_on > today) errors.measured_on = 'La fecha no puede estar en el futuro'
  const note = String(form.note || '').trim()
  if (note) row.note = note.slice(0, 500)
  const hasData = METRIC_FIELDS.some(f => row[f.key] != null) || Object.keys(row.measurements).length > 0
  if (!hasData && !Object.keys(errors).length) errors.form = 'Carga al menos una medida'
  return { row, errors }
}

export const bmi = (weightKg, heightCm) => weightKg > 0 && heightCm > 0
  ? Math.round(weightKg / (heightCm / 100) ** 2 * 10) / 10 : null

// Última medida conocida de cada campo (la talla, por ejemplo, no se repite en cada registro).
export function latestValues(rows = []) {
  const sorted = [...rows].sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const out = {}
  for (const f of METRIC_FIELDS) {
    const r = sorted.find(r => r[f.key] != null)
    if (r) out[f.key] = { value: Number(r[f.key]), on: r.measured_on }
  }
  return out
}

// Inicio contra hoy, para la comparativa (función Pro).
export function progress(rows = []) {
  const asc = [...rows].sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)))
  const res = {}
  for (const f of METRIC_FIELDS) {
    const withValue = asc.filter(r => r[f.key] != null)
    if (withValue.length < 2) continue
    const first = Number(withValue[0][f.key]), last = Number(withValue[withValue.length - 1][f.key])
    res[f.key] = { first, last, diff: Math.round((last - first) * 100) / 100 }
  }
  return res
}

// ---- Finanzas ----------------------------------------------------------------------------------

// Mes local 'YYYY-MM' (sin pasar por UTC: en Venezuela, de noche, UTC ya es mañana).
export const monthKey = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`
}

export const prevMonthKey = key => {
  const [y, m] = key.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const monthName = key => MONTHS[Number(key.slice(5, 7)) - 1]
export const money = n => '$' + Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })

export const PAYMENT_LABEL = { al_dia: 'Al día', pendiente: 'Pendiente', vencido: 'Vencido' }

// Estado de la mensualidad de un cliente con sus pagos (ya filtrados a ese cliente):
// al día = pagó el mes en curso; pendiente = aún no se le cobra este mes; vencido = su
// último pago tiene dos meses o más.
export function paymentStatus(payments = [], today = new Date()) {
  const key = monthKey(today)
  const periods = payments.map(p => p.period)
  if (periods.includes(key)) return 'al_dia'
  if (!periods.length) return 'pendiente'
  return periods.slice().sort().at(-1) >= prevMonthKey(key) ? 'pendiente' : 'vencido'
}

// Tablero del entrenador: fila por cliente activo con su estado, más lo cobrado y por
// cobrar del mes en curso.
export function financeSummary(links = [], payments = [], today = new Date()) {
  const key = monthKey(today)
  const rows = links.filter(l => l.status === 'active').map(l => {
    const mine = payments.filter(p => p.client_id === l.client_id)
    return { link: l, status: paymentStatus(mine, today), last: mine.map(p => p.period).sort().at(-1) || null }
  })
  const income = payments.filter(p => p.period === key).reduce((s, p) => s + Number(p.amount || 0), 0)
  const due = rows.filter(r => r.status !== 'al_dia').reduce((s, r) => s + Number(r.link.monthly_fee || 0), 0)
  return { rows, income, due, vencidos: rows.filter(r => r.status === 'vencido').length, month: key }
}
