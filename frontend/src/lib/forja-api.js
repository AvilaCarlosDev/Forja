// Forja: datos de gimnasios, vínculo entrenador–cliente, notificaciones y medidas.
// Dos implementaciones con la misma forma:
//   * real: Supabase por REST (forja-db.js). Los permisos los decide la base (RLS, 0003–0005).
//   * vista previa: todo en localStorage, con gimnasios y entrenadores de ejemplo, para probar
//     los dos roles sin servidor (VITE_FORJA_AUTH_PREVIEW=1).
import { db, getSession, getProfile, updateProfile } from './forja-session.js'
import { FORJA_AUTH } from './forja-config.js'
import { effectivePlan, FREE_CLIENT_LIMIT } from './forja-coach.js'

const me = () => getSession()?.profile?.id
const inList = ids => '(' + ids.map(encodeURIComponent).join(',') + ')'

// ---------------------------------------------------------------------------------------------
// Supabase

const LINK_SELECT = '*,client:profiles!coach_links_client_id_fkey(id,name,avatar_path,birth_date,sex,gym_id,remote),' +
  'trainer:profiles!coach_links_trainer_id_fkey(id,name,avatar_path,plan,plan_expires_at)'

export const remoteApi = {
  listGyms: () => db.select('gyms', 'select=id,name,branch,address,social_url,logo_path,verified&order=name.asc,branch.asc'),
  async suggestGym({ name, branch, social_url, logo }) {
    let logo_path = null
    if (logo) {
      logo_path = `${me()}/logo-${Date.now()}.webp`
      await db.upload('gym-logos', logo_path, logo, 'image/webp')
    }
    return db.insert('gyms', { name: name.trim(), branch: branch?.trim() || null, social_url: social_url || null, logo_path, created_by: me() })
  },
  setClientGym: (gymId, remote) => updateProfile({ gym_id: gymId || null, remote: !!remote }),
  async myTrainerGyms() {
    const rows = await db.select('trainer_gyms', 'select=gym_id&trainer_id=eq.' + me())
    return rows.map(r => r.gym_id)
  },
  async setTrainerGyms(ids, remote) {
    const current = await remoteApi.myTrainerGyms()
    const drop = current.filter(id => !ids.includes(id))
    const add = ids.filter(id => !current.includes(id))
    if (drop.length) await db.del('trainer_gyms', `trainer_id=eq.${me()}&gym_id=in.${inList(drop)}`)
    if (add.length) await db.insert('trainer_gyms', add.map(gym_id => ({ trainer_id: me(), gym_id })))
    return updateProfile({ remote: !!remote })
  },
  listTrainers: gymId => db.rpc('forja_trainers', { p_gym: gymId || null }),
  requestTrainer: trainerId => db.rpc('forja_request_trainer', { p_trainer: trainerId }),
  respondLink: (linkId, accept) => db.rpc('forja_respond_link', { p_link: linkId, p_accept: accept }),
  leaveTrainer: () => db.rpc('forja_leave_trainer'),
  setLinkFee: (linkId, fee) => db.rpc('forja_set_link_fee', { p_link: linkId, p_fee: fee }),
  registerPayment: p => db.rpc('forja_register_payment', {
    p_client: p.client, p_amount: p.amount, p_period: p.period, p_paid_at: p.paid_at, p_note: p.note || null,
  }),
  deletePayment: id => db.rpc('forja_delete_payment', { p_id: id }),
  myPayments: () => db.select('payments', `select=*&or=(trainer_id.eq.${me()},client_id.eq.${me()})&order=period.desc,paid_at.desc`),
  myLinks: () => db.select('coach_links', `select=${encodeURIComponent(LINK_SELECT)}&or=(client_id.eq.${me()},trainer_id.eq.${me()})&status=in.(pending,active)&order=requested_at.desc`),
  notifications: () => db.select('notifications', 'select=*&order=created_at.desc&limit=30'),
  markRead: () => db.update('notifications', { user_id: me() }, { read_at: new Date().toISOString() }),
  metrics: clientId => db.select('body_metrics', `select=*&client_id=eq.${clientId}&order=measured_on.desc,created_at.desc`),
  addMetric: row => db.insert('body_metrics', row),
  deleteMetric: id => db.del('body_metrics', 'id=eq.' + id),
  goal: clientId => db.one('client_goals', { client_id: clientId }),
  setGoal: (clientId, g) => db.insert('client_goals', { client_id: clientId, ...g }, { upsert: true }),
  diet: clientId => db.one('diet_plans', { client_id: clientId }),
  setDiet: (clientId, { targets, meals, notes }) => db.rpc('forja_set_diet', { p_client: clientId, p_targets: targets, p_meals: meals, p_notes: notes || null }),
  deleteDiet: clientId => db.rpc('forja_delete_diet', { p_client: clientId }),
  gymsByIds: ids => !ids.length ? Promise.resolve([]) : db.select('gyms', 'select=id,name,branch&id=in.' + inList(ids)),
}
// ---------------------------------------------------------------------------------------------
// Vista previa (sin servidor)

