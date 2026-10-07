// Forja: la sesión actual como un pequeño almacén observable, para que React la lea con
// useSyncExternalStore sin meterla en el estado sincronizado de entrenamiento.
import { useSyncExternalStore } from 'react'
import { createAuth, loadSession, saveSession } from './forja-auth.js'
import { createDb } from './forja-db.js'
import { SUPABASE_URL, SUPABASE_KEY, FORJA_AUTH, FORJA_AUTH_PREVIEW } from './forja-config.js'

let current = loadSession()
const subs = new Set()
const emit = () => subs.forEach(fn => fn())

export const auth = FORJA_AUTH ? createAuth({ url: SUPABASE_URL, key: SUPABASE_KEY }) : null
export const getSession = () => current
export function setSession(s) { current = s || null; saveSession(current); emit() }
// Tras una llamada de `auth` que ya guardó la sesión: solo hay que volver a leerla.
export function syncSession() { current = loadSession(); emit() }
export const useForjaSession = () => useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, getSession, getSession)

export const ROLE_LABEL = { trainer: 'Personal Trainer', client: 'Cliente' }

// ---- Perfil en la base (tabla profiles) ----------------------------------------------------
// La sesión trae lo que se escribió al registrarse; el perfil completo (fecha de nacimiento,
// foto, si ya terminó el asistente) vive en la base y se carga aparte.

export const db = FORJA_AUTH ? createDb({
  url: SUPABASE_URL, key: SUPABASE_KEY,
  getToken: () => current?.access_token,
  refresh: async () => { const s = await auth.refresh(); syncSession(); return s },
}) : null

const PREVIEW_PROFILE = 'forja_preview_profile_v1'
let profile = { status: 'idle', row: null, error: '' }
const psubs = new Set()
const pemit = () => psubs.forEach(fn => fn())
function setProfile(p) { profile = { ...profile, ...p }; pemit() }
export const getProfile = () => profile
export const useForjaProfile = () => useSyncExternalStore(fn => { psubs.add(fn); return () => psubs.delete(fn) }, getProfile, getProfile)

function previewRow() {
  try { return JSON.parse(localStorage.getItem(PREVIEW_PROFILE) || 'null') } catch { return null }
}
function savePreviewRow(row) {
  try { localStorage.setItem(PREVIEW_PROFILE, JSON.stringify(row)) } catch { /* sin almacenamiento */ }
}

export async function loadProfile() {
  const s = current
  if (!s) { setProfile({ status: 'idle', row: null, error: '' }); return null }
  if (s.preview || FORJA_AUTH_PREVIEW) {
    const row = previewRow() || { id: s.profile.id, name: s.profile.name, sex: s.profile.sex, role: s.profile.role, plan: 'free' }
    setProfile({ status: 'ready', row, error: '' }); return row
  }
  setProfile({ status: 'loading', error: '' })
  try {
    // La fila propia completa (con role_chosen y terms_accepted_at) llega por forja_me(): de
    // profiles solo se pueden leer las columnas públicas (0013).
    const row = await db.rpc('forja_me')
    setProfile({ status: 'ready', row, error: '' }); return row
  } catch (x) { setProfile({ status: 'error', error: x.message }); return null }
}

// Cambios del propio perfil (nombre, sexo, fecha de nacimiento, foto).
export async function updateProfile(patch) {
  const s = current
  if (s?.preview || FORJA_AUTH_PREVIEW) {
    const row = { ...profile.row, ...patch }; savePreviewRow(row); setProfile({ row }); return row
  }
  const done = await db.update('profiles', { id: s.profile.id }, patch, { select: 'id' })
  if (!done) throw new Error('No se pudo guardar tu perfil.')
  const row = await db.rpc('forja_me')
  setProfile({ row }); return row
}

export async function saveGuardian(body) {
  if (current?.preview || FORJA_AUTH_PREVIEW) { updateProfile({ guardian: body }); return body }
  return db.insert('guardian_consents', body, { upsert: true })
}

// Cuentas creadas con Google/Apple: eligen rol y aceptan los términos en el asistente.
export async function chooseRole(role, accept) {
  if (current?.preview || FORJA_AUTH_PREVIEW) return updateProfile({ role, role_chosen: true })
  const row = await db.rpc('forja_choose_role', { p_role: role, p_accept: accept })
  setProfile({ row }); return row
}

export async function finishOnboarding() {
  if (current?.preview || FORJA_AUTH_PREVIEW) return updateProfile({ onboarded_at: new Date().toISOString() })
  const row = await db.rpc('forja_finish_onboarding')
  setProfile({ row }); return row
}

// Al cerrar sesión o cambiar de cuenta, el perfil se vuelve a cargar.
let lastUser = current?.profile?.id || null
subs.add(() => {
  const id = current?.profile?.id || null
  if (id !== lastUser) { lastUser = id; loadProfile() }
})
if (current) loadProfile()
