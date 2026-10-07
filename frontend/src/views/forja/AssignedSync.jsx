// Forja: trae al plan del cliente las rutinas que le asignó su coach (0012), al abrir la app y
// cuando vuelve a ella. Sin coach activo, quita las que hubieran quedado. No dibuja nada.
import { useEffect } from 'react'
import { api } from '../../lib/forja-api.js'
import { linkSummary } from '../../lib/forja-coach.js'
import { mergeAssigned } from '../../lib/forja-routines.js'
import { useStore } from '../../store/useStore.js'

export async function syncAssigned(clientId) {
  const { active } = linkSummary(await api().myLinks(), clientId)
  const list = active ? await api().routines(clientId) : []
  let changed = 0
  useStore.getState().update(s => { changed = mergeAssigned(s, list, active?.trainer?.name) })
  return changed
}

export default function AssignedSync({ clientId }) {
  useEffect(() => {
    if (!clientId) return
    const run = () => { syncAssigned(clientId).catch(() => { /* sin red: queda lo último sincronizado */ }) }
    run()
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [clientId])
  return null
}
