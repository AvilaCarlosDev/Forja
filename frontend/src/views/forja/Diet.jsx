// Forja: la dieta del cliente (función Pro). La arma y la cambia su entrenador; el cliente la
// ve en solo lectura. Si el entrenador no tiene Pro vigente, la dieta no se muestra ni se edita
// (los datos quedan guardados para cuando renueve).
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { api } from '../../lib/forja-api.js'
import {
  MACROS, itemFromFood, unitsText, mealTotals, dayTotals, versusTargets, customItem, parseTargets,
  cleanPlan, starterMeals, searchFoods, LIMITS,
} from '../../lib/forja-diet.js'
import { useUI } from '../../store/useUI.js'
import { Field, Panel, Loading, ErrorNote, useLoad } from './parts.jsx'

const toast = m => useUI.getState().toast(m)
const fmt = v => String(Math.round(Number(v || 0) * 10) / 10).replace('.', ',')
const SHORT = { kcal: 'kcal', protein: 'P', carbs: 'C', fat: 'G' }
const macroLine = t => `${fmt(t.kcal)} kcal · P ${fmt(t.protein)} · C ${fmt(t.carbs)} · G ${fmt(t.fat)}`

// Totales del día contra el objetivo, con una barra por macro.
function DayTotals({ meals, targets }) {
  const v = versusTargets(dayTotals(meals), targets)
  return <div className="fj-stats">
    {MACROS.map(m => <div key={m.key} className="fj-stat">
      <span>{m.label}</span>
      <b>{fmt(v[m.key].total)} <small>{v[m.key].target ? `/ ${fmt(v[m.key].target)} ${m.unit}` : m.unit}</small></b>
      {v[m.key].pct != null && <div className={'fj-meter' + (v[m.key].pct > 110 ? ' over' : '')} role="meter"
        aria-label={`${m.label}: ${v[m.key].pct} % del objetivo`} aria-valuenow={v[m.key].pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: Math.min(100, v[m.key].pct) + '%' }} />
      </div>}
    </div>)}
  </div>
}

function MealView({ meal }) {
  const t = mealTotals(meal)
  return <li className="fj-meal">
    <div className="fj-meal-head"><b>{meal.name}</b>{meal.time && <span className="dim small">{meal.time}</span>}
      <span className="dim small fj-meal-kcal">{fmt(t.kcal)} kcal</span></div>
    {meal.items.length ? <ul className="fj-foods">{meal.items.map((it, i) => <li key={i}>
      <span>{it.name} <span className="dim">· {fmt(it.grams)} g {unitsText(it) && `(${unitsText(it)})`}</span></span>
      <small className="dim">{macroLine(it)}</small>
    </li>)}</ul> : <p className="dim small">Sin alimentos.</p>}
  </li>
}

