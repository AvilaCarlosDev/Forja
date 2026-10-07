// Forja: cuántas notificaciones sin leer hay, para el globo de la pestaña. Se refresca al
// entrar, cada minuto y cuando una pantalla avisa que cambió algo.
import { useSyncExternalStore } from 'react'
import { api } from '../../lib/forja-api.js'
import { getSession } from '../../lib/forja-session.js'

let count = 0
const subs = new Set()
export async function refreshBadge() {
  if (!getSession()) { count = 0; subs.forEach(f => f()); return }
  try {
    const n = (await api().notifications()).filter(x => !x.read_at).length
    if (n !== count) { count = n; subs.forEach(f => f()) }
  } catch { /* sin red: se queda el último número */ }
}
let timer = null
export function useBadge() {
  return useSyncExternalStore(fn => {
    subs.add(fn)
    if (!timer) { refreshBadge(); timer = setInterval(refreshBadge, 60000) }
    return () => { subs.delete(fn); if (!subs.size) { clearInterval(timer); timer = null } }
  }, () => count, () => count)
}
