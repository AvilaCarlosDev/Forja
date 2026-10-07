// Forja: finanzas del entrenador (plan Pro) — la mensualidad de cada cliente, los pagos
// que cobra por fuera y el resumen del mes. Sin pasarela: el cobro es manual y esto solo
// lo anota. El cliente ve únicamente su propia mensualidad, en Mi coach.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { useForjaProfile } from '../../lib/forja-session.js'
import { effectivePlan, financeSummary, PAYMENT_LABEL, monthKey, monthName, money } from '../../lib/forja-coach.js'
import { todayISO } from '../../lib/forja-profile.js'
import { useUI } from '../../store/useUI.js'
import { Avatar } from './Avatar.jsx'
import { Panel, Field, Loading, ErrorNote, useLoad } from './parts.jsx'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)
const formatDate = iso => new Date(iso + 'T12:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })

function RegisterPayment({ link, onClose, onDone }) {
  const [f, setF] = useState({
    amount: link.monthly_fee != null ? String(link.monthly_fee) : '',
    period: monthKey(),
    paid_at: todayISO(),
    note: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr('') }
  const submit = async e => {
    e.preventDefault()
    if (String(f.amount).trim() === '' || !(Number(f.amount) >= 0)) { setErr('Escribe un monto'); return }
    setBusy(true)
    try {
      await api().registerPayment({ client: link.client_id, amount: Number(f.amount), period: f.period, paid_at: f.paid_at, note: f.note })
      toast('Pago registrado'); onDone()
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title={`Registrar pago — ${link.client?.name || 'cliente'}`} onClose={onClose}>
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-fin-amount" label="Monto cobrado" error={err && err.includes('monto') ? err : ''}
        hint={link.monthly_fee != null ? `Tu mensualidad para este cliente es ${money(link.monthly_fee)}.` : 'Aún no defines la mensualidad de este cliente.'}>
        <input id="fj-fin-amount" className="input" type="number" inputMode="decimal" min="0" step="0.01"
          value={f.amount} onChange={e => set('amount', e.target.value)} />
      </Field>
      <Field id="fj-fin-period" label="Mes que cubre">
        <input id="fj-fin-period" className="input" type="month" max={monthKey()} value={f.period} onChange={e => set('period', e.target.value)} />
      </Field>
      <Field id="fj-fin-paid" label="Fecha de pago">
        <input id="fj-fin-paid" className="input" type="date" max={todayISO()} value={f.paid_at} onChange={e => set('paid_at', e.target.value)} />
      </Field>
      <Field id="fj-fin-note" label="Nota (opcional)">
        <input id="fj-fin-note" className="input" maxLength={80} placeholder="Efectivo, transferencia…"
          value={f.note} onChange={e => set('note', e.target.value)} />
      </Field>
      {err && !err.includes('monto') && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Registrar pago'}</Button>
    </form>
  </Panel>
}

function FeePanel({ link, onClose, onDone }) {
  const [v, setV] = useState(link.monthly_fee != null ? String(link.monthly_fee) : '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async clear => {
    const fee = clear || v.trim() === '' ? null : Number(v)
    if (!clear && fee != null && !(fee >= 0)) { setErr('Escribe un monto válido'); return }
    setBusy(true)
    try {
      await api().setLinkFee(link.id, fee)
      toast(clear ? 'Mensualidad quitada' : 'Mensualidad guardada'); onDone()
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title={`Mensualidad de ${link.client?.name || 'cliente'}`} onClose={onClose}>
    <div className="fj-form">
      <Field id="fj-fin-fee" label="Cuánto cobras por mes"
        hint="Cobras por fuera; aquí queda anotado para ti y tu cliente." error={err}>
        <input id="fj-fin-fee" className="input" type="number" inputMode="decimal" min="0" step="0.01"
          placeholder="Ej.: 30" value={v} onChange={e => { setV(e.target.value); setErr('') }} />
      </Field>
      <Button variant="primary" type="button" disabled={busy} onClick={() => save(false)}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      {link.monthly_fee != null && <Button type="button" disabled={busy} onClick={() => save(true)}>Quitar mensualidad</Button>}
    </div>
  </Panel>
}

function History({ link, payments, onClose, onChanged }) {
  const mine = payments.filter(p => p.client_id === link.client_id)
  const [busy, setBusy] = useState(null)
  const del = async id => {
    setBusy(id)
    try { await api().deletePayment(id); toast('Pago eliminado'); onChanged() }
    catch (x) { toast(x.message) }
    finally { setBusy(null) }
  }
  return <Panel title={`Pagos de ${link.client?.name || 'cliente'}`} onClose={onClose}>
    {!mine.length && <p className="dim small">Todavía no registras pagos de {link.client?.name}.</p>}
    <ul className="fj-list">
      {mine.map(p => <li key={p.id} className="fj-item static">
        <span className="fj-item-m">
          <b>{money(p.amount)} · {monthName(p.period)} {p.period.slice(0, 4)}</b>
          <span>pagado el {formatDate(p.paid_at)}{p.note ? ` · ${p.note}` : ''}</span>
        </span>
        <button type="button" className="fj-link danger" disabled={busy === p.id} onClick={() => del(p.id)}>
          {busy === p.id ? '…' : 'Borrar'}
        </button>
      </li>)}
    </ul>
  </Panel>
}

export default function Finanzas() {
  const nav = useNavigate()
  const { row } = useForjaProfile()
  const links = useLoad(() => api().myLinks(), [])
  const pays = useLoad(() => api().myPayments(), [])
  const [panel, setPanel] = useState(null)

  if (!row || (links.loading && !links.data)) return <div className="narrow fj-page"><Loading /></div>

  if (effectivePlan(row) !== 'pro') return <div className="narrow fj-page">
    <h1 className="fj-title">Finanzas</h1>
    <section className="fj-card">
      <div className="fj-card-head"><h3><Icon name="chartLine" /> Función Pro</h3></div>
      <p className="fj-p">Finanzas es parte del plan Pro: la mensualidad de cada cliente, el registro de los pagos que cobras por fuera, los vencidos y los ingresos del mes.</p>
      <p className="dim small">Al pasar a Pro se desbloquea aquí mismo. Tus datos no se pierden si vuelves a Free.</p>
      <Button variant="primary" type="button" onClick={() => nav('/clientes')}>Volver a Clientes</Button>
    </section>
  </div>

  const mine = (links.data || []).filter(l => l.trainer_id === row.id && l.status === 'active')
  const s = financeSummary(mine, pays.data || [])
  const reload = () => { links.reload(); pays.reload() }
  const activePanel = panel && s.rows.find(r => r.link.id === panel.l.id)

  return <div className="narrow fj-page">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button type="button" className="fj-icon-btn" aria-label="Volver a Clientes" onClick={() => nav('/clientes')}><Icon name="chevronLeft" /></button>
      <h1 className="fj-title">Finanzas</h1>
    </div>

    {links.error && <ErrorNote error={links.error} retry={links.reload} />}
    {pays.error && <ErrorNote error={pays.error} retry={pays.reload} />}
    {pays.loading && !pays.data && <Loading />}

    <div className="fj-stats">
      <div className="fj-stat"><b>{money(s.income)}</b><span className="dim small">Cobrado en {monthName(s.month)}</span></div>
      <div className="fj-stat"><b>{money(s.due)}</b><span className="dim small">Por cobrar</span></div>
      <div className="fj-stat"><b>{s.vencidos}</b><span className="dim small">Vencidos</span></div>
    </div>

    <section className="fj-card">
      <div className="fj-card-head"><h3>Mis clientes</h3><span className="dim small">{s.rows.length} activos</span></div>
      {!s.rows.length && <p className="dim small">Cuando aceptes clientes, aquí verás su mensualidad y sus pagos.</p>}
      {s.rows.length > 0 && <ul className="fj-list">{s.rows.map(({ link: l, status, last }) => <li key={l.id}>
        <div className="fj-item static">
          <Avatar path={l.client?.avatar_path} name={l.client?.name} size={44} />
          <span className="fj-item-m">
            <b>{l.client?.name || 'Cliente'}</b>
            <span>
              {l.monthly_fee != null ? `${money(l.monthly_fee)} / mes` : 'Sin mensualidad'}
              {last ? ` · último pago ${monthName(last)}` : ''}
            </span>
          </span>
          <span className={'fj-status ' + status}>{PAYMENT_LABEL[status]}</span>
        </div>
        <div className="fj-row fj-pay-row">
          <Button variant="primary" size="sm" type="button" onClick={() => setPanel({ k: 'register', l })}>Registrar pago</Button>
          <Button variant="tinted" size="sm" type="button" onClick={() => setPanel({ k: 'history', l })}>Pagos</Button>
          <button type="button" className="fj-link" onClick={() => setPanel({ k: 'fee', l })}>Mensualidad</button>
        </div>
      </li>)}</ul>}
    </section>

    {panel && activePanel && panel.k === 'register' &&
      <RegisterPayment link={panel.l} onClose={() => setPanel(null)} onDone={() => { setPanel(null); reload() }} />}
    {panel && activePanel && panel.k === 'fee' &&
      <FeePanel link={panel.l} onClose={() => setPanel(null)} onDone={() => { setPanel(null); reload() }} />}
    {panel && activePanel && panel.k === 'history' &&
      <History link={panel.l} payments={pays.data || []} onClose={() => setPanel(null)} onChanged={reload} />}
  </div>
}
