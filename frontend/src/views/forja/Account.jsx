// Forja: la cuenta en Ajustes — foto, quién eres, tu perfil y cerrar sesión.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { Section, Row } from '../../components/ui.jsx'
import { auth, setSession, useForjaSession, useForjaProfile, ROLE_LABEL } from '../../lib/forja-session.js'
import { ageOn } from '../../lib/forja-profile.js'
import { AvatarPicker } from './Avatar.jsx'

const toast = m => useUI.getState().toast(m)

export default function ForjaAccount() {
  const s = useForjaSession()
  const { row } = useForjaProfile()
  if (!s) return null
  // Lo de la base manda sobre lo que se escribió al registrarse (el nombre puede haber cambiado).
  const profile = { ...s.profile, ...(row || {}), email: s.profile.email }
  const age = ageOn(profile.birth_date)
  const signOut = async () => {
    if (auth) await auth.signOut()
    setSession(null)
    // Los entrenamientos de este dispositivo no se borran: se vuelve a la pantalla de entrada.
    useStore.getState().setGuest(false)
    toast('Sesión cerrada')
  }
  return <Section title="Tu cuenta" footer={s.preview
    ? 'Cuenta de prueba: existe solo en este navegador.'
    : profile.role === 'trainer' ? 'Plan Free: hasta 5 clientes.' : 'Lo que ves depende del plan de tu entrenador. Tú nunca pagas.'}>
    {row && <div className="fj-account-head"><AvatarPicker row={row} onError={toast} /></div>}
    <Row icon="person" iconTint="var(--acc)" title={profile.name} subtitle={profile.email} value={ROLE_LABEL[profile.role]} />
    {age != null && <Row icon="calendar" iconTint="var(--acc)" title="Edad" value={age + ' años'} />}
    <Row icon="signOut" iconTint="var(--red)" title="Cerrar sesión" danger onClick={signOut} />
  </Section>
}
