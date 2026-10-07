// Forja: instalar la app desde el navegador del teléfono (PWA).
// Android / Chrome ofrecen el diálogo nativo (evento beforeinstallprompt); Safari en iPhone no
// tiene API: hay que explicar Compartir → Agregar a inicio. Ya instalada, no se ofrece nada.
import { useSyncExternalStore } from 'react'

export function platform(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || '')
  // iPadOS se presenta como Mac; se reconoce por la pantalla táctil.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints || 0) > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function isStandalone(w = globalThis) {
  if (w.navigator?.standalone === true) return true
  return !!w.matchMedia?.('(display-mode: standalone)').matches
}

// Qué ofrecer: 'prompt' (botón con el diálogo nativo), 'ios' (pasos de Safari),
// 'ios-other' (abrir en Safari primero, o compartir en Chrome de iOS), 'menu' (menú del navegador) o null.
export function installMode({ plat, standalone, canPrompt }) {
  // Solo en teléfonos y tablets: en la computadora no se ofrece instalar.
  if (standalone || plat === 'desktop') return null
  if (canPrompt) return 'prompt'
  if (plat === 'ios-safari') return 'ios'
  if (plat === 'ios-other') return 'ios-other'
  if (plat === 'android') return 'menu'
  return null
}

// El evento de Chrome llega una vez, temprano: se guarda aquí aunque ninguna pantalla lo esté
// escuchando todavía.
let deferred = null
let installed = false
const subs = new Set()
const emit = () => subs.forEach(f => f())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit() })
}

const snapshot = () => (installed ? 'installed' : deferred ? 'ready' : 'none')
export const useInstallState = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, snapshot, snapshot)

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  const e = deferred
  deferred = null; emit()
  await e.prompt()
  const choice = await e.userChoice.catch(() => null)
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
}

const DISMISS_KEY = 'forja_install_dismissed_v1'
export function wasDismissed(now = Date.now()) {
  try { return now - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 864e5 } catch { return false }
}
export function dismiss(now = Date.now()) {
  try { localStorage.setItem(DISMISS_KEY, String(now)) } catch { /* sin almacenamiento */ }
}
