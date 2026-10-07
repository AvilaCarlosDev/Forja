// Forja: editar el perfil después del registro — nombre, sexo, fecha de nacimiento y gimnasio(s).
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { api } from '../../lib/forja-api.js'
import { updateProfile } from '../../lib/forja-session.js'
import { validateDetails, ageOn, todayISO, SEX_OPTIONS } from '../../lib/forja-profile.js'
import { Panel, Field, Choice } from './parts.jsx'
import GymPicker from './GymPicker.jsx'

const toast = m => useUI.getState().toast(m)

export default function ProfileEdit({ row, onClose }) {
  const trainer = row.role === 'trainer'
  const today = todayISO()
  const [f, setF] = useState({ name: row.name || '', sex: row.sex || '', birth_date: row.birth_date || '' })
  const [errors, setErrors] = useState({})
  const [gym, setGym] = useState(trainer ? [] : (row.gym_id || null))
  const [remote, setRemote] = useState(!!row.remote && !row.gym_id)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!trainer) return
    let live = true
    api().myTrainerGyms().then(ids => { if (live) setGym(ids || []) }).catch(() => {})
    return () => { live = false }
  }, [trainer])

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: undefined })) }
  const age = ageOn(f.birth_date, today)

  const submit = async e => {
    e.preventDefault()
    setErr('')
    const bad = validateDetails(f, today)
    if (Object.keys(bad).length) { setErrors(bad); return }
    if (!trainer && !gym && !remote) { setErr('Elige tu gimnasio o marca que entrenas en casa'); return }
    if (trainer && !gym.length && !remote) { setErr('Elige al menos un gimnasio o marca que trabajas a distancia'); return }
    setBusy(true)
    try {
      await updateProfile({ name: f.name.trim(), sex: f.sex, birth_date: f.birth_date })
      if (f.sex && f.sex !== row.sex) useStore.getState().update(s => { s.body = f.sex })
      if (trainer) await api().setTrainerGyms(gym, remote)
      else await api().setClientGym(gym, remote && !gym)
      toast('Perfil actualizado')
      onClose()
    } catch (x) { setErr(x.message) }
    finally { setBusy(false) }
  }

  return <Panel title="Editar perfil" onClose={onClose}>
    <form className="fj-form" onSubmit={submit} noValidate>
      <Field id="fj-pe-name" label="Nombre" error={errors.name}>
        <input id="fj-pe-name" className="input" autoComplete="name" maxLength={60} value={f.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <div className="fj-field">
        <div className="fj-legend" id="fj-pe-sex-label">Sexo</div>
        <Choice id="fj-pe-sex" options={SEX_OPTIONS} value={f.sex} onChange={v => set('sex', v)} />
        {errors.sex && <div className="fj-err" role="alert">{errors.sex}</div>}
      </div>
      <Field id="fj-pe-birth" label="Fecha de nacimiento" error={errors.birth_date}
        hint={age != null ? `${age} años · se usa para tus referencias de progreso, no se muestra a nadie.` : 'Se usa para tus referencias de progreso. No se muestra a nadie.'}>
        <input id="fj-pe-birth" className="input" type="date" max={today} autoComplete="bday" value={f.birth_date} onChange={e => set('birth_date', e.target.value)} />
      </Field>
      <div className="fj-field">
        <div className="fj-legend">{trainer ? '¿En qué gimnasios trabajas? Puedes elegir varios.' : '¿En qué gimnasio entrenas?'}</div>
        <GymPicker multi={trainer} value={gym} remote={remote}
          onChange={(v, r) => { setGym(v); setRemote(!!r); setErr('') }} />
      </div>
      {err && <div className="fj-err" role="alert">{err}</div>}
      <Button variant="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
    </form>
  </Panel>
}
