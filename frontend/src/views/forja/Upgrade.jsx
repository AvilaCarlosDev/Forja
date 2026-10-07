// Forja: lo que se abre al tocar una función Pro sin tenerla. El entrenador Free ve qué trae
// Pro y cómo activarlo; el cliente ve que depende del plan de su entrenador.
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { Panel } from './parts.jsx'

export const PRO_PERKS = [
  'Clientes ilimitados (Free: hasta 5)',
  'Dietas para cada cliente, con plantillas y copiando la de otro cliente',
  'Gráficas de evolución y comparativa de inicio contra hoy',
  'Finanzas: mensualidades, pagos y vencidos',
]

// WhatsApp de Carlos para pagar y activar los planes (lo activa él a mano).
export const PLANS_WHATSAPP = '13464919344'
export const planWhatsAppUrl = (plan = 'Pro') =>
  `https://wa.me/${PLANS_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero activar el plan ${plan} de Forja.`)}`

export default function Upgrade({ viewer = 'trainer', feature = 'Esta función', onClose }) {
  if (viewer === 'client') return <Panel title="Función del plan Pro" onClose={onClose}>
    <p className="fj-p">{feature} solo está disponible si tu entrenador tiene el plan Pro.</p>
    <p className="dim small">Tú no pagas nada: ves lo que permite el plan de tu entrenador. Si quieres tenerla, pídele que se pase a Pro.</p>
    <Button variant="primary" type="button" onClick={onClose}>Entendido</Button>
  </Panel>
  return <Panel title="Mejora tu suscripción a Pro" onClose={onClose}>
    <p className="fj-p">{feature} es parte del plan Pro. Con Pro tienes:</p>
    <ul className="fj-perks">{PRO_PERKS.map(p => <li key={p}><Icon name="checkCircle" /> {p}</li>)}</ul>
    <div className="fj-note">Pagas por pago móvil, transferencia, Zelle o Binance y lo activamos en tu cuenta. Escríbenos por WhatsApp y te pasamos los datos de pago.</div>
    <a className="btn primary fj-btn-wide" href={planWhatsAppUrl('Pro')} target="_blank" rel="noopener noreferrer"><span>Pedir Pro por WhatsApp</span></a>
    <Button type="button" onClick={onClose}>Ahora no</Button>
  </Panel>
}
