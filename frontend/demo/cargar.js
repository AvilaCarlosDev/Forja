// Forja: carga una sesión demo (sesion-*.json, de scripts/forja-demo-sessions.mjs) en el
// localStorage del navegador. Solo existe en desarrollo: frontend/demo/ no entra al build, así
// que en producción no hay ningún enlace que pueda pisar la cuenta de alguien (CN-004).
//
// Aun así se niega a correr si el navegador tiene una sesión real o entrenamientos de invitado:
// solo reemplaza otra sesión demo. No usa eval ni localStorage.clear().

export const SESSION_KEY = 'forja_session_v1'
export const STATE_KEY = 'gym_state_v1'

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null') } catch { return null }
}

// null si se puede cargar; si no, el motivo para mostrarlo.
export function blockedReason(storage) {
  const s = read(storage, SESSION_KEY)
  if (s && s.access_token && !s.preview) return 'Este navegador tiene una sesión real de Forja. Usa una ventana de incógnito.'
  if (!s?.preview && storage.getItem(STATE_KEY) != null) return 'Este navegador tiene entrenamientos guardados. Usa una ventana de incógnito.'
  return null
}

export function applyDemoSession(storage, store) {
  const why = blockedReason(storage)
  if (why) throw new Error(why)
  if (!store || typeof store !== 'object' || !store[SESSION_KEY]?.preview) throw new Error('La sesión demo no es válida.')
  for (const [k, v] of Object.entries(store)) storage.setItem(k, JSON.stringify(v))
}
