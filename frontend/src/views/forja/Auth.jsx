// Forja: entrar, crear cuenta y recuperar contraseña. Sustituye a la pantalla de acceso de
// openGym cuando hay Supabase configurado (lib/forja-config.js).
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../../components/Icon.jsx'
import { Button } from '../../components/ui.jsx'
import { Choice } from './parts.jsx'
import { InstallLink } from './Install.jsx'
import { BRAND } from '../../lib/brand.js'
import { validateSignup, parseAuthHash } from '../../lib/forja-auth.js'
import { auth, getSession, setSession, syncSession, ROLE_LABEL } from '../../lib/forja-session.js'
import { FORJA_AUTH_PREVIEW, LEGAL } from '../../lib/forja-config.js'
import '../../forja.css'

const toast = m => useUI.getState().toast(m)
const here = () => location.origin + location.pathname

// Con la cuenta abierta, la app trabaja con los datos de este dispositivo (el perfil local de
// openGym). La copia en la nube llega con la sincronización, que es un paso aparte.
function enter(profile) {
  const st = useStore.getState()
  if (profile?.sex) st.update(s => { s.body = profile.sex })
  st.setGuest(true)
}

function Field({ id, label, error, children }) {
  return <div className="fj-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {error && <div className="fj-err" role="alert">{error}</div>}
  </div>
}

function Brand({ sub }) {
  return <div className="fj-brand">
    <img src="icon-192.png" alt="" />
    <h1>{BRAND}</h1>
    <div className="muted">{sub}</div>
  </div>
}

const PreviewNote = () => FORJA_AUTH_PREVIEW
  ? <div className="fj-note warn">Vista previa: estas pantallas todavía no crean cuentas en ningún servidor. Lo que escribas se queda en este navegador.</div>
  : null

// Entrar o crear cuenta con Google/Apple. Solo se muestran los proveedores que Supabase tiene
// activos; sin ninguno, no se muestra nada (ni en la vista previa).
const PROVIDER = {
  google: { label: 'Continuar con Google', logo: <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> },
  apple: { label: 'Continuar con Apple', logo: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.61 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.67-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.33-3.55zM14.18 6.12c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23z"/></svg> },
}

function OAuthButtons() {
  const [list, setList] = useState([])
  useEffect(() => { let live = true; auth?.providers().then(p => { if (live) setList(p) }); return () => { live = false } }, [])
  if (!list.length) return null
  return <div className="fj-oauth">
    {list.map(p => <a key={p} className={'fj-oauth-btn ' + p} href={auth.oauthUrl(p, here())}>
      {PROVIDER[p].logo}<span>{PROVIDER[p].label}</span>
    </a>)}
    <div className="fj-or"><span>o con tu correo</span></div>
  </div>
}

function Login({ go }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!email.trim() || !password) { setErr('Escribe tu correo y tu contraseña'); return }
    if (FORJA_AUTH_PREVIEW) { setErr('Vista previa: aquí no hay cuentas guardadas. Crea una de prueba con "Crear cuenta".'); return }
    setBusy(true)
    try { const s = await auth.signIn(email, password); syncSession(); enter(s.profile); toast('Hola de nuevo, ' + s.profile.name) }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="narrow fj-auth">
    <Brand sub="Forja tu cuerpo." />
    <PreviewNote />
    <OAuthButtons />
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-login-email" label="Correo">
        <input id="fj-login-email" className="input" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
      </Field>
      <Field id="fj-login-password" label="Contraseña">
        <input id="fj-login-password" className="input" type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
      </Field>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
    </form>
    <div className="fj-links">
      <button type="button" onClick={() => go('forgot')}>¿Olvidaste tu contraseña?</button>
      <div className="muted">¿Aún no tienes cuenta? <button type="button" onClick={() => go('register')}>Crear cuenta</button></div>
    </div>
  </div>
}

