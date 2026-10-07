// Forja: foto de perfil. Se reduce en el navegador (512 px, WebP) antes de subirla a la
// carpeta privada del usuario en Supabase Storage, y se muestra con un enlace firmado.
import { useEffect, useRef, useState } from 'react'
import { db, updateProfile, getSession } from '../../lib/forja-session.js'
import { avatarPath, fitSize } from '../../lib/forja-profile.js'
import Icon from '../../components/Icon.jsx'

const signed = new Map() // ruta → enlace firmado, para no pedirlo en cada pantalla

export function useAvatarUrl(path) {
  const [url, setUrl] = useState(() => (path?.startsWith('data:') ? path : signed.get(path)) || null)
  useEffect(() => {
    if (!path) { setUrl(null); return }
    if (path.startsWith('data:')) { setUrl(path); return } // vista previa sin servidor
    if (signed.has(path)) { setUrl(signed.get(path)); return }
    let live = true
    db?.signedUrl('avatars', path, 60 * 60 * 24).then(u => { if (u) signed.set(path, u); if (live) setUrl(u) }).catch(() => {})
    return () => { live = false }
  }, [path])
  return url
}

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

export function Avatar({ path, name, size = 72 }) {
  const url = useAvatarUrl(path)
  return <span className="fj-avatar" style={{ '--s': size + 'px' }} aria-hidden="true">
    {url ? <img src={url} alt="" /> : <span>{initials(name)}</span>}
  </span>
}

async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const { w, h } = fitSize(bmp.width, bmp.height)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  return new Promise((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error('No se pudo leer la imagen'))), 'image/webp', 0.85))
}

const toDataUrl = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob) })

export function AvatarPicker({ row, onError }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const pick = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { onError?.('Elige una imagen'); return }
    setBusy(true)
    try {
      const blob = await shrink(file)
      const s = getSession()
      if (s.preview || !db) { await updateProfile({ avatar_path: await toDataUrl(blob) }); return }
      const path = avatarPath(s.profile.id)
      await db.upload('avatars', path, blob, 'image/webp')
      const old = row?.avatar_path
      await updateProfile({ avatar_path: path })
      if (old && old !== path) db.remove('avatars', [old]).catch(() => {}) // la anterior sobra
    } catch (x) { onError?.(x.message) }
    finally { setBusy(false) }
  }
  return <div className="fj-avatar-pick">
    <button type="button" className="fj-avatar-btn" onClick={() => input.current?.click()} disabled={busy}
      aria-label={row?.avatar_path ? 'Cambiar foto de perfil' : 'Añadir foto de perfil'}>
      <Avatar path={row?.avatar_path} name={row?.name} size={96} />
      <span className="fj-avatar-cam"><Icon name="camera" /></span>
    </button>
    <span className="dim small">{busy ? 'Subiendo…' : row?.avatar_path ? 'Toca para cambiar tu foto' : 'Añade una foto (opcional)'}</span>
    <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
  </div>
}
