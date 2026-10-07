// Forja: piezas pequeñas que comparten las pantallas de Forja.
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'

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
