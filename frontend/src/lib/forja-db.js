// Forja: datos en Supabase (PostgREST y Storage) por REST, sin SDK, igual que forja-auth.js.
// Cada llamada lleva el token de la sesión; si caducó, se renueva una vez y se reintenta.
// Lo que protege los datos son las políticas RLS de la base, no este archivo.

export function dbErrorMessage(status, body) {
  const code = body?.code || ''
  // Los mensajes que lanzan nuestras funciones SQL ya vienen en español (código 22023).
  if (code === '22023' && body?.message) return body.message
  if (code === '42501' || status === 403) return 'No tienes permiso para hacer eso'
  if (code === 'PGRST301' || status === 401) return 'Tu sesión caducó. Vuelve a entrar.'
  if (status === 413) return 'El archivo es demasiado grande'
  return body?.message || body?.error || 'No se pudo completar. Inténtalo de nuevo.'
}

// Filtros de PostgREST a partir de un objeto: { id: 'abc' } → id=eq.abc
export const eqQuery = match => Object.entries(match || {})
  .map(([k, v]) => encodeURIComponent(k) + '=eq.' + encodeURIComponent(v)).join('&')

export function createDb({ url, key, getToken, refresh, fetch: f = globalThis.fetch?.bind(globalThis) }) {
  const base = String(url || '').replace(/\/+$/, '')
  const send = async (path, { method = 'GET', body, headers = {}, raw = false } = {}, retried = false) => {
    const token = getToken?.()
    let res
    try {
      res = await f(base + path, {
        method,
        headers: {
          apikey: key,
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(raw ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body !== undefined ? { body: raw ? body : JSON.stringify(body) } : {}),
      })
    } catch { throw new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.') }
    if (res.status === 401 && !retried && refresh) {
      if (await refresh().catch(() => null)) return send(path, { method, body, headers, raw }, true)
    }
    let data = null
    const text = await res.text().catch(() => '')
    if (text) { try { data = JSON.parse(text) } catch { data = text } }
    if (!res.ok) throw new Error(dbErrorMessage(res.status, data))
    return data
  }
  const rest = '/rest/v1/'
  return {
    select: (table, query = '') => send(rest + table + (query ? '?' + query : '')),
    async one(table, match, columns = '*') {
      const rows = await send(rest + table + '?select=' + encodeURIComponent(columns) + '&' + eqQuery(match) + '&limit=1')
      return Array.isArray(rows) ? rows[0] || null : null
    },
    // select: las columnas que devuelve; hace falta en tablas con permiso de lectura por columna.
    async update(table, match, patch, { select } = {}) {
      const q = eqQuery(match) + (select ? '&select=' + encodeURIComponent(select) : '')
      const rows = await send(rest + table + '?' + q, { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } })
      return Array.isArray(rows) ? rows[0] || null : rows
    },
    // upsert: si ya existe la fila (misma clave primaria), se reemplaza.
    async insert(table, row, { upsert = false } = {}) {
      const rows = await send(rest + table, {
        method: 'POST', body: row,
        headers: { Prefer: 'return=representation' + (upsert ? ',resolution=merge-duplicates' : '') },
      })
      return Array.isArray(rows) ? rows[0] || null : rows
    },
    // Borra las filas que cumplan el filtro de PostgREST (por ejemplo 'id=eq.1').
    del: (table, query) => send(rest + table + '?' + query, { method: 'DELETE' }),
    rpc: (fn, args = {}) => send(rest + 'rpc/' + fn, { method: 'POST', body: args }),
    upload: (bucket, path, blob, contentType) => send('/storage/v1/object/' + bucket + '/' + path, {
      method: 'POST', body: blob, raw: true, headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
    }),
    remove: (bucket, paths) => send('/storage/v1/object/' + bucket, { method: 'DELETE', body: { prefixes: paths } }),
    async signedUrl(bucket, path, expiresIn = 3600) {
      const d = await send('/storage/v1/object/sign/' + bucket + '/' + path, { method: 'POST', body: { expiresIn } })
      return d?.signedURL ? base + '/storage/v1' + d.signedURL : null
    },
  }
}
