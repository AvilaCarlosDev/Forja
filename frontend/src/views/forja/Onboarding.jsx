// Forja: completar el perfil la primera vez que se entra. Foto, nombre, sexo y fecha de
// nacimiento; si la persona es menor de 18, el consentimiento de su madre, padre o tutor.
// Los pasos de gimnasio y entrenador se añaden en las fases siguientes.
import { useState } from 'react'
import { useUI } from '../../store/useUI.js'
import { useStore } from '../../store/useStore.js'
import { Button } from '../../components/ui.jsx'
import { BRAND } from '../../lib/brand.js'
import { LEGAL } from '../../lib/forja-config.js'
import {
  ROLE_LABEL, getSession, useForjaProfile, loadProfile, updateProfile, saveGuardian, finishOnboarding,
} from '../../lib/forja-session.js'
import {
  MIN_AGE, RELATIONSHIPS, ageOn, needsGuardian, todayISO, validateDetails, validateGuardian, guardianBody,
} from '../../lib/forja-profile.js'
import { AvatarPicker } from './Avatar.jsx'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)

function Field({ id, label, hint, error, children }) {
  return <div className="fj-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <div className="dim small">{hint}</div>}
    {error && <div className="fj-err" role="alert">{error}</div>}
  </div>
}

// Opciones excluyentes que solo se marcan al tocarlas. (El Segmented de openGym siempre
// resalta la primera opción aunque no haya ninguna elegida, y aquí eso confundía.)
function Choice({ id, options, value, onChange }) {
  return <div className="fj-chips" role="radiogroup" aria-labelledby={id}>
    {options.map((o, i) => <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
      id={i ? undefined : id + '-first'} className={'fj-chip' + (value === o.value ? ' on' : '')} onClick={() => onChange(o.value)}>
      {o.label}
    </button>)}
  </div>
}

