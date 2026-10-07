// Forja: completar el perfil la primera vez que se entra. Foto, nombre, sexo y fecha de
// nacimiento; si la persona es menor de 18, el consentimiento de su madre, padre o tutor; el
// gimnasio (el entrenador puede elegir varios) y, si es cliente, su entrenador.
import { useEffect, useRef, useState } from 'react'
import { useUI } from '../../store/useUI.js'
import { useStore } from '../../store/useStore.js'
import { Button } from '../../components/ui.jsx'
import { BRAND } from '../../lib/brand.js'
import Icon from '../../components/Icon.jsx'
import { LEGAL } from '../../lib/forja-config.js'
import {
  ROLE_LABEL, getSession, useForjaProfile, loadProfile, updateProfile, saveGuardian, finishOnboarding, chooseRole,
} from '../../lib/forja-session.js'
import {
  MIN_AGE, RELATIONSHIPS, SEX_OPTIONS, ageOn, needsGuardian, todayISO, validateDetails, validateGuardian, guardianBody,
} from '../../lib/forja-profile.js'
import { AvatarPicker } from './Avatar.jsx'
import GymPicker from './GymPicker.jsx'
import TrainerPicker from './TrainerPicker.jsx'
import { Field, Choice } from './parts.jsx'
import { api } from '../../lib/forja-api.js'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)

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

const ROLE_INFO = {
  trainer: { icon: 'figureStrength', text: 'Entreno a otras personas y gestiono a mis clientes.' },
  client: { icon: 'person', text: 'Entreno con un coach o por mi cuenta.' },
}

// Solo para cuentas creadas con Google/Apple, que no pasaron por el formulario de registro.
function RoleStep({ next }) {
  const [role, setRole] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    if (!role) { setErr('Elige si eres Personal Trainer o Cliente'); return }
    if (!accept) { setErr('Debes aceptar los términos y la política de privacidad'); return }
    setBusy(true)
    try { await chooseRole(role, true); next() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="fj-form">
    <div className="fj-field">
      <div className="fj-legend" id="fj-ob-role">¿Cómo vas a usar {BRAND}?</div>
      <div className="fj-roles" role="radiogroup" aria-labelledby="fj-ob-role">
        {['trainer', 'client'].map(r => <button key={r} type="button" role="radio" aria-checked={role === r}
          className={'fj-role' + (role === r ? ' on' : '')} onClick={() => { setRole(r); setErr('') }}>
          <Icon name={ROLE_INFO[r].icon} /><b>{ROLE_LABEL[r]}</b><span>{ROLE_INFO[r].text}</span>
        </button>)}
      </div>
    </div>
    <label className="fj-check">
      <input type="checkbox" checked={accept} onChange={e => { setAccept(e.target.checked); setErr('') }} />
      <span>Acepto los <a href={LEGAL.terms} target="_blank" rel="noopener">términos de uso</a> y la <a href={LEGAL.privacy} target="_blank" rel="noopener">política de privacidad</a>.</span>
    </label>
    {role === 'trainer' && <div className="fj-note">Empiezas en el plan Free, con hasta 5 clientes. Tus clientes nunca pagan.</div>}
    {err && <div className="fj-err" role="alert">{err}</div>}
    <Button variant="primary" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Continuar'}</Button>
  </div>
}

function GymStep({ row, next }) {
  const trainer = row.role === 'trainer'
  const [gym, setGym] = useState(trainer ? [] : row.gym_id || null)
  const [remote, setRemote] = useState(!!row.remote)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    if (trainer ? !gym.length && !remote : !gym && !remote) {
      setErr(trainer ? 'Elige al menos un gimnasio donde trabajas, o marca que entrenas a distancia' : 'Elige tu gimnasio o marca que entrenas en casa')
      return
    }
    setBusy(true)
    try {
      if (trainer) await api().setTrainerGyms(gym, remote)
      else await api().setClientGym(gym, remote && !gym)
      next()
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="fj-form">
    <div className="fj-legend">{trainer ? '¿En qué gimnasios trabajas? Puedes elegir varios.' : '¿En qué gimnasio entrenas?'}</div>
    <GymPicker multi={trainer} value={gym} remote={remote}
      onChange={(v, r) => { setGym(v); setRemote(!!r); setErr('') }} />
    {err && <div className="fj-err" role="alert">{err}</div>}
    <Button variant="primary" type="button" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Continuar'}</Button>
  </div>
}

function TrainerStep({ row, next }) {
  const [has, setHas] = useState('')
  return <div className="fj-form">
    <div className="fj-field">
      <div className="fj-legend" id="fj-ob-has">¿Tienes entrenador personal?</div>
      <Choice id="fj-ob-has" options={[{ value: 'yes', label: 'Sí, tengo' }, { value: 'no', label: 'No tengo' }]} value={has} onChange={setHas} />
    </div>
    {has === 'yes' && <TrainerPicker gymId={row.gym_id} remote={!row.gym_id && row.remote}
      onRequested={(l, t) => { toast('Solicitud enviada a ' + t.name); next() }} />}
    {has === 'no' && <>
      <div className="fj-note">Usarás {BRAND} con acceso básico: tus rutinas, tu peso y tus medidas. Cuando tengas entrenador, lo eliges desde «Mi coach».</div>
      <Button variant="primary" type="button" onClick={next}>Continuar sin entrenador</Button>
    </>}
  </div>
}

const STEP_TITLE = { role: 'Tu tipo de cuenta', details: 'Tus datos', guardian: 'Permiso de tu tutor', gym: 'Tu gimnasio', trainer: 'Tu entrenador' }

export default function ForjaOnboarding() {
  const { status, row, error } = useForjaProfile()
  // Las cuentas de Google/Apple llegan sin rol elegido (role_chosen = false).
  const [step, setStep] = useState(() => (row && row.role_chosen === false ? 'role' : 'details'))
  const hadRole = useRef(false)
  if (step === 'role') hadRole.current = true
  // El perfil llega después del primer render: si es una cuenta de Google/Apple, empieza por el rol.
  useEffect(() => { if (row?.role_chosen === false) setStep(s => (s === 'details' ? 'role' : s)) }, [row?.role_chosen])
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
  const needsRole = row.role_chosen === false || hadRole.current
  const steps = [...(needsRole ? ['role'] : []), 'details', ...(minor ? ['guardian'] : []), 'gym', ...(row.role === 'client' ? ['trainer'] : [])]
  const at = steps.indexOf(step) + 1
  const go = cur => { const n = steps[steps.indexOf(cur) + 1]; if (n) setStep(n); else finish() }
  return <div className="narrow fj-auth fj-onboarding">
    <div className="fj-brand">
      <h1>Completa tu perfil</h1>
      <div className="muted">{step === 'role' ? 'Bienvenido' : ROLE_LABEL[row.role] || 'Cliente'} · paso {at} de {steps.length} · {STEP_TITLE[step]}</div>
    </div>
    <Steps at={at} total={steps.length} />
    {step === 'role' && <RoleStep next={() => setStep('details')} />}
    {step === 'details' && <Details row={row} next={isMinor => { setMinor(isMinor); setStep(isMinor ? 'guardian' : 'gym') }} />}
    {step === 'guardian' && <Guardian back={() => setStep('details')} next={() => setStep('gym')} />}
    {step === 'gym' && <GymStep row={row} next={() => go('gym')} />}
    {step === 'trainer' && <TrainerStep row={row} next={finish} />}
    {err && <div className="fj-err" role="alert">{err}</div>}
  </div>
}