// Agregar un alimento a una comida: de la lista (con los gramos) o uno propio con sus macros.
function FoodAdder({ onAdd, onCancel }) {
  const [q, setQ] = useState('')
  const [food, setFood] = useState(null)
  const [grams, setGrams] = useState('')
  const [own, setOwn] = useState(null)
  const [errors, setErrors] = useState({})
  const results = searchFoods(q)
  const pick = f => { setFood(f); setGrams(String(f.unit?.g ?? 100)) }
  const addFood = () => {
    const g = Number(String(grams).replace(',', '.'))
    if (!(g > 0 && g <= 3000)) { setErrors({ grams: 'Porción: entre 1 y 3000 g' }); return }
    onAdd(itemFromFood(food, g))
  }
  const addOwn = () => {
    const { item, errors: bad } = customItem(own)
    setErrors(bad)
    if (!Object.keys(bad).length) onAdd(item)
  }
  if (own) return <div className="fj-adder">
    <Field id="fj-own-name" label="Alimento" error={errors.name}>
      <input id="fj-own-name" className="input" maxLength={LIMITS.text} value={own.name || ''} onChange={e => setOwn(p => ({ ...p, name: e.target.value }))} />
    </Field>
    <div className="fj-grid2">
      <Field id="fj-own-g" label="Porción (g)" error={errors.grams}>
        <input id="fj-own-g" className="input" inputMode="decimal" value={own.grams || ''} onChange={e => setOwn(p => ({ ...p, grams: e.target.value }))} />
      </Field>
      {MACROS.map(m => <Field key={m.key} id={'fj-own-' + m.key} label={`${m.label} (${m.unit})`} error={errors[m.key]}>
        <input id={'fj-own-' + m.key} className="input" inputMode="decimal" value={own[m.key] || ''} onChange={e => setOwn(p => ({ ...p, [m.key]: e.target.value }))} />
      </Field>)}
    </div>
    <p className="dim small">Los macros son de la porción completa. Si dejas las calorías vacías, se calculan con los macros.</p>
    <div className="fj-row"><Button variant="primary" size="sm" type="button" onClick={addOwn}>Agregar</Button>
      <Button size="sm" type="button" onClick={() => setOwn(null)}>Volver a la lista</Button></div>
  </div>
  return <div className="fj-adder">
    {!food ? <>
      <Field id="fj-food-q" label="Buscar alimento">
        <input id="fj-food-q" className="input" autoComplete="off" placeholder="Ej.: arepa, pollo, avena" value={q} onChange={e => setQ(e.target.value)} />
      </Field>
      {results.length > 0 && <ul className="fj-food-results">{results.map(f => <li key={f.id}>
        <button type="button" className="fj-item" onClick={() => pick(f)}>
          <span className="fj-item-m"><b>{f.name}</b><span>{`100 g: ${f.kcal} kcal · P ${fmt(f.p)} · C ${fmt(f.c)} · G ${fmt(f.f)}`}</span></span>
        </button>
      </li>)}</ul>}
      {q.trim() && !results.length && <p className="dim small">No está en la lista. Cárgalo como alimento propio.</p>}
      <div className="fj-row">
        <button type="button" className="fj-link" onClick={() => setOwn({ name: q.trim() })}>Alimento propio</button>
        <button type="button" className="fj-link" onClick={onCancel}>Cancelar</button>
      </div>
    </> : <>
      <p className="fj-p"><b>{food.name}</b></p>
      <Field id="fj-food-g" label="Porción (g)" error={errors.grams}
        hint={food.unit ? `1 ${food.unit.label} ≈ ${fmt(food.unit.g)} g` : undefined}>
        <input id="fj-food-g" className="input" inputMode="decimal" value={grams} onChange={e => { setGrams(e.target.value); setErrors({}) }} />
      </Field>
      {Number(grams) > 0 && <p className="dim small">{macroLine(itemFromFood(food, Number(String(grams).replace(',', '.'))))}</p>}
      <div className="fj-row"><Button variant="primary" size="sm" type="button" onClick={addFood}>Agregar</Button>
        <Button size="sm" type="button" onClick={() => setFood(null)}>Otro alimento</Button></div>
    </>}
  </div>
}

