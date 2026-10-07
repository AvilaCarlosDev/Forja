// Forja: piezas pequeñas que comparten las pantallas de Forja.
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import { SUPABASE_URL } from '../../lib/forja-config.js'

// Carga datos asíncronos con estado de carga/error y una forma de recargar.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const live = useRef(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: '' }))
    return Promise.resolve().then(fn)
      .then(data => { if (live.current) setState({ loading: false, data, error: '' }); return data })
      .catch(x => { if (live.current) setState(s => ({ ...s, loading: false, error: x.message })) })
  }, deps)
  useEffect(() => { live.current = true; run(); return () => { live.current = false } }, [run])
  return { ...state, reload: run }
}

export function Field({ id, label, hint, error, children }) {
  return <div className="fj-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {hint && <div className="dim small">{hint}</div>}
    {error && <div className="fj-err" role="alert">{error}</div>}
  </div>
}

// Opciones excluyentes que solo se marcan al tocarlas. (El Segmented de openGym siempre
// resalta la primera opción aunque no haya ninguna elegida.)
export function Choice({ id, options, value, onChange }) {
  return <div className="fj-chips" role="radiogroup" aria-labelledby={id}>
    {options.map((o, i) => <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
      id={i ? undefined : id + '-first'} className={'fj-chip' + (value === o.value ? ' on' : '')} onClick={() => onChange(o.value)}>
      {o.label}
    </button>)}
  </div>
}

// Panel que se despliega sobre la pantalla (por ejemplo, "Otro gimnasio"). Se cierra con Escape
// o tocando fuera; el foco entra al panel al abrirse.
export function Panel({ title, onClose, children }) {
  const box = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    box.current?.querySelector('input,button,textarea,select')?.focus?.()
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, [onClose])
  return <div className="fj-panel-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="fj-panel" role="dialog" aria-modal="true" aria-label={title} ref={box}>
      <div className="fj-panel-head">
        <h2>{title}</h2>
        <button type="button" className="fj-icon-btn" aria-label="Cerrar" onClick={onClose}><Icon name="xmark" /></button>
      </div>
      {children}
    </div>
  </div>
}

export const Loading = ({ text = 'Cargando…' }) => <div className="muted fj-center">{text}</div>
export const ErrorNote = ({ error, retry }) => <div className="fj-note warn" role="alert">
  {error} {retry && <button type="button" className="fj-link" onClick={retry}>Reintentar</button>}
</div>

// Logo de un gimnasio (bucket público gym-logos) o sus iniciales si no tiene foto.
export const gymLogoSrc = g => g?.logo_url || (g?.logo_path && SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/gym-logos/${g.logo_path}` : '')
export function GymLogo({ gym, src, size = 44 }) {
  const url = src || gymLogoSrc(gym)
  const initials = String(gym?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return <span className="fj-gym-logo" style={{ width: size, height: size }} aria-hidden="true">
    {url ? <img src={url} alt="" /> : <b data-i={initials} />}
  </span>
}

// La tarjeta de un gimnasio: logo, nombre, sede y dirección.
export function GymCard({ gym, src }) {
  return <div className="fj-gym-card">
    <GymLogo gym={gym} src={src} size={64} />
    <div className="fj-item-m"><b>{gym?.name || 'Nombre del gimnasio'}</b>
      <span>{[gym?.branch, gym?.address || 'Punto Fijo'].filter(Boolean).join(' · ')}</span>
      {gym && gym.verified === false && <small className="dim">Por verificar</small>}
    </div>
  </div>
}