const SEX_OPTIONS = [{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]

function Steps({ at, total }) {
  return <div className="fj-steps" aria-label={`Paso ${at} de ${total}`}>
    {Array.from({ length: total }, (_, i) => <span key={i} className={i < at ? 'on' : ''} />)}
  </div>
}

function focusFirst(prefix, errors) {
  const k = Object.keys(errors)[0]
  if (k) (document.getElementById(prefix + k + '-first') || document.getElementById(prefix + k))?.focus?.()
}

function Details({ row, next }) {
  const today = todayISO()
  const [f, setF] = useState({ name: row.name || '', sex: row.sex || '', birth_date: row.birth_date || '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }
  const age = ageOn(f.birth_date, today)
  const submit = async e => {
    e.preventDefault(); setErr('')
    const bad = validateDetails(f, today)
    setErrors(bad)
    if (Object.keys(bad).length) { focusFirst('fj-ob-', bad); return }
    setBusy(true)
    try {
      await updateProfile({ name: f.name.trim(), sex: f.sex, birth_date: f.birth_date })
      if (f.sex) useStore.getState().update(s => { s.body = f.sex })
      next(needsGuardian(f.birth_date, today))
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <form className="fj-form" onSubmit={submit} noValidate>
    <AvatarPicker row={row} onError={setErr} />
    <Field id="fj-ob-name" label="Nombre" error={errors.name}>
      <input id="fj-ob-name" className="input" autoComplete="name" maxLength={60} value={f.name} onChange={e => set('name', e.target.value)} />
    </Field>
    <div className="fj-field">
      <div className="fj-legend" id="fj-ob-sex">Sexo</div>
      <Choice id="fj-ob-sex" options={SEX_OPTIONS} value={f.sex} onChange={v => set('sex', v)} />
      {errors.sex && <div className="fj-err" role="alert">{errors.sex}</div>}
    </div>
    <Field id="fj-ob-birth_date" label="Fecha de nacimiento" error={errors.birth_date}
      hint={age != null && age >= MIN_AGE && age < 18 ? 'Como eres menor de 18, en el siguiente paso te pediremos el permiso de tu madre, padre o tutor.' : 'Se usa para tus referencias de progreso. No se muestra a nadie.'}>
      <input id="fj-ob-birth_date" className="input" type="date" max={today} autoComplete="bday" value={f.birth_date} onChange={e => set('birth_date', e.target.value)} />
    </Field>
    {err && <div className="fj-err" role="alert">{err}</div>}
    <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Continuar'}</Button>
  </form>
}

function Guardian({ back, next }) {
  const [g, setG] = useState({ guardian_name: '', guardian_email: '', relationship: '', accept: false })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setG(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }
  const submit = async e => {
    e.preventDefault(); setErr('')
    const bad = validateGuardian(g)
    setErrors(bad)
    if (Object.keys(bad).length) { focusFirst('fj-gd-', bad); return }
    setBusy(true)
    try { await saveGuardian(guardianBody(getSession().profile.id, g)); next() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <form className="fj-form" onSubmit={submit} noValidate>
    <div className="fj-note">
      Como eres menor de edad, tu madre, padre o tutor tiene que darte permiso para usar {BRAND}.
      La app guarda medidas de tu cuerpo y, más adelante, fotos de tu progreso. Pídele que lea esto contigo.
    </div>
    <Field id="fj-gd-guardian_name" label="Nombre completo de tu madre, padre o tutor" error={errors.guardian_name}>
      <input id="fj-gd-guardian_name" className="input" maxLength={80} value={g.guardian_name} onChange={e => set('guardian_name', e.target.value)} />
    </Field>
    <div className="fj-field">
      <div className="fj-legend" id="fj-gd-relationship">Parentesco</div>
      <Choice id="fj-gd-relationship" options={RELATIONSHIPS} value={g.relationship} onChange={v => set('relationship', v)} />
      {errors.relationship && <div className="fj-err" role="alert">{errors.relationship}</div>}
    </div>
    <Field id="fj-gd-guardian_email" label="Su correo" hint="Lo usaremos solo para temas de tu cuenta." error={errors.guardian_email}>
      <input id="fj-gd-guardian_email" className="input" type="email" inputMode="email" value={g.guardian_email} onChange={e => set('guardian_email', e.target.value)} />
    </Field>
    <label className="fj-check">
      <input id="fj-gd-accept" type="checkbox" checked={g.accept} onChange={e => set('accept', e.target.checked)} />
      <span>Soy la madre, el padre o el tutor legal. Autorizo que use {BRAND} y acepto los <a href={LEGAL.terms} target="_blank" rel="noopener">términos</a> y la <a href={LEGAL.privacy} target="_blank" rel="noopener">política de privacidad</a>.</span>
    </label>
    {errors.accept && <div className="fj-err" role="alert">{errors.accept}</div>}
    {err && <div className="fj-err" role="alert">{err}</div>}
    <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Dar permiso y continuar'}</Button>
    <div className="fj-links"><button type="button" onClick={back}>Volver</button></div>
  </form>
}

export default function ForjaOnboarding() {
  const { status, row, error } = useForjaProfile()
  const [step, setStep] = useState('details')
  const [minor, setMinor] = useState(false)
  const [err, setErr] = useState('')
  if (status === 'error') return <div className="narrow fj-auth">
    <div className="fj-note warn" role="alert">No pudimos cargar tu perfil: {error}</div>
    <Button variant="primary" onClick={loadProfile}>Reintentar</Button>
  </div>
  if (!row) return <div className="narrow fj-auth"><div className="muted" style={{ textAlign: 'center' }}>Cargando tu perfil…</div></div>
  const finish = async () => {
    setErr('')
    try { const r = await finishOnboarding(); toast('¡Listo, ' + (r?.name || row.name) + '! Tu perfil está completo') }
    catch (x) { setErr(x.message) }
  }
  const total = minor ? 2 : 1
  return <div className="narrow fj-auth fj-onboarding">
    <div className="fj-brand">
      <h1>Completa tu perfil</h1>
      <div className="muted">{ROLE_LABEL[row.role] || 'Cliente'} · paso {step === 'details' ? 1 : 2} de {total}</div>
    </div>
    <Steps at={step === 'details' ? 1 : 2} total={total} />
    {step === 'details' && <Details row={row} next={isMinor => { setMinor(isMinor); if (isMinor) setStep('guardian'); else finish() }} />}
    {step === 'guardian' && <Guardian back={() => setStep('details')} next={finish} />}
    {err && <div className="fj-err" role="alert">{err}</div>}
  </div>
}
