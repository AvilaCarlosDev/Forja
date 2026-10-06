// Forja: la sesión actual como un pequeño almacén observable, para que React la lea con
// useSyncExternalStore sin meterla en el estado sincronizado de entrenamiento.
import { useSyncExternalStore } from 'react'
import { createAuth, loadSession, saveSession } from './forja-auth.js'
import { SUPABASE_URL, SUPABASE_KEY, FORJA_AUTH } from './forja-config.js'

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
