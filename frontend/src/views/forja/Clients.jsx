// Forja: la pestaña Clientes del entrenador. Arriba, las notificaciones y las solicitudes por
// aceptar; luego sus clientes (con el cupo del plan) y la ficha de cada uno con sus medidas.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { useForjaProfile } from '../../lib/forja-session.js'
import { effectivePlan, FREE_CLIENT_LIMIT, notificationText, gymLabel, clientsAtGym, gymOptions } from '../../lib/forja-coach.js'
import { ageOn } from '../../lib/forja-profile.js'
import { useUI } from '../../store/useUI.js'
import { Avatar } from './Avatar.jsx'
import Metrics from './Metrics.jsx'
import Diet from './Diet.jsx'
import { Loading, ErrorNote, useLoad } from './parts.jsx'
import Upgrade from './Upgrade.jsx'
import { refreshBadge } from './badge.js'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)
const SEX = { male: 'Hombre', female: 'Mujer' }
// El gimnasio donde el entrenador dice estar se recuerda en este dispositivo.
const GYM_KEY = 'forja_coach_gym'
const savedGym = () => { try { return localStorage.getItem(GYM_KEY) } catch { return null } }
const saveGym = id => { try { localStorage.setItem(GYM_KEY, id) } catch { /* sin almacenamiento */ } }

function Notifications({ items, onSeen }) {
  const unread = items.filter(n => !n.read_at)
  useEffect(() => { if (unread.length) { const t = setTimeout(onSeen, 1500); return () => clearTimeout(t) } }, [unread.length, onSeen])
  if (!items.length) return null
  return <section className="fj-card">
    <div className="fj-card-head"><h3><Icon name="bell" /> Notificaciones</h3>{unread.length > 0 && <span className="fj-badge">{unread.length} nuevas</span>}</div>
    <ul className="fj-notes">
      {items.slice(0, 8).map(n => <li key={n.id} className={n.read_at ? '' : 'new'}>
        {notificationText(n)}<span className="dim small"> · {new Date(n.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}</span>
      </li>)}
    </ul>
  </section>
}

function Request({ link, onDone, full }) {
  const [busy, setBusy] = useState(false)
  const c = link.client || {}
  const age = ageOn(c.birth_date)
  const answer = async accept => {
    setBusy(true)
    try { await api().respondLink(link.id, accept); toast(accept ? `Ahora entrenas a ${c.name}` : 'Solicitud rechazada'); onDone() }
    catch (x) { toast(x.message) }
    finally { setBusy(false) }
  }
  return <li className="fj-request">
    <Avatar path={c.avatar_path} name={c.name} size={44} />
    <div className="fj-item-m"><b>{c.name || 'Cliente'}</b><span>{[age != null && age + ' años', SEX[c.sex]].filter(Boolean).join(' · ')} · quiere entrenar contigo</span></div>
    <div className="fj-row">
      <Button variant="primary" size="sm" type="button" disabled={busy || full} onClick={() => answer(true)}>Aceptar</Button>
      <Button variant="tinted" size="sm" type="button" disabled={busy} onClick={() => answer(false)}>Rechazar</Button>
    </div>
  </li>
}

export function ClientsHome() {
  const nav = useNavigate()
  const { row } = useForjaProfile()
  const links = useLoad(() => api().myLinks(), [])
  const notes = useLoad(() => api().notifications(), [])
  const reload = () => { links.reload(); notes.reload(); refreshBadge() }
  const pro = effectivePlan(row) === 'pro'
  const mine = (links.data || []).filter(l => l.trainer_id === row?.id)
  const pending = mine.filter(l => l.status === 'pending')
  const active = mine.filter(l => l.status === 'active')
  const full = !pro && active.length >= FREE_CLIENT_LIMIT
  const hidden = useLoad(() => api().hiddenClients(), [pro])
  const [upgrade, setUpgrade] = useState(false)
  const myGyms = useLoad(async () => { const ids = await api().myTrainerGyms(); return ids.length ? api().gymsByIds(ids) : [] }, [])
  const options = gymOptions(myGyms.data || [], active)
  const [gym, setGym] = useState(savedGym)
  const here = options.some(o => o.value === gym) ? gym : options[0]?.value
  const shown = clientsAtGym(active, here)
  const pick = id => { setGym(id); saveGym(id) }
  return <div className="narrow fj-page">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <h1 className="fj-title">Clientes</h1>
      <Button variant="tinted" size="sm" type="button" onClick={() => nav('/finanzas')}>Finanzas</Button>
    </div>
    {notes.data && <Notifications items={notes.data} onSeen={() => api().markRead().then(() => { notes.reload(); refreshBadge() })} />}
    {links.loading && !links.data && <Loading />}
    {links.error && <ErrorNote error={links.error} retry={reload} />}
    {pending.length > 0 && <section className="fj-card">
      <div className="fj-card-head"><h3>Solicitudes</h3><span className="fj-badge">{pending.length}</span></div>
      {full && <div className="fj-note warn">Tienes {FREE_CLIENT_LIMIT} clientes, el máximo del plan Free. Pásate a Pro para aceptar más.</div>}
      <ul className="fj-requests">{pending.map(l => <Request key={l.id} link={l} full={full} onDone={reload} />)}</ul>
    </section>}
    {hidden.data > 0 && <div className="fj-note warn" role="status">
      <b>Tu plan Pro venció.</b> Con Free ves a tus {FREE_CLIENT_LIMIT} clientes más antiguos; {hidden.data === 1 ? 'otro queda oculto' : `otros ${hidden.data} quedan ocultos`} hasta que renueves. No se pierde nada: al renovar vuelven todos.
      <div className="fj-row fj-note-actions"><Button variant="primary" size="sm" type="button" onClick={() => setUpgrade(true)}>Renovar Pro</Button></div>
    </div>}
    {upgrade && <Upgrade feature="Ver a todos tus clientes" onClose={() => setUpgrade(false)} />}
    {links.data && <section className="fj-card">
      <div className="fj-card-head"><h3>Mis clientes</h3><span className="dim small">{active.length}{pro ? '' : ` de ${FREE_CLIENT_LIMIT}`} · plan {pro ? 'Pro' : 'Free'}</span></div>
      {active.length > 0 && options.length > 1 && <div className="fj-field">
        <label htmlFor="fj-here">Estoy en</label>
        <select id="fj-here" className="input" value={here} onChange={e => pick(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label} ({o.count})</option>)}
        </select>
      </div>}
      {!active.length ? <p className="dim small">Aún no tienes clientes. Cuando alguien de tus gimnasios te elija, te llegará aquí la solicitud.</p>
        : !shown.length ? <p className="dim small">No tienes clientes en este gimnasio.</p>
        : <ul className="fj-list">{shown.map(l => <li key={l.id}>
          <button type="button" className="fj-item" onClick={() => nav('/clientes/' + l.client_id)}>
            <Avatar path={l.client?.avatar_path} name={l.client?.name} size={44} />
            <span className="fj-item-m"><b>{l.client?.name}</b><span>{[ageOn(l.client?.birth_date) != null && ageOn(l.client.birth_date) + ' años', SEX[l.client?.sex]].filter(Boolean).join(' · ')}</span></span>
            <Icon name="chevronRight" />
          </button>
        </li>)}</ul>}
    </section>}
  </div>
}

