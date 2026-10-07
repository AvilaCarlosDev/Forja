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

export default function Upgrade({ viewer = 'trainer', feature = 'Esta función', onClose }) {
  if (viewer === 'client') return <Panel title="Función del plan Pro" onClose={onClose}>
    <p className="fj-p">{feature} solo está disponible si tu entrenador tiene el plan Pro.</p>
    <p className="dim small">Tú no pagas nada: ves lo que permite el plan de tu entrenador. Si quieres tenerla, pídele que se pase a Pro.</p>
    <Button variant="primary" type="button" onClick={onClose}>Entendido</Button>
  </Panel>
  return <Panel title="Mejora tu suscripción a Pro" onClose={onClose}>
    <p className="fj-p">{feature} es parte del plan Pro. Con Pro tienes:</p>
    <ul className="fj-perks">{PRO_PERKS.map(p => <li key={p}><Icon name="checkCircle" /> {p}</li>)}</ul>
    <div className="fj-note">Por ahora el plan Pro se activa a mano: pagas por pago móvil, transferencia, Zelle o Binance y el administrador lo activa en tu cuenta. Pronto podrás hacerlo desde la app.</div>
    <Button variant="primary" type="button" onClick={onClose}>Entendido</Button>
  </Panel>
}