const ROLE_INFO = {
  trainer: { icon: 'figureStrength', text: 'Entreno a otras personas y gestiono a mis clientes.' },
  client: { icon: 'person', text: 'Entreno con un coach o por mi cuenta.' },
}

function Register({ go, onSent }) {
  const [f, setF] = useState({ name: '', email: '', password: '', password2: '', sex: '', role: '', accept: false })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }
  const submit = async e => {
    e.preventDefault(); setErr('')
    const bad = validateSignup(f)
    setErrors(bad)
    if (Object.keys(bad).length) { (document.getElementById('fj-reg-' + Object.keys(bad)[0] + '-first') || document.getElementById('fj-reg-' + Object.keys(bad)[0]))?.focus?.(); return }
    if (FORJA_AUTH_PREVIEW) {
      const profile = { id: 'preview', email: f.email.trim().toLowerCase(), name: f.name.trim(), sex: f.sex, role: f.role }
      setSession({ access_token: 'preview', refresh_token: '', expires_at: 0, preview: true, profile })
      enter(profile); toast('Cuenta de prueba creada en este navegador'); return
    }
    setBusy(true)
    try {
      const r = await auth.signUp(f, here())
      if (r.needsConfirmation) onSent(r.email)
      else { syncSession(); enter(r.session.profile); toast('Bienvenido a ' + BRAND + ', ' + r.session.profile.name) }
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="narrow fj-auth">
    <Brand sub="Crea tu cuenta" />
    <PreviewNote />
    <OAuthButtons />
    <form className="fj-form" onSubmit={submit} noValidate>
      <div className="fj-field">
        <div className="fj-legend" id="fj-reg-role-l">¿Cómo vas a usar {BRAND}?</div>
        <div className="fj-roles" role="radiogroup" aria-labelledby="fj-reg-role-l">
          {['trainer', 'client'].map((r, i) => <button key={r} type="button" id={i ? undefined : 'fj-reg-role'} role="radio" aria-checked={f.role === r}
            className={'fj-role' + (f.role === r ? ' on' : '')} onClick={() => set('role', r)}>
            <Icon name={ROLE_INFO[r].icon} />
            <b>{ROLE_LABEL[r]}</b>
            <span>{ROLE_INFO[r].text}</span>
          </button>)}
        </div>
        {errors.role && <div className="fj-err" role="alert">{errors.role}</div>}
      </div>
      <Field id="fj-reg-name" label="Nombre" error={errors.name}>
        <input id="fj-reg-name" className="input" name="name" autoComplete="name" maxLength={60} value={f.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <Field id="fj-reg-email" label="Correo" error={errors.email}>
        <input id="fj-reg-email" className="input" type="email" name="email" autoComplete="email" inputMode="email" value={f.email} onChange={e => set('email', e.target.value)} />
      </Field>
      <Field id="fj-reg-password" label="Contraseña (mínimo 8 caracteres)" error={errors.password}>
        <input id="fj-reg-password" className="input" type="password" name="new-password" autoComplete="new-password" value={f.password} onChange={e => set('password', e.target.value)} />
      </Field>
      <Field id="fj-reg-password2" label="Repite la contraseña" error={errors.password2}>
        <input id="fj-reg-password2" className="input" type="password" name="new-password-again" autoComplete="new-password" value={f.password2} onChange={e => set('password2', e.target.value)} />
      </Field>
      <div className="fj-field">
        <div className="fj-legend" id="fj-reg-sex">Sexo</div>
        <Choice id="fj-reg-sex" options={[{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]} value={f.sex} onChange={v => set('sex', v)} />
        <div className="dim small">Se usa para dibujar el mapa muscular y las referencias de progreso.</div>
        {errors.sex && <div className="fj-err" role="alert">{errors.sex}</div>}
      </div>
      <label className="fj-check">
        <input id="fj-reg-accept" type="checkbox" checked={f.accept} onChange={e => set('accept', e.target.checked)} />
        <span>Acepto los <a href={LEGAL.terms} target="_blank" rel="noopener">términos de uso</a> y la <a href={LEGAL.privacy} target="_blank" rel="noopener">política de privacidad</a>.</span>
      </label>
      {errors.accept && <div className="fj-err" role="alert">{errors.accept}</div>}
      {f.role === 'trainer' && <div className="fj-note">Empiezas en el plan Free, con hasta 5 clientes. El plan Pro es solo para entrenadores; tus clientes nunca pagan.</div>}
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</Button>
    </form>
    <div className="fj-links"><div className="muted">¿Ya tienes cuenta? <button type="button" onClick={() => go('login')}>Entrar</button></div></div>
  </div>
}

function Forgot({ go, onSent }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr('Escribe un correo válido'); return }
    if (FORJA_AUTH_PREVIEW) { setErr('Vista previa: aquí no se envían correos.'); return }
    setBusy(true)
    try { await auth.recover(email, here()); onSent(email.trim().toLowerCase()) }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="narrow fj-auth">
    <Brand sub="Recupera tu contraseña" />
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-forgot-email" label="Correo de tu cuenta">
        <input id="fj-forgot-email" className="input" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
      </Field>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</Button>
    </form>
    <div className="fj-links"><button type="button" onClick={() => go('login')}>Volver a entrar</button></div>
  </div>
}

function Sent({ email, kind, go }) {
  return <div className="narrow fj-auth">
    <Brand sub="Revisa tu correo" />
    <div className="fj-note">
      {kind === 'signup'
        ? <>Enviamos un enlace de confirmación a <b>{email}</b>. Ábrelo para activar tu cuenta.</>
        : <>Si existe una cuenta con <b>{email}</b>, recibirás un enlace para crear una contraseña nueva.</>}
      {' '}Si no llega en unos minutos, mira en la carpeta de spam.
    </div>
    <div className="fj-links"><button type="button" onClick={() => go('login')}>Volver a entrar</button></div>
  </div>
}

function NewPassword({ done }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (p1.length < 8) { setErr('La contraseña necesita al menos 8 caracteres'); return }
    if (p1 !== p2) { setErr('Las contraseñas no coinciden'); return }
    setBusy(true)
    try { await auth.setPassword(p1); toast('Contraseña actualizada'); done() }
    catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <div className="narrow fj-auth">
    <Brand sub="Crea una contraseña nueva" />
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-new-password" label="Contraseña nueva (mínimo 8 caracteres)">
        <input id="fj-new-password" className="input" type="password" name="new-password" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} />
      </Field>
      <Field id="fj-new-password2" label="Repite la contraseña">
        <input id="fj-new-password2" className="input" type="password" name="new-password-again" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} />
      </Field>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
    </form>
  </div>
}

