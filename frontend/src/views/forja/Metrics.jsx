// Forja: medidas, meta y avances de un cliente. El entrenador activo carga y corrige; el cliente
// vinculado solo lee; un cliente sin entrenador carga lo básico él mismo. La comparativa de
// inicio contra hoy es función Pro (del plan del entrenador).
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { api } from '../../lib/forja-api.js'
import { METRIC_FIELDS, GIRTHS, metricRow, latestValues, progress, bmi } from '../../lib/forja-coach.js'
import { todayISO } from '../../lib/forja-profile.js'
import { useUI } from '../../store/useUI.js'
import { Field, Panel, Loading, ErrorNote, useLoad } from './parts.jsx'

const toast = m => useUI.getState().toast(m)
const fmt = v => (v == null ? '—' : String(Math.round(Number(v) * 10) / 10).replace('.', ','))
const sign = d => (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d))
const fmtDate = iso => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}` }

function AddMetric({ clientId, onSaved, onClose }) {
  const today = todayISO()
  const [f, setF] = useState({ measured_on: today })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined, form: undefined })) }
  const submit = async e => {
    e.preventDefault(); setErr('')
    const { row, errors: bad } = metricRow(f, clientId, today)
    setErrors(bad)
    if (Object.keys(bad).length) return
    setBusy(true)
    try { await api().addMetric(row); toast('Medición guardada'); onSaved() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  const input = (key, label, unit) => <Field key={key} id={'fj-m-' + key} label={`${label} (${unit})`} error={errors[key]}>
    <input id={'fj-m-' + key} className="input" inputMode="decimal" value={f[key] || ''} onChange={e => set(key, e.target.value)} />
  </Field>
  return <Panel title="Nueva medición" onClose={onClose}>
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-m-date" label="Fecha" error={errors.measured_on}>
        <input id="fj-m-date" className="input" type="date" max={today} value={f.measured_on} onChange={e => set('measured_on', e.target.value)} />
      </Field>
      <div className="fj-grid2">{METRIC_FIELDS.map(m => input(m.key, m.label, m.unit))}</div>
      <div className="fj-legend">Perímetros (cm)</div>
      <div className="fj-grid2">{GIRTHS.map(g => input(g.key, g.label, 'cm'))}</div>
      <Field id="fj-m-note" label="Nota (opcional)">
        <textarea id="fj-m-note" className="input" rows={2} maxLength={500} value={f.note || ''} onChange={e => set('note', e.target.value)} />
      </Field>
      {errors.form && <div className="fj-err" role="alert">{errors.form}</div>}
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar medición'}</Button>
    </form>
  </Panel>
}

function GoalCard({ clientId, canEdit }) {
  const goal = useLoad(() => api().goal(clientId), [clientId])
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({})
  const [err, setErr] = useState('')
  const g = goal.data
  const save = async e => {
    e.preventDefault(); setErr('')
    const t = f.target_weight_kg ? Number(String(f.target_weight_kg).replace(',', '.')) : null
    if (t != null && !(t >= 20 && t <= 400)) { setErr('Peso meta: entre 20 y 400 kg'); return }
    try { await api().setGoal(clientId, { goal: (f.goal || '').trim() || null, target_weight_kg: t, target_date: f.target_date || null }); setEditing(false); goal.reload() }
    catch (x) { setErr(x.message) }
  }
  return <section className="fj-card">
    <div className="fj-card-head"><h3>Meta</h3>
      {canEdit && !editing && <button type="button" className="fj-link" onClick={() => { setF({ goal: g?.goal || '', target_weight_kg: g?.target_weight_kg ?? '', target_date: g?.target_date || '' }); setEditing(true) }}>{g ? 'Cambiar' : 'Fijar meta'}</button>}
    </div>
    {editing ? <form className="fj-form" onSubmit={save} noValidate>
      <Field id="fj-goal" label="Objetivo"><input id="fj-goal" className="input" maxLength={300} placeholder="Ej.: bajar grasa y ganar fuerza" value={f.goal} onChange={e => setF(p => ({ ...p, goal: e.target.value }))} /></Field>
      <div className="fj-grid2">
        <Field id="fj-goal-w" label="Peso meta (kg)"><input id="fj-goal-w" className="input" inputMode="decimal" value={f.target_weight_kg} onChange={e => setF(p => ({ ...p, target_weight_kg: e.target.value }))} /></Field>
        <Field id="fj-goal-d" label="Para el"><input id="fj-goal-d" className="input" type="date" value={f.target_date} onChange={e => setF(p => ({ ...p, target_date: e.target.value }))} /></Field>
      </div>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <div className="fj-row"><Button variant="primary" type="submit">Guardar</Button><Button type="button" onClick={() => setEditing(false)}>Cancelar</Button></div>
    </form>
      : goal.loading && !g ? <Loading /> : g ? <p className="fj-p">{g.goal || 'Sin objetivo escrito'}{g.target_weight_kg ? ` · ${fmt(g.target_weight_kg)} kg` : ''}{g.target_date ? ` · para el ${fmtDate(g.target_date)}` : ''}</p>
        : <p className="dim small">Sin meta todavía.</p>}
  </section>
}

export default function Metrics({ clientId, canEdit, pro, readOnlyNote }) {
  const rows = useLoad(() => api().metrics(clientId), [clientId])
  const [adding, setAdding] = useState(false)
  if (rows.loading && !rows.data) return <Loading text="Cargando medidas…" />
  if (rows.error) return <ErrorNote error={rows.error} retry={rows.reload} />
  const data = rows.data || []
  const last = latestValues(data)
  const prog = progress(data)
  const imc = bmi(last.weight_kg?.value, last.height_cm?.value)
  const remove = async id => {
    try { await api().deleteMetric(id); rows.reload() } catch (x) { toast(x.message) }
  }
  return <div className="fj-metrics">
    {readOnlyNote && <div className="fj-note">{readOnlyNote}</div>}
    <section className="fj-card">
      <div className="fj-card-head"><h3>Medidas actuales</h3>
        {canEdit && <Button variant="primary" size="sm" type="button" onClick={() => setAdding(true)}>Nueva medición</Button>}
      </div>
      {!data.length ? <p className="dim small">Todavía no hay medidas{canEdit ? '. Carga la primera: será el punto de partida.' : '.'}</p>
        : <div className="fj-stats">
          {METRIC_FIELDS.filter(f => last[f.key]).map(f => <div key={f.key} className="fj-stat">
            <span>{f.label}</span><b>{fmt(last[f.key].value)} <small>{f.unit}</small></b>
          </div>)}
          {imc && <div className="fj-stat"><span>IMC</span><b>{fmt(imc)}</b></div>}
        </div>}
    </section>
    <GoalCard clientId={clientId} canEdit={canEdit} />
    {Object.keys(prog).length > 0 && <section className="fj-card">
      <div className="fj-card-head"><h3>Avance desde el inicio</h3>{!pro && <span className="fj-badge">Pro</span>}</div>
      {pro ? <div className="fj-stats">
        {METRIC_FIELDS.filter(f => prog[f.key]).map(f => <div key={f.key} className="fj-stat">
          <span>{f.label}</span><b>{sign(prog[f.key].diff)} <small>{f.unit}</small></b>
          <small className="dim">{fmt(prog[f.key].first)} → {fmt(prog[f.key].last)}</small>
        </div>)}
      </div> : <p className="dim small">La comparativa de inicio contra hoy es parte del plan Pro del entrenador.</p>}
    </section>}
    {data.length > 0 && <section className="fj-card">
      <div className="fj-card-head"><h3>Historial</h3><span className="dim small">{data.length} {data.length === 1 ? 'registro' : 'registros'}</span></div>
      <ul className="fj-history">
        {data.map(m => <li key={m.id}>
          <b>{fmtDate(m.measured_on)}</b>
          <span>{METRIC_FIELDS.filter(f => m[f.key] != null).map(f => `${f.label} ${fmt(m[f.key])} ${f.unit}`)
            .concat(GIRTHS.filter(g => m.measurements?.[g.key] != null).map(g => `${g.label} ${fmt(m.measurements[g.key])} cm`)).join(' · ')}</span>
          {m.note && <em>{m.note}</em>}
          {canEdit && <button type="button" className="fj-link danger" onClick={() => remove(m.id)} aria-label={'Borrar medición del ' + fmtDate(m.measured_on)}>Borrar</button>}
        </li>)}
      </ul>
    </section>}
    {adding && <AddMetric clientId={clientId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); rows.reload() }} />}
  </div>
}
