// Forja: el cliente elige a su entrenador entre los que trabajan en su gimnasio (o entrenan a
// distancia, si él entrena en casa). Elegir manda una solicitud que el entrenador acepta.
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { gymLabel } from '../../lib/forja-coach.js'
import { Avatar } from './Avatar.jsx'
import { Loading, ErrorNote, useLoad } from './parts.jsx'

export default function TrainerPicker({ gymId, remote, currentTrainerId, onRequested, onNone, noneLabel = 'No tengo entrenador' }) {
  const trainers = useLoad(() => api().listTrainers(remote ? null : gymId), [gymId, remote])
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const send = async () => {
    if (!pick) { setErr('Elige a tu entrenador'); return }
    setBusy(true); setErr('')
    try { const l = await api().requestTrainer(pick.id); onRequested?.(l, pick) }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  const list = (trainers.data || []).filter(t => t.id !== currentTrainerId)
  return <div className="fj-form">
    {trainers.loading && !trainers.data && <Loading text="Buscando entrenadores…" />}
    {trainers.error && <ErrorNote error={trainers.error} retry={trainers.reload} />}
    {trainers.data && <div className="fj-list" role="radiogroup" aria-label="Entrenadores">
      {list.map(t => <button key={t.id} type="button" role="radio" aria-checked={pick?.id === t.id}
        className={'fj-item' + (pick?.id === t.id ? ' on' : '')} onClick={() => { setPick(t); setErr('') }}>
        <Avatar path={t.avatar_path} name={t.name} size={44} />
        <span className="fj-item-m">
          <b>{t.name}</b>
          <span>{t.gyms?.length ? t.gyms.map(gymLabel).join(' · ') : 'Entrena a distancia'}</span>
        </span>
        {pick?.id === t.id && <Icon name="checkCircle" />}
      </button>)}
      {!list.length && <div className="fj-note">
        {remote ? 'Todavía no hay entrenadores a distancia en Forja.' : 'Todavía no hay entrenadores de tu gimnasio en Forja.'} Puedes seguir sin entrenador y elegirlo después desde «Mi coach».
      </div>}
    </div>}
    {err && <div className="fj-err" role="alert">{err}</div>}
    {list.length > 0 && <Button variant="primary" type="button" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar solicitud'}</Button>}
    {onNone && <Button variant="tinted" type="button" onClick={onNone}>{noneLabel}</Button>}
    <div className="dim small fj-center">Tu entrenador recibe una notificación y debe aceptarte. Mientras tanto usas la app con acceso básico.</div>
  </div>
}