function DietEditor({ clientId, clientName, diet, onSaved, onClose }) {
  const [meals, setMeals] = useState(() => diet?.meals?.length ? structuredClone(diet.meals) : starterMeals())
  const [tf, setTf] = useState(() => Object.fromEntries(MACROS.map(m => [m.key, diet?.targets?.[m.key] ?? ''])))
  const [notes, setNotes] = useState(diet?.notes || '')
  const [adding, setAdding] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { targets, errors: tErr } = parseTargets(tf)
  const editMeal = (i, patch) => setMeals(ms => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const save = async e => {
    e.preventDefault(); setErr('')
    setErrors(tErr)
    if (Object.keys(tErr).length) return
    setBusy(true)
    try { await api().setDiet(clientId, cleanPlan({ targets, meals, notes })); toast('Dieta guardada'); onSaved() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title={`Dieta de ${clientName || 'tu cliente'}`} onClose={onClose}>
    <form className="fj-form" onSubmit={save} noValidate>
      <div className="fj-legend">Objetivo diario (opcional)</div>
      <div className="fj-grid2">{MACROS.map(m => <Field key={m.key} id={'fj-t-' + m.key} label={`${m.label} (${m.unit})`} error={errors[m.key]}>
        <input id={'fj-t-' + m.key} className="input" inputMode="decimal" value={tf[m.key]} onChange={e => setTf(p => ({ ...p, [m.key]: e.target.value }))} />
      </Field>)}</div>
      <DayTotals meals={meals} targets={targets} />

      {meals.map((meal, i) => <section key={i} className="fj-card fj-meal-edit">
        <div className="fj-meal-fields">
          <input className="input" aria-label={`Nombre de la comida ${i + 1}`} maxLength={LIMITS.text} value={meal.name} onChange={e => editMeal(i, { name: e.target.value })} />
          <input className="input" type="time" aria-label={`Hora de ${meal.name || 'la comida'}`} value={meal.time || ''} onChange={e => editMeal(i, { time: e.target.value })} />
          <button type="button" className="fj-icon-btn small" aria-label={`Quitar ${meal.name || 'comida'}`} onClick={() => setMeals(ms => ms.filter((_, j) => j !== i))}>×</button>
        </div>
        <ul className="fj-foods">{meal.items.map((it, k) => <li key={k}>
          <span>{it.name} <span className="dim">· {fmt(it.grams)} g {unitsText(it) && `(${unitsText(it)})`}</span></span>
          <small className="dim">{macroLine(it)}</small>
          <button type="button" className="fj-link danger" aria-label={`Quitar ${it.name}`} onClick={() => editMeal(i, { items: meal.items.filter((_, j) => j !== k) })}>Quitar</button>
        </li>)}</ul>
        {adding === i
          ? <FoodAdder onCancel={() => setAdding(null)} onAdd={it => { editMeal(i, { items: [...meal.items, it] }); setAdding(null) }} />
          : meal.items.length < LIMITS.items && <button type="button" className="fj-link" onClick={() => setAdding(i)}>+ Agregar alimento</button>}
        <small className="dim">Subtotal: {macroLine(mealTotals(meal))}</small>
      </section>)}
      {meals.length < LIMITS.meals && <button type="button" className="fj-link" onClick={() => setMeals(ms => [...ms, { name: 'Comida', time: '', items: [] }])}>+ Agregar comida</button>}

      <Field id="fj-diet-notes" label="Indicaciones (opcional)">
        <textarea id="fj-diet-notes" className="input" rows={3} maxLength={LIMITS.notes} placeholder="Ej.: 2 L de agua al día, sin azúcar añadida" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <p className="dim small">Los valores de la lista son aproximados por 100 g.</p>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar dieta'}</Button>
    </form>
  </Panel>
}

export default function Diet({ clientId, clientName, canEdit, pro, lockedText }) {
  const diet = useLoad(() => (pro ? api().diet(clientId) : null), [clientId, pro])
  const [editing, setEditing] = useState(false)
  if (!pro) return <section className="fj-card">
    <div className="fj-card-head"><h3>Dieta</h3><span className="fj-badge">Pro</span></div>
    <p className="dim small">{lockedText || 'Las dietas son parte del plan Pro.'}</p>
  </section>
  if (diet.loading && !diet.data) return <Loading text="Cargando dieta…" />
  if (diet.error) return <ErrorNote error={diet.error} retry={diet.reload} />
  const d = diet.data
  const remove = async () => {
    try { await api().deleteDiet(clientId); toast('Dieta borrada'); diet.reload() } catch (x) { toast(x.message) }
  }
  return <>
    <section className="fj-card fj-diet">
      <div className="fj-card-head"><h3>Dieta</h3>
        {canEdit && <Button variant="primary" size="sm" type="button" onClick={() => setEditing(true)}>{d ? 'Editar' : 'Armar dieta'}</Button>}
      </div>
      {!d ? <p className="dim small">{canEdit ? 'Todavía no tiene dieta. Ármala con sus comidas y porciones.' : 'Tu entrenador todavía no te arma la dieta.'}</p> : <>
        {!canEdit && <div className="fj-note">La arma tu entrenador. Aquí la ves en solo lectura.</div>}
        <DayTotals meals={d.meals} targets={d.targets} />
        <ul className="fj-meals">{d.meals.map((m, i) => <MealView key={i} meal={m} />)}</ul>
        {d.notes && <div className="fj-note"><b>Indicaciones:</b> {d.notes}</div>}
        <small className="dim">Actualizada el {new Date(d.updated_at).toLocaleDateString('es-VE')} · valores aproximados</small>
        {canEdit && <button type="button" className="fj-link danger" onClick={remove}>Borrar dieta</button>}
      </>}
    </section>
    {editing && <DietEditor clientId={clientId} clientName={clientName} diet={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); diet.reload() }} />}
  </>
}