const KEY = 'forja_preview_db_v1'
const uid = () => 'p-' + Math.random().toString(36).slice(2, 10)
const now = () => new Date().toISOString()
const SEED_GYMS = [
  { id: 'g-gs-sambil', name: 'Gold Stars Gym', branch: 'Sambil Paraguaná', address: 'Sambil Paraguaná, entrada Terrazas del Sambil', verified: true },
  { id: 'g-gs-virtudes', name: 'Gold Stars Gym', branch: 'Las Virtudes', address: 'C.C. Las Virtudes', verified: true },
  { id: 'g-gs-cdv', name: 'Gold Stars Gym', branch: 'Ciudad del Viento', address: 'C.C. Ciudad del Viento', verified: true },
  { id: 'g-altitude', name: 'Altitude', branch: null, address: 'C.C. Mediterráneo, Av. Ollarvides', verified: true },
  { id: 'g-nltc', name: 'New Life Training Center', branch: null, address: null, verified: true },
]
const SEED_PEOPLE = [
  { id: 't-demo-1', name: 'Andrea Rojas (demo)', role: 'trainer', remote: false, gyms: ['g-gs-sambil', 'g-gs-virtudes'], plan: 'free' },
  { id: 't-demo-2', name: 'Carlos Medina (demo)', role: 'trainer', remote: true, gyms: ['g-altitude'], plan: 'pro' },
  { id: 't-demo-3', name: 'Luisa Pérez (demo)', role: 'trainer', remote: false, gyms: ['g-nltc', 'g-gs-cdv'], plan: 'free' },
  { id: 'c-demo-1', name: 'María Demo', role: 'client', sex: 'female', birth_date: '1996-03-14', gym_id: 'g-gs-sambil', remote: false },
]

function load() {
  let d = null
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { /* nada */ }
  if (!d) {
    d = { gyms: SEED_GYMS, people: SEED_PEOPLE, trainerGyms: {}, links: [], notifications: [], metrics: [], goals: {}, payments: [] }
    for (const p of SEED_PEOPLE) if (p.gyms) d.trainerGyms[p.id] = p.gyms
    d.metrics.push({ id: uid(), client_id: 'c-demo-1', recorded_by: 'c-demo-1', measured_on: '2026-09-01', weight_kg: 64, height_cm: 162, measurements: {}, created_at: now() })
  }
  d.payments ||= [] // dbs guardados antes de las finanzas
  return d
}
function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* sin almacenamiento */ } }
function person(d, id) {
  if (id === me()) { const r = getProfile().row || {}; return { ...r, id } }
  return d.people.find(p => p.id === id) || null
}
const fail = m => { throw new Error(m) }
// Igual que forja_require_pro() en 0008: finanzas y dietas solo se escriben con el plan Pro vigente.
const requirePro = () => { if (effectivePlan(getProfile().row || {}) !== 'pro') fail('Es una función Pro. Pásate a Pro para usarla.') }
const notify = (d, user_id, kind, link_id, actor) => d.notifications.unshift({ id: uid(), user_id, kind, link_id, actor_id: actor, actor_name: person(d, actor)?.name, created_at: now(), read_at: null })
// Igual que forja_notify_client() en 0010: el entrenador que envía algo avisa al cliente, sin
// repetir un aviso igual que siga sin leer en el día.
function notifyClient(d, clientId, kind) {
  if (clientId === me()) return
  const today = now().slice(0, 10)
  if (d.notifications.some(n => n.user_id === clientId && n.kind === kind && n.actor_id === me() && !n.read_at && n.created_at.slice(0, 10) === today)) return
  notify(d, clientId, kind, d.links.find(l => l.client_id === clientId && l.trainer_id === me() && l.status === 'active')?.id || null, me())
}
const activeTrainer = (d, clientId) => d.links.find(l => l.client_id === clientId && l.status === 'active')?.trainer_id || null

// En la vista previa, el entrenador de prueba recibe una solicitud de "María Demo" para ver ese lado.
function seedRequestFor(d, trainerId) {
  if (d.seededFor === trainerId) return
  d.seededFor = trainerId
  const l = { id: uid(), client_id: 'c-demo-1', trainer_id: trainerId, status: 'pending', requested_at: now() }
  d.links.push(l); notify(d, trainerId, 'link_request', l.id, 'c-demo-1')
}

