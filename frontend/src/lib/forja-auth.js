// Forja: cuentas con correo sobre Supabase Auth (GoTrue), hablado por REST con fetch.
// Sin SDK a propósito: el proyecto es estricto con las dependencias (CONTRIBUTING.md) y de la
// API de auth solo hacen falta cinco llamadas.
//
// Todo lo que decide algo (validación, cuerpo del registro, lectura del enlace del correo,
// mensajes de error) es una función pura con su test al lado. createAuth() recibe fetch y el
// reloj para poder probarse sin red.
//
// Los mensajes van en español: es el idioma de Forja. La clave pública (anon) viaja en el
// navegador por diseño; lo que protege los datos son las políticas RLS de la base.

export const ROLES = ['trainer', 'client']
export const SEXES = ['male', 'female']
export const SESSION_KEY = 'forja_session_v1'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateSignup(f = {}) {
  const e = {}
  if (!String(f.name || '').trim()) e.name = 'Escribe tu nombre'
  if (!EMAIL.test(String(f.email || '').trim())) e.email = 'Escribe un correo válido'
  if (String(f.password || '').length < 8) e.password = 'La contraseña necesita al menos 8 caracteres'
  else if (f.password !== f.password2) e.password2 = 'Las contraseñas no coinciden'
  if (!SEXES.includes(f.sex)) e.sex = 'Elige una opción'
  if (!ROLES.includes(f.role)) e.role = 'Elige tu perfil'
  if (f.accept !== true) e.accept = 'Debes aceptar los términos y la política de privacidad'
  return e
}

const cleanEmail = v => String(v || '').trim().toLowerCase()

// El plan no se manda nunca desde el cliente: lo fija la base (free) y solo lo cambia el admin.
export function signupBody(f) {
  return { email: cleanEmail(f.email), password: f.password, data: { name: String(f.name).trim(), sex: f.sex, role: f.role } }
}

// El enlace del correo vuelve a la app con los tokens en el fragmento. La app usa HashRouter,
// cuyas rutas empiezan por "#/", así que un fragmento sin barra es de auth y no una pantalla.
export function parseAuthHash(hash) {
  if (typeof hash !== 'string' || hash.length < 2 || hash.startsWith('#/')) return null
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  if (p.get('error') || p.get('error_code')) return { error: p.get('error_description') || p.get('error') || p.get('error_code') }
  const access_token = p.get('access_token')
  if (!access_token) return null
  return { access_token, refresh_token: p.get('refresh_token') || '', expires_in: Number(p.get('expires_in')) || 3600, type: p.get('type') || '' }
}

export function profileFromUser(u) {
  const m = u?.user_metadata || {}
  const email = u?.email || ''
  return {
    id: u?.id || '', email,
    name: String(m.name || '').trim() || email.split('@')[0],
    sex: SEXES.includes(m.sex) ? m.sex : null,
    role: ROLES.includes(m.role) ? m.role : 'client',
  }
}

const MESSAGES = {
  invalid_credentials: 'Correo o contraseña incorrectos',
  email_not_confirmed: 'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese correo',
  email_exists: 'Ya existe una cuenta con ese correo',
  weak_password: 'Esa contraseña es demasiado débil. Usa al menos 8 caracteres.',
  same_password: 'La contraseña nueva debe ser distinta de la anterior',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  signup_disabled: 'El registro está cerrado por ahora',
  email_address_invalid: 'Ese correo no es válido',
  otp_expired: 'El enlace caducó. Pide uno nuevo.',
}
export function errorMessage(body) {
  const code = body?.error_code || body?.code
  if (MESSAGES[code]) return MESSAGES[code]
  const raw = String(body?.msg || body?.message || body?.error_description || body?.error || '')
  if (/already registered|already exists/i.test(raw)) return MESSAGES.user_already_exists
  if (/invalid login/i.test(raw)) return MESSAGES.invalid_credentials
  if (/not confirmed/i.test(raw)) return MESSAGES.email_not_confirmed
  if (/rate limit/i.test(raw)) return MESSAGES.over_request_rate_limit
  return raw || 'No se pudo completar. Inténtalo de nuevo.'
}

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return s && typeof s === 'object' && s.access_token ? s : null
  } catch { return null }
}
export function saveSession(s) {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY) } catch { /* sin almacenamiento */ }
}

export function createAuth({ url, key, fetch: f = globalThis.fetch?.bind(globalThis), now = () => Date.now() }) {
  const base = String(url || '').replace(/\/+$/, '') + '/auth/v1'
  const call = async (path, { method = 'POST', body, token } = {}) => {
    let res
    try {
      res = await f(base + path, {
        method,
        headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch { throw new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.') }
    let data = null
    try { data = await res.json() } catch { /* respuesta vacía */ }
    if (!res.ok) throw new Error(errorMessage(data))
    return data || {}
  }
  const redirect = to => (to ? '?redirect_to=' + encodeURIComponent(to) : '')
  const keep = (tokens, user) => {
    const s = {
      access_token: tokens.access_token, refresh_token: tokens.refresh_token || '',
      expires_at: Math.floor(now() / 1000) + (Number(tokens.expires_in) || 3600),
      profile: profileFromUser(user),
    }
    saveSession(s); return s
  }
  return {
    async signUp(form, redirectTo) {
      const d = await call('/signup' + redirect(redirectTo), { body: signupBody(form) })
      // Con confirmación de correo activa GoTrue devuelve el usuario sin tokens.
      if (d.access_token) return { session: keep(d, d.user) }
      return { needsConfirmation: true, email: cleanEmail(form.email) }
    },
    async signIn(email, password) {
      const d = await call('/token?grant_type=password', { body: { email: cleanEmail(email), password } })
      return keep(d, d.user)
    },
    recover: (email, redirectTo) => call('/recover' + redirect(redirectTo), { body: { email: cleanEmail(email) } }),
    // Tokens llegados por el enlace de un correo: se pregunta de quién son antes de guardarlos.
    async adopt(tokens) {
      const user = await call('/user', { method: 'GET', token: tokens.access_token })
      return keep(tokens, user)
    },
    async setPassword(password) {
      const s = loadSession()
      if (!s) throw new Error('El enlace caducó. Pide uno nuevo.')
      await call('/user', { method: 'PUT', token: s.access_token, body: { password } })
    },
    async refresh() {
      const s = loadSession()
      if (!s?.refresh_token) return null
      const d = await call('/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })
      return keep(d, d.user)
    },
    // La sesión local se cierra siempre; avisar al servidor es de cortesía.
    async signOut() {
      const s = loadSession(); saveSession(null)
      if (s) { try { await call('/logout', { token: s.access_token }) } catch { /* sin red */ } }
    },
  }
}
