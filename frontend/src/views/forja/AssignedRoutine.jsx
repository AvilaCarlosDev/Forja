// Forja: una rutina que asignó el coach, vista por el cliente desde Plan. Solo lectura: cada
// ejercicio con su imagen y lo que indicó el coach; tocarlo abre cómo se hace.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { daysText } from '../../lib/forja-routines.js'
import { ExerciseLine, ExerciseDetail } from './Routines.jsx'
import '../../forja.css'

export default function AssignedRoutine({ r }) {
  const nav = useNavigate()
  const [detail, setDetail] = useState(null)
  return <div className="narrow fj-page">
    <div className="fj-switch">
      <button type="button" className="fj-icon-btn" aria-label="Volver al plan" onClick={() => nav('/plan')}><Icon name="chevronLeft" /></button>
      <h1 className="fj-title">{r.name}</h1>
    </div>
    <div className="fj-note">Te la asignó {r.assigned?.by || 'tu coach'} · {daysText(r.assigned?.days)}. Se entrena tal cual la indicó; solo tu coach la puede cambiar.</div>
    {r.assigned?.note && <div className="fj-note"><b>Indicaciones:</b> {r.assigned.note}</div>}
    <section className="fj-card">
      <ul className="fj-ex-list">{r.ex.map((e, i) => <ExerciseLine key={i} e={e} onOpen={() => setDetail(e)} />)}</ul>
    </section>
    {detail && <ExerciseDetail e={detail} onClose={() => setDetail(null)} />}
  </div>
}