function Screens() {
  const [mode, setMode] = useState('login')
  const [sent, setSent] = useState(null)
  const [linkErr, setLinkErr] = useState('')
  const tried = useRef(false)
  // Vuelta desde el enlace de un correo: confirmar cuenta o recuperar contraseña.
  useEffect(() => {
    if (tried.current || !auth) return
    tried.current = true
    const link = parseAuthHash(location.hash)
    if (!link) return
    history.replaceState(null, '', location.pathname + location.search)
    if (link.error) { setLinkErr('El enlace no es válido o ya caducó. Pide uno nuevo.'); return }
    auth.adopt(link).then(s => {
      syncSession()
      if (link.type === 'recovery') setMode('newpass')
      else { enter(s.profile); toast((link.type === 'signup' ? 'Cuenta confirmada. Bienvenido, ' : 'Hola, ') + s.profile.name) }
    }).catch(x => setLinkErr(x.message))
  }, [])
  const go = m => { setLinkErr(''); setMode(m) }
  if (mode === 'newpass') return <NewPassword done={() => enter(getSession()?.profile)} />
  if (mode === 'sent') return <Sent email={sent.email} kind={sent.kind} go={go} />
  if (mode === 'register') return <Register go={go} onSent={email => { setSent({ email, kind: 'signup' }); setMode('sent') }} />
  if (mode === 'forgot') return <Forgot go={go} onSent={email => { setSent({ email, kind: 'recover' }); setMode('sent') }} />
  return <>
    {linkErr && <div className="narrow"><div className="fj-note warn" role="alert" style={{ marginTop: 16 }}>{linkErr}</div></div>}
    <Login go={go} />
  </>
}

