// Forja: rutinas asignadas (0012). El entrenador las arma en la ficha del cliente con el buscador
// de ejercicios de openGym (imágenes, músculos y nombres en español) y les pone series,
// repeticiones y peso; el cliente las ve en Mi coach con la imagen de cada ejercicio y las
// entrena desde «Entrenar», que ya las encuentra en su plan de la semana.
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { api } from '../../lib/forja-api.js'
import { EXIDX, imgSrc, gifSrc } from '../../lib/exercises.js'
import { exerciseNameFor, exerciseNameClass } from '../../lib/i18n.js'
import { WEEKDAYS, daysText, cleanRoutine, ROUTINE_LIMITS } from '../../lib/forja-routines.js'
import { exercisePicker } from '../../sheets.jsx'
import { useUI } from '../../store/useUI.js'
import { Field, Panel, Loading, ErrorNote, useLoad } from './parts.jsx'

const toast = m => useUI.getState().toast(m)
const fmt = v => String(Math.round(Number(v || 0) * 100) / 100).replace('.', ',')
const exOf = id => EXIDX[id] || { id, n: 'Ejercicio', img: '' }
export const exLabel = id => exerciseNameFor(exOf(id)) || 'Ejercicio'
const nameCls = id => exerciseNameClass(exOf(id))
export const doseText = e => `${e.sets} × ${e.reps}${Number(e.weight) > 0 ? ` · ${fmt(e.weight)} kg` : ''}`

function Thumb({ id, size = 48 }) {
  const ex = EXIDX[id]
  return <span className="fj-ex-thumb" style={{ width: size, height: size }} aria-hidden="true">
    {ex?.img ? <img src={imgSrc(ex)} alt="" loading="lazy" /> : null}
  </span>
}

// Un ejercicio de la rutina: imagen, nombre y la dosis del coach. Tocarlo abre su detalle.
export function ExerciseLine({ e, onOpen, children }) {
  return <li className="fj-ex">
    <button type="button" className="fj-ex-open" onClick={onOpen} aria-label={`Ver cómo se hace ${exLabel(e.id)}`}>
      <Thumb id={e.id} />
      <span className="fj-item-m"><b className={nameCls(e.id)}>{exLabel(e.id)}</b><span>{doseText(e)}</span>{e.note && <small className="dim">{e.note}</small>}</span>
    </button>
    {children}
  </li>
}

// Cómo se hace: la animación (o la imagen) del ejercicio y lo que indicó el coach.
export function ExerciseDetail({ e, onClose }) {
  const ex = EXIDX[e.id]
  return <Panel title={exLabel(e.id).replace(/^./, c => c.toUpperCase())} onClose={onClose}>
    {ex && <div className="fj-ex-media">{ex.gif ? <img src={gifSrc(ex)} alt={`Cómo se hace ${exLabel(e.id)}`} /> : ex.img && <img src={imgSrc(ex)} alt="" />}</div>}
    <div className="fj-stats">
      <div className="fj-stat"><span>Series</span><b>{e.sets}</b></div>
      <div className="fj-stat"><span>Repeticiones</span><b>{e.reps}</b></div>
      <div className="fj-stat"><span>Peso</span><b>{Number(e.weight) > 0 ? fmt(e.weight) : '—'} <small>{Number(e.weight) > 0 ? 'kg' : ''}</small></b></div>
    </div>
    {e.note && <div className="fj-note"><b>Indicación del coach:</b> {e.note}</div>}
    <Button variant="primary" type="button" onClick={onClose}>Entendido</Button>
  </Panel>
}

