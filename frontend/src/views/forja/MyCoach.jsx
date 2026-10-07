// Forja: la pestaña Mi coach del cliente. Su gimnasio y su entrenador (los puede cambiar), lo que
// le avisaron, y sus medidas: en solo lectura si tiene entrenador, editables si no.
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { useForjaProfile } from '../../lib/forja-session.js'
import { effectivePlan, linkSummary, notificationText, gymLabel, clientCanEditMetrics, paymentStatus, PAYMENT_LABEL, monthName, money } from '../../lib/forja-coach.js'
import { useUI } from '../../store/useUI.js'
import { Avatar } from './Avatar.jsx'
import GymPicker from './GymPicker.jsx'
import TrainerPicker from './TrainerPicker.jsx'
import Metrics from './Metrics.jsx'
import Diet from './Diet.jsx'
import { Panel, Loading, ErrorNote, useLoad } from './parts.jsx'
import { refreshBadge } from './badge.js'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)

function ChangeGym({ row, onClose }) {
  const [gym, setGym] = useState(row.gym_id || null)
  const [remote, setRemote] = useState(!!row.remote && !row.gym_id)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!gym && !remote) { setErr('Elige tu gimnasio o marca que entrenas en casa'); return }
    setBusy(true)
    try { await api().setClientGym(gym, remote && !gym); toast('Gimnasio actualizado'); onClose() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title="Cambiar de gimnasio" onClose={onClose}>
    <div className="fj-form">
      <GymPicker value={gym} remote={remote} onChange={(v, r) => { setGym(v); setRemote(!!r); setErr('') }} />
      <div className="dim small">Tu entrenador actual no cambia. Si quieres uno del nuevo gimnasio, cámbialo después.</div>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar gimnasio'}</Button>
    </div>
  </Panel>
}

export default function MyCoach() {
  const { row } = useForjaProfile()
  const links = useLoad(() => api().myLinks(), [])
  const notes = useLoad(() => api().notifications(), [])
  const pays = useLoad(() => api().myPayments(), [])
  const gym = useLoad(() => row?.gym_id ? api().gymsByIds([row.gym_id]) : [], [row?.gym_id])
  const [panel, setPanel] = useState(null)
  const unread = (notes.data || []).filter(n => !n.read_at)
  useEffect(() => {
    if (!unread.length) return
    const t = setTimeout(() => api().markRead().then(() => { notes.reload(); refreshBadge() }), 1500)
    return () => clearTimeout(t)
  }, [unread.length]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!row) return <div className="narrow fj-page"><Loading /></div>
  const { active, pending } = linkSummary(links.data || [], row.id)
  const reload = () => { links.reload(); notes.reload(); refreshBadge() }
  const leave = async () => {
    try { await api().leaveTrainer(); toast(active ? 'Ya no tienes entrenador' : 'Solicitud retirada'); reload() }
    catch (x) { toast(x.message) }
  }
  const trainerPro = active && effectivePlan(active.trainer) === 'pro'
  return <div className="narrow fj-page">
    <h1 className="fj-title">Mi coach</h1>

    {unread.length > 0 && <section className="fj-card">
      <div className="fj-card-head"><h3><Icon name="bell" /> Novedades</h3></div>
      <ul className="fj-notes">{unread.map(n => <li key={n.id} className="new">{notificationText(n)}</li>)}</ul>
    </section>}

    <section className="fj-card">
      <div className="fj-card-head"><h3>Mi gimnasio</h3><button type="button" className="fj-link" onClick={() => setPanel('gym')}>Cambiar</button></div>
      <p className="fj-p">{row.gym_id ? gymLabel(gym.data?.[0]) || '…' : row.remote ? 'Entreno en casa o a distancia' : 'Sin gimnasio'}</p>
    </section>

    <section className="fj-card">
      <div className="fj-card-head"><h3>Mi entrenador</h3>
        {(active || pending) && <button type="button" className="fj-link" onClick={() => setPanel('trainer')}>Cambiar</button>}
      </div>
      {links.loading && !links.data && <Loading />}
      {links.error && <ErrorNote error={links.error} retry={reload} />}
      {active && <div className="fj-item static">
        <Avatar path={active.trainer?.avatar_path} name={active.trainer?.name} size={44} />
        <span className="fj-item-m"><b>{active.trainer?.name || 'Tu entrenador'}</b>
          <span>{active.trainer?.name ? `Tu entrenador · plan ${trainerPro ? 'Pro' : 'Free'}` : `Plan ${trainerPro ? 'Pro' : 'Free'}`}</span></span>
      </div>}
      {pending && <div className="fj-note">
        Esperando que <b>{pending.trainer?.name}</b> acepte tu solicitud.{active ? ' Mientras tanto sigues con tu entrenador actual.' : ''}
        {!active && <> <button type="button" className="fj-link" onClick={leave}>Retirar solicitud</button></>}
      </div>}
      {links.data && !active && !pending && <>
        <p className="dim small">No tienes entrenador: usas la app con acceso básico.</p>
        <Button variant="primary" type="button" onClick={() => setPanel('trainer')}>Elegir entrenador</Button>
      </>}
      {active && <button type="button" className="fj-link danger" onClick={leave}>Dejar de entrenar con {active.trainer?.name || 'este entrenador'}</button>}
    </section>

    {active && pays.data && (() => {
      const mine = pays.data.filter(p => p.client_id === row.id)
      if (active.monthly_fee == null && !mine.length) return null
      const status = paymentStatus(mine)
      const last = mine[0]?.period
      return <section className="fj-card">
        <div className="fj-card-head">
          <h3>Mensualidad</h3>
          <span className={'fj-status ' + status}>{PAYMENT_LABEL[status]}</span>
        </div>
        <p className="fj-p">
          {active.monthly_fee != null ? `${money(active.monthly_fee)} al mes` : ''}
          {last ? `${active.monthly_fee != null ? ' · ' : ''}último pago: ${monthName(last)} ${last.slice(0, 4)}`
            : `${active.monthly_fee != null ? ' · ' : ''}sin pagos registrados`}
        </p>
        {status !== 'al_dia' && <p className="dim small">Cuando pagues, tu entrenador lo registra aquí y queda al día.</p>}
      </section>
    })()}

    {active && <>
      <h2 className="fj-subtitle">Mi dieta</h2>
      <Diet clientId={row.id} canEdit={false} pro={trainerPro} lockedText="La dieta es parte del plan Pro de tu entrenador." />
    </>}

    <h2 className="fj-subtitle">Mis medidas y avances</h2>
    <Metrics clientId={row.id} canEdit={clientCanEditMetrics(active)} pro={trainerPro}
      readOnlyNote={active ? (active.trainer?.name
        ? `Las carga y corrige ${active.trainer.name}, tu entrenador. Aquí las ves en solo lectura.`
        : 'Las carga tu entrenador. Aquí las ves en solo lectura.') : null} />

    {panel === 'gym' && <ChangeGym row={row} onClose={() => { setPanel(null); gym.reload() }} />}
    {panel === 'trainer' && <Panel title={active ? 'Cambiar de entrenador' : 'Elegir entrenador'} onClose={() => setPanel(null)}>
      {active && <div className="fj-note">Tu nuevo entrenador recibirá una solicitud. Cuando la acepte, verá todo tu historial y {active.trainer?.name} dejará de verlo.</div>}
      <TrainerPicker gymId={row.gym_id} remote={!row.gym_id && row.remote} currentTrainerId={active?.trainer_id}
        onRequested={(l, t) => { toast('Solicitud enviada a ' + t.name); setPanel(null); reload() }} />
    </Panel>}
  </div>
}