// Fondo de entrar y crear cuenta: un bucle de 8 s de un entrenador con su cliente (Mixkit, licencia
// libre comercial; ver docs/design/login-video.md). En pantallas anchas, un plano medio a sangre
// completa; en el teléfono (vertical), un plano abierto 4:5 arriba que se funde con el formulario,
// para que se vea a los dos de cuerpo entero y no un primer plano recortado.
// Primero se ve la imagen fija; el video se pide después de pintar el formulario, y no se pide si
// la persona prefiere menos movimiento o tiene el ahorro de datos. Se pausa con la pestaña oculta.
const BG = {
  wide: { poster: 'forja/login-poster.jpg', webm: 'forja/login.webm', mp4: 'forja/login.mp4' },
  tall: { poster: 'forja/login-m-poster.jpg', webm: 'forja/login-m.webm', mp4: 'forja/login-m.mp4' },
}
const TALL = '(max-aspect-ratio: 4/5)'
export function wantsVideo(w = globalThis) {
  if (w.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  if (w.navigator?.connection?.saveData) return false
  return true
}

function useTall() {
  const [tall, setTall] = useState(() => !!globalThis.matchMedia?.(TALL).matches)
  useEffect(() => {
    const mq = globalThis.matchMedia?.(TALL)
    if (!mq) return
    const on = () => setTall(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return tall
}

function AuthBackdrop() {
  const video = useRef(null)
  const tall = useTall()
  const bg = tall ? BG.tall : BG.wide
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (!wantsVideo()) return
    const idle = globalThis.requestIdleCallback || (fn => setTimeout(fn, 300))
    const id = idle(() => setPlay(true))
    return () => (globalThis.cancelIdleCallback || clearTimeout)(id)
  }, [])
  useEffect(() => {
    const v = video.current
    if (!play || !v) return
    // React no escribe el atributo `muted` en el HTML, y sin él Safari en iPhone no reproduce solo.
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
    v.load()
    const go = () => v.play().catch(() => {})
    const vis = () => { if (document.hidden) v.pause(); else go() }
    // Si iOS bloquea la reproducción automática (ahorro de batería), arranca con el primer toque.
    const touch = () => { if (v.paused) go() }
    document.addEventListener('visibilitychange', vis)
    document.addEventListener('touchstart', touch, { passive: true })
    document.addEventListener('pointerdown', touch)
    v.addEventListener('canplay', go, { once: true })
    go()
    return () => {
      document.removeEventListener('visibilitychange', vis)
      document.removeEventListener('touchstart', touch)
      document.removeEventListener('pointerdown', touch)
      v.removeEventListener('canplay', go)
    }
  }, [play, tall])
  return <div className={'fj-backdrop' + (tall ? ' tall' : '')} aria-hidden="true">
    {play
      ? <video key={tall ? 'tall' : 'wide'} ref={video} muted loop playsInline autoPlay preload="auto" poster={bg.poster} disablePictureInPicture>
        <source src={bg.mp4} type="video/mp4" />
        <source src={bg.webm} type="video/webm" />
      </video>
      : <img src={bg.poster} alt="" />}
  </div>
}

export default function ForjaAuth() {
  return <>
    <AuthBackdrop />
    <div className="fj-auth-layer"><Screens /><div className="fj-install-wrap"><InstallLink /></div></div>
  </>
}