function RoutineEditor({ clientId, clientName, routine, onSaved, onClose }) {
  const [f, setF] = useState(() => ({
    name: routine?.name || '', days: routine?.days || [], note: routine?.note || '',
    exercises: (routine?.exercises || []).map(e => ({ ...e, weight: e.weight ?? '' })),
  }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }
  const editEx = (i, patch) => setF(p => ({ ...p, exercises: p.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))
  const move = (i, by) => setF(p => {
    const list = [...p.exercises], j = i + by
    if (j < 0 || j >= list.length) return p
    ;[list[i], list[j]] = [list[j], list[i]]; return { ...p, exercises: list }
  })
  const add = () => exercisePicker(ex => {
    setF(p => p.exercises.length >= ROUTINE_LIMITS.exercises ? p : { ...p, exercises: [...p.exercises, { id: ex.id, sets: 3, reps: 10, weight: '' }] })
    setErrors(p => ({ ...p, exercises: undefined }))
  }, { title: 'Agregar a la rutina' })
  const toggleDay = d => set('days', f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d])
  const save = async e => {
    e.preventDefault(); setErr('')
    const { routine: clean, errors: bad } = cleanRoutine(f)
    setErrors(bad)
    if (Object.keys(bad).length) return
    setBusy(true)
    try { await api().setRoutine(clientId, routine?.id, clean); toast(routine ? 'Rutina actualizada' : `Rutina asignada a ${clientName || 'tu cliente'}`); onSaved() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title={routine ? 'Editar rutina' : `Rutina para ${clientName || 'tu cliente'}`} onClose={onClose}>
    <form className="fj-form" onSubmit={save} noValidate>
      <Field id="fj-rt-name" label="Nombre" error={errors.name}>
        <input id="fj-rt-name" className="input" maxLength={ROUTINE_LIMITS.name} placeholder="Ej.: Pecho y tríceps" value={f.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <div className="fj-field">
        <div className="fj-legend" id="fj-rt-days">Días</div>
        <div className="fj-chips fj-days" role="group" aria-labelledby="fj-rt-days">
          {WEEKDAYS.map(w => <button key={w.d} type="button" aria-pressed={f.days.includes(w.d)} aria-label={w.label}
            className={'fj-chip' + (f.days.includes(w.d) ? ' on' : '')} onClick={() => toggleDay(w.d)}>{w.short}</button>)}
        </div>
      </div>
      <div className="fj-legend">Ejercicios</div>
      {f.exercises.length > 0 && <ul className="fj-ex-list">{f.exercises.map((e, i) => <li key={i} className="fj-ex-edit">
        <div className="fj-ex-edit-head">
          <Thumb id={e.id} size={40} />
          <b className={nameCls(e.id)}>{exLabel(e.id)}</b>
          <span className="fj-ex-edit-tools">
            <button type="button" className="fj-icon-btn small" aria-label={`Subir ${exLabel(e.id)}`} disabled={!i} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="fj-icon-btn small" aria-label={`Bajar ${exLabel(e.id)}`} disabled={i === f.exercises.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="fj-icon-btn small" aria-label={`Quitar ${exLabel(e.id)}`} onClick={() => setF(p => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }))}>×</button>
          </span>
        </div>
        <div className="fj-ex-dose">
          <label>Series<input className="input" inputMode="numeric" aria-label={`Series de ${exLabel(e.id)}`} value={e.sets} onChange={ev => editEx(i, { sets: ev.target.value })} /></label>
          <label>Reps<input className="input" inputMode="numeric" aria-label={`Repeticiones de ${exLabel(e.id)}`} value={e.reps} onChange={ev => editEx(i, { reps: ev.target.value })} /></label>
          <label>Peso (kg)<input className="input" inputMode="decimal" aria-label={`Peso de ${exLabel(e.id)}`} placeholder="—" value={e.weight} onChange={ev => editEx(i, { weight: ev.target.value })} /></label>
        </div>
        <input className="input" maxLength={ROUTINE_LIMITS.exNote} aria-label={`Indicación para ${exLabel(e.id)}`} placeholder="Indicación (opcional): bajar lento, codos pegados…" value={e.note || ''} onChange={ev => editEx(i, { note: ev.target.value })} />
        {errors['ex' + i] && <div className="fj-err" role="alert">{errors['ex' + i]}</div>}
      </li>)}</ul>}
      {f.exercises.length < ROUTINE_LIMITS.exercises && <Button variant="tinted" type="button" onClick={add}>+ Agregar ejercicio</Button>}
      {errors.exercises && <div className="fj-err" role="alert">{errors.exercises}</div>}
      <Field id="fj-rt-note" label="Indicaciones de la rutina (opcional)">
        <textarea id="fj-rt-note" className="input" rows={2} maxLength={ROUTINE_LIMITS.note} placeholder="Ej.: calentar 10 min en la caminadora" value={f.note} onChange={e => set('note', e.target.value)} />
      </Field>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : routine ? 'Guardar cambios' : 'Asignar rutina'}</Button>
    </form>
  </Panel>
}

// Lista de rutinas de un cliente. El entrenador las asigna, edita y borra; el cliente solo mira.
export default function Routines({ clientId, clientName, canEdit, coachName }) {
  const list = useLoad(() => api().routines(clientId), [clientId])
  const [editing, setEditing] = useState(null)   // null | 'new' | rutina
  const [detail, setDetail] = useState(null)
  if (list.loading && !list.data) return <Loading text="Cargando rutinas…" />
  if (list.error) return <ErrorNote error={list.error} retry={list.reload} />
  const rows = list.data || []
  const remove = async r => {
    try { await api().deleteRoutine(r.id); toast('Rutina borrada'); list.reload() } catch (x) { toast(x.message) }
  }
  return <section className="fj-card">
    <div className="fj-card-head"><h3>Rutinas</h3>
      {canEdit && <Button variant="primary" size="sm" type="button" onClick={() => setEditing('new')}>Asignar rutina</Button>}
    </div>
    {!canEdit && rows.length > 0 && <div className="fj-note">Te las asignó {coachName || 'tu coach'}. Toca un ejercicio para ver cómo se hace; para entrenar, usa «Entrenar» en el inicio.</div>}
    {!rows.length && <p className="dim small">{canEdit ? 'Todavía no tiene rutinas. Asígnale la primera: le llegará el aviso y la verá en «Entrenar».' : 'Tu coach todavía no te asigna rutinas.'}</p>}
    {rows.map(r => <div key={r.id} className="fj-routine">
      <div className="fj-routine-head"><b>{r.name}</b><span className="dim small">{daysText(r.days)}</span></div>
      {r.note && <small className="dim">{r.note}</small>}
      <ul className="fj-ex-list">{r.exercises.map((e, i) => <ExerciseLine key={i} e={e} onOpen={() => setDetail(e)} />)}</ul>
      {canEdit && <div className="fj-row">
        <Button variant="tinted" size="sm" type="button" onClick={() => setEditing(r)}>Editar</Button>
        <Button variant="danger" size="sm" type="button" onClick={() => remove(r)}>Borrar</Button>
      </div>}
    </div>)}
    {editing && <RoutineEditor clientId={clientId} clientName={clientName} routine={editing === 'new' ? null : editing}
      onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload() }} />}
    {detail && <ExerciseDetail e={detail} onClose={() => setDetail(null)} />}
  </section>
}
