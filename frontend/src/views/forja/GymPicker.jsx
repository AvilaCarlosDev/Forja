// Forja: elegir gimnasio. El cliente elige uno; el entrenador, uno o varios. Si no está en la
// lista, "Otro" abre un panel para crear la tarjeta del gimnasio: foto del logo (con la cámara o
// de la galería), nombre, sede, dirección y red social. Así se va completando la lista de
// gimnasios de Punto Fijo; el admin los verifica después.
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { gymLabel, filterGyms, normalizeSocial, validateGymSuggestion } from '../../lib/forja-coach.js'
import { fitSize } from '../../lib/forja-profile.js'
import { Field, Panel, Loading, ErrorNote, useLoad, GymLogo, GymCard } from './parts.jsx'

async function shrinkLogo(file) {
  const bmp = await createImageBitmap(file)
  const { w, h } = fitSize(bmp.width, bmp.height, 400)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  return new Promise((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error('No se pudo leer la imagen'))), 'image/webp', 0.85))
}

function AddGym({ gyms, onAdded, onClose }) {
  const [f, setF] = useState({ name: '', branch: '', address: '', social: '', logo: null, preview: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined, proof: undefined })) }
  const pickLogo = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Elige una imagen'); return }
    try { const blob = await shrinkLogo(file); set('logo', blob); setF(p => ({ ...p, preview: URL.createObjectURL(blob) })) }
    catch (x) { setErr(x.message) }
  }
  const submit = async e => {
    // Este panel puede vivir dentro del formulario del perfil: el envío no sigue hasta él.
    e.preventDefault(); e.stopPropagation(); setErr('')
    const bad = validateGymSuggestion(f, gyms)
    setErrors(bad)
    if (Object.keys(bad).length) return
    setBusy(true)
    try {
      const g = await api().suggestGym({ name: f.name, branch: f.branch, address: f.address, social_url: normalizeSocial(f.social), logo: f.logo })
      onAdded(g)
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }
  return <Panel title="Tarjeta del gimnasio" onClose={onClose}>
    <form className="fj-form" onSubmit={submit} noValidate>
      <div className="fj-note">Si tu gimnasio no está en la lista, crea su tarjeta. Con la foto del logo o su red social validamos que existe, y queda para todos en Forja.</div>
      <GymCard gym={{ name: f.name.trim(), branch: f.branch.trim(), address: f.address.trim(), verified: false }} src={f.preview} />
      <div className="fj-field">
        <div className="fj-legend">Foto del logo</div>
        <div className="fj-row">
          <label className="fj-logo-pick"><Icon name="camera" /><span>Tomar foto</span>
            <input type="file" accept="image/*" capture="environment" hidden onChange={pickLogo} /></label>
          <label className="fj-logo-pick"><Icon name="image" /><span>Elegir de la galería</span>
            <input type="file" accept="image/*" hidden onChange={pickLogo} /></label>
        </div>
      </div>
      <Field id="fj-gym-name" label="Nombre del gimnasio" error={errors.name}>
        <input id="fj-gym-name" className="input" maxLength={80} value={f.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <Field id="fj-gym-branch" label="Sede o centro comercial (opcional)">
        <input id="fj-gym-branch" className="input" maxLength={60} placeholder="Ej.: C.C. Las Virtudes" value={f.branch} onChange={e => set('branch', e.target.value)} />
      </Field>
      <Field id="fj-gym-address" label="Dirección (opcional)" error={errors.address}>
        <input id="fj-gym-address" className="input" maxLength={120} placeholder="Ej.: Av. Bolívar, frente a la plaza" value={f.address} onChange={e => set('address', e.target.value)} />
      </Field>
      <Field id="fj-gym-social" label="Instagram, X, Facebook o TikTok" hint="Pega el enlace o escribe el @usuario." error={errors.social}>
        <input id="fj-gym-social" className="input" inputMode="url" autoCapitalize="off" placeholder="@nombredelgym" value={f.social} onChange={e => set('social', e.target.value)} />
      </Field>
      {errors.proof && <div className="fj-err" role="alert">{errors.proof}</div>}
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear tarjeta y elegir'}</Button>
    </form>
  </Panel>
}

// value: id (cliente) o lista de ids (entrenador). remote: entrena a distancia.
export default function GymPicker({ multi = false, value, remote, onChange }) {
  const gyms = useLoad(() => api().listGyms(), [])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const selected = multi ? (value || []) : (value ? [value] : [])
  if (gyms.loading && !gyms.data) return <Loading text="Cargando gimnasios…" />
  if (gyms.error) return <ErrorNote error={gyms.error} retry={gyms.reload} />
  const list = filterGyms(gyms.data || [], q)
  const toggle = id => {
    if (!multi) { onChange(id, false); return }
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id], remote)
  }
  return <div className="fj-gyms">
    <input className="input" type="search" placeholder="Buscar gimnasio" aria-label="Buscar gimnasio" value={q} onChange={e => setQ(e.target.value)} />
    <div className="fj-list" role={multi ? 'group' : 'radiogroup'} aria-label="Gimnasios de Punto Fijo">
      {list.map(g => {
        const on = selected.includes(g.id)
        return <button key={g.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on}
          className={'fj-item' + (on ? ' on' : '')} onClick={() => toggle(g.id)}>
          <GymLogo gym={g} />
          <span className="fj-item-m">
            <b>{gymLabel(g)}</b>
            <span>{g.address || 'Punto Fijo'}{g.verified ? '' : ' · por verificar'}</span>
          </span>
          {on && <Icon name="checkCircle" />}
        </button>
      })}
      {!list.length && <div className="dim small fj-center">No hay gimnasios con ese nombre.</div>}
      <button type="button" className="fj-item fj-item-add" onClick={() => setAdding(true)}>
        <span className="fj-item-m"><b>Otro</b><span>Mi gimnasio no está: crear su tarjeta con el logo</span></span>
        <Icon name="plus" />
      </button>
      <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={!!remote}
        className={'fj-item' + (remote ? ' on' : '')}
        onClick={() => multi ? onChange(selected, !remote) : onChange(null, true)}>
        <span className="fj-item-m">
          <b>{multi ? 'También entreno a distancia' : 'Entreno en casa o a distancia'}</b>
          <span>{multi ? 'Clientes que no van a un gimnasio podrán encontrarte' : 'No voy a un gimnasio'}</span>
        </span>
        {remote && <Icon name="checkCircle" />}
      </button>
    </div>
    {adding && <AddGym gyms={gyms.data || []} onClose={() => setAdding(false)}
      onAdded={g => { setAdding(false); gyms.reload(); multi ? onChange([...selected, g.id], remote) : onChange(g.id, false) }} />}
  </div>
}