const ok = v => Promise.resolve(v)
export const previewApi = {
  listGyms: () => ok(load().gyms),
  suggestGym({ name, branch, social_url, logo }) {
    const d = load()
    const g = { id: uid(), name: name.trim(), branch: branch?.trim() || null, social_url: social_url || null, logo_path: logo ? 'preview-logo' : null, verified: false, created_by: me() }
    d.gyms.push(g); save(d); return ok(g)
  },
  setClientGym: (gymId, remote) => updateProfile({ gym_id: gymId || null, remote: !!remote }),
  myTrainerGyms: () => ok(load().trainerGyms[me()] || []),
  setTrainerGyms(ids, remote) {
    const d = load(); d.trainerGyms[me()] = [...ids]
    if (getProfile().row?.role === 'trainer') seedRequestFor(d, me())
    save(d); return updateProfile({ remote: !!remote })
  },
  listTrainers(gymId) {
    const d = load()
    const all = d.people.filter(p => p.role === 'trainer')
    return ok(all.filter(t => gymId ? (d.trainerGyms[t.id] || []).includes(gymId) : t.remote)
      .map(t => ({ id: t.id, name: t.name, avatar_path: null, remote: t.remote, gyms: (d.trainerGyms[t.id] || []).map(id => d.gyms.find(g => g.id === id)).filter(Boolean) })))
  },
  requestTrainer(trainerId) {
    const d = load(), c = person(d, me()), t = person(d, trainerId)
    if (!t || t.role !== 'trainer') fail('Ese entrenador no existe')
    if (c.gym_id ? !(d.trainerGyms[t.id] || []).includes(c.gym_id) : !t.remote) fail('Ese entrenador no trabaja en tu gimnasio')
    if (d.links.some(l => l.client_id === c.id && l.trainer_id === t.id && l.status === 'active')) fail('Ya entrenas con esa persona')
    for (const l of d.links) if (l.client_id === c.id && l.status === 'pending') { l.status = 'cancelled'; notify(d, l.trainer_id, 'link_cancelled', l.id, c.id) }
    const l = { id: uid(), client_id: c.id, trainer_id: t.id, status: 'pending', requested_at: now() }
    d.links.push(l); notify(d, t.id, 'link_request', l.id, c.id); save(d); return ok(l)
  },
  respondLink(linkId, accept) {
    const d = load(), l = d.links.find(x => x.id === linkId)
    if (!l || l.trainer_id !== me()) fail('Esa solicitud no es tuya')
    if (l.status !== 'pending') fail('Esa solicitud ya no está pendiente')
    if (!accept) { l.status = 'rejected'; notify(d, l.client_id, 'link_rejected', l.id, me()); save(d); return ok(l) }
    const meRow = getProfile().row || {}
    if (effectivePlan(meRow) === 'free' && d.links.filter(x => x.trainer_id === me() && x.status === 'active').length >= FREE_CLIENT_LIMIT)
      fail('Llegaste al límite de 5 clientes del plan Free. Pásate a Pro para aceptar más.')
    for (const o of d.links) if (o.client_id === l.client_id && o.status === 'active') { o.status = 'ended'; o.ended_at = now(); notify(d, o.trainer_id, 'link_ended', o.id, l.client_id) }
    l.status = 'active'; l.decided_at = now(); notify(d, l.client_id, 'link_accepted', l.id, me()); save(d); return ok(l)
  },
  leaveTrainer() {
    const d = load()
    for (const l of d.links) if (l.client_id === me() && ['active', 'pending'].includes(l.status)) {
      notify(d, l.trainer_id, l.status === 'active' ? 'link_ended' : 'link_cancelled', l.id, me())
      l.status = l.status === 'active' ? 'ended' : 'cancelled'
    }
    save(d); return ok(null)
  },
  myLinks() {
    const d = load()
    const pick = (p, keys) => p && Object.fromEntries(keys.map(k => [k, p[k] ?? null]))
    return ok(d.links.filter(l => (l.client_id === me() || l.trainer_id === me()) && ['pending', 'active'].includes(l.status))
      .map(l => ({ ...l,
        client: pick(person(d, l.client_id), ['id', 'name', 'avatar_path', 'birth_date', 'sex', 'gym_id', 'remote']),
        trainer: pick(person(d, l.trainer_id), ['id', 'name', 'avatar_path', 'plan', 'plan_expires_at']) }))
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at)))
  },
  notifications: () => ok(load().notifications.filter(n => n.user_id === me())),
  markRead() { const d = load(); for (const n of d.notifications) if (n.user_id === me()) n.read_at ||= now(); save(d); return ok(null) },
  metrics(clientId) {
    const d = load()
    if (clientId !== me() && activeTrainer(d, clientId) !== me()) return ok([])
    return ok(d.metrics.filter(m => m.client_id === clientId).sort((a, b) => b.measured_on.localeCompare(a.measured_on) || b.created_at.localeCompare(a.created_at)))
  },
  addMetric(row) {
    const d = load(), t = activeTrainer(d, row.client_id)
    if (t ? t !== me() : row.client_id !== me()) fail('No tienes permiso para hacer eso')
    const m = { id: uid(), ...row, recorded_by: me(), created_at: now() }
    d.metrics.push(m); notifyClient(d, row.client_id, 'metrics_added'); save(d); return ok(m)
  },
  deleteMetric(id) {
    const d = load(), m = d.metrics.find(x => x.id === id), t = m && activeTrainer(d, m.client_id)
    if (!m || (t ? t !== me() : m.client_id !== me())) fail('No tienes permiso para hacer eso')
    d.metrics = d.metrics.filter(x => x.id !== id); save(d); return ok(null)
  },
  goal: clientId => ok(load().goals[clientId] || null),
  setGoal(clientId, g) {
    const d = load(), t = activeTrainer(d, clientId)
    if (t ? t !== me() : clientId !== me()) fail('No tienes permiso para hacer eso')
    d.goals[clientId] = { client_id: clientId, ...g, updated_by: me(), updated_at: now() }; save(d); return ok(d.goals[clientId])
  },
  gymsByIds: ids => ok(load().gyms.filter(g => ids.includes(g.id))),
  diet: clientId => ok(load().diets?.[clientId] || null),
  setDiet(clientId, { targets, meals, notes }) {
    requirePro()
    const d = load()
    if (activeTrainer(d, clientId) !== me()) fail('Ese cliente no está vinculado a ti')
    d.diets ||= {}
    d.diets[clientId] = { client_id: clientId, trainer_id: me(), targets, meals, notes: String(notes || '').trim() || null, updated_at: now() }
    notifyClient(d, clientId, 'diet_updated'); save(d); return ok(d.diets[clientId])
  },
  deleteDiet(clientId) {
    requirePro()
    const d = load()
    if (activeTrainer(d, clientId) !== me()) fail('Ese cliente no está vinculado a ti')
    if (d.diets) delete d.diets[clientId]
    save(d); return ok(null)
  },
  setLinkFee(linkId, fee) {
    requirePro()
    const d = load(), l = d.links.find(x => x.id === linkId)
    if (!l || l.trainer_id !== me() || l.status !== 'active') fail('Ese vínculo no es tuyo')
    if (fee != null && !(Number(fee) >= 0)) fail('La mensualidad no puede ser negativa')
    l.monthly_fee = fee == null ? null : Number(fee); save(d); return ok(null)
  },
  registerPayment({ client, amount, period, paid_at, note }) {
    requirePro()
    const d = load(), l = d.links.find(x => x.client_id === client && x.trainer_id === me() && x.status === 'active')
    if (!l) fail('Ese cliente no está vinculado a ti')
    if (!(Number(amount) >= 0)) fail('El monto no puede ser negativo')
    if (!/^\d{4}-\d{2}$/.test(period || '')) fail('Periodo inválido: usa AAAA-MM')
    const today = new Date().toISOString().slice(0, 10)
    if (!paid_at || paid_at > today) fail('La fecha de pago no puede estar en el futuro')
    if (period > paid_at.slice(0, 7)) fail('El periodo no puede ser posterior a la fecha de pago')
    const p = { id: uid(), client_id: client, trainer_id: me(), amount: Number(amount), period, paid_at,
      note: String(note || '').trim() || null, created_at: now() }
    d.payments.push(p); save(d); return ok(p)
  },
  deletePayment(id) {
    requirePro()
    const d = load(), p = d.payments.find(x => x.id === id)
    if (!p || p.trainer_id !== me()) fail('Ese pago no es tuyo')
    d.payments = d.payments.filter(x => x.id !== id); save(d); return ok(null)
  },
  myPayments() {
    const d = load()
    return ok(d.payments.filter(p => p.trainer_id === me() || p.client_id === me())
      .sort((a, b) => b.period.localeCompare(a.period) || String(b.paid_at).localeCompare(String(a.paid_at))))
  },
}

// Igual que la API real: los errores llegan como promesa rechazada, nunca como excepción directa.
for (const [k, f] of Object.entries(previewApi)) {
  previewApi[k] = (...args) => { try { return Promise.resolve(f(...args)) } catch (e) { return Promise.reject(e) } }
}

export const api = () => (FORJA_AUTH && !getSession()?.preview ? remoteApi : previewApi)