export function ClientDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { row } = useForjaProfile()
  const links = useLoad(() => api().myLinks(), [])
  const active = (links.data || []).filter(l => l.trainer_id === row?.id && l.status === 'active')
  const link = active.find(l => l.client_id === id)
  const gyms = useLoad(() => link?.client?.gym_id ? api().gymsByIds([link.client.gym_id]) : [], [link?.client?.gym_id])
  if (links.loading && !links.data) return <div className="narrow fj-page"><Loading /></div>
  if (!link) return <div className="narrow fj-page">
    <div className="fj-note warn">Este cliente ya no está vinculado contigo.</div>
    <Button type="button" onClick={() => nav('/clientes')}>Volver a Clientes</Button>
  </div>
  const c = link.client || {}
  const age = ageOn(c.birth_date)
  const i = active.indexOf(link)
  const go = j => nav('/clientes/' + active[(j + active.length) % active.length].client_id)
  return <div className="narrow fj-page">
    <div className="fj-switch">
      <button type="button" className="fj-icon-btn" aria-label="Volver a Clientes" onClick={() => nav('/clientes')}><Icon name="chevronLeft" /></button>
      <select className="input" aria-label="Cambiar de cliente" value={id} onChange={e => nav('/clientes/' + e.target.value)}>
        {active.map(l => <option key={l.client_id} value={l.client_id}>{l.client?.name}</option>)}
      </select>
      {active.length > 1 && <>
        <button type="button" className="fj-icon-btn" aria-label="Cliente anterior" onClick={() => go(i - 1)}><Icon name="arrowUp" /></button>
        <button type="button" className="fj-icon-btn" aria-label="Cliente siguiente" onClick={() => go(i + 1)}><Icon name="arrowDown" /></button>
      </>}
    </div>
    <div className="fj-profile-head">
      <Avatar path={c.avatar_path} name={c.name} size={72} />
      <div><h1 className="fj-title">{c.name}</h1>
        <div className="dim">{[age != null && age + ' años', SEX[c.sex], c.gym_id ? gymLabel(gyms.data?.[0]) : c.remote ? 'Entrena a distancia' : null].filter(Boolean).join(' · ')}</div>
        <div className="dim small">Cliente desde {new Date(link.decided_at || link.requested_at).toLocaleDateString('es-VE')}</div>
      </div>
    </div>
    <Metrics clientId={c.id} canEdit pro={effectivePlan(row) === 'pro'} />
    <Diet clientId={c.id} clientName={c.name} canEdit pro={effectivePlan(row) === 'pro'}
      otherClients={active.filter(l => l.client_id !== c.id).map(l => ({ id: l.client_id, name: l.client?.name || 'Cliente' }))} />
  </div>
}
