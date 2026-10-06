// Forja: la cuenta en Ajustes — quién eres, tu perfil y cerrar sesión.
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { Section, Row } from '../../components/ui.jsx'
import { auth, setSession, useForjaSession, ROLE_LABEL } from '../../lib/forja-session.js'

export default function ForjaAccount() {
  const s = useForjaSession()
  if (!s) return null
  const { profile } = s
  const signOut = async () => {
    if (auth) await auth.signOut()
    setSession(null)
    // Los entrenamientos de este dispositivo no se borran: se vuelve a la pantalla de entrada.
    useStore.getState().setGuest(false)
    useUI.getState().toast('Sesión cerrada')
  }
  return <Section title="Tu cuenta" footer={s.preview
    ? 'Cuenta de prueba: existe solo en este navegador.'
    : profile.role === 'trainer' ? 'Plan Free: hasta 5 clientes.' : 'Lo que ves depende del plan de tu entrenador. Tú nunca pagas.'}>
    <Row icon="person" iconTint="var(--acc)" title={profile.name} subtitle={profile.email} value={ROLE_LABEL[profile.role]} />
    <Row icon="signOut" iconTint="var(--red)" title="Cerrar sesión" danger onClick={signOut} />
  </Section>
}
