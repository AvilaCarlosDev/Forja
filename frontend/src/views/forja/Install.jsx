// Forja: "Instalar Forja" — convertir la web en app desde el navegador del teléfono.
import { useState } from 'react'
import { Button } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { BRAND } from '../../lib/brand.js'
import {
  platform, isStandalone, installMode, useInstallState, promptInstall, wasDismissed, dismiss,
} from '../../lib/forja-install.js'
import { Panel } from './parts.jsx'

// Los dos glifos de Safari, dibujados para que la persona los reconozca en su pantalla.
const ShareGlyph = () => <svg className="fj-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
</svg>
const AddGlyph = () => <svg className="fj-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" />
</svg>

function Steps({ mode, onClose }) {
  return <Panel title={`Instalar ${BRAND}`} onClose={onClose}>
    <div className="fj-install">
      <img src="icon-192.png" alt="" className="fj-install-icon" />
      <p className="fj-p">{BRAND} queda en tu pantalla de inicio como una app: se abre a pantalla completa y sin la barra del navegador.</p>
      {mode === 'ios' && <ol className="fj-steps-list">
        <li><span className="fj-step-n">1</span><span>Toca <b>Compartir</b> <ShareGlyph /> en la barra de Safari (abajo; en iPad, arriba).</span></li>
        <li><span className="fj-step-n">2</span><span>Baja y elige <b>Agregar a inicio</b> <AddGlyph />.</span></li>
        <li><span className="fj-step-n">3</span><span>Toca <b>Agregar</b>. El ícono de {BRAND} aparece en tu pantalla de inicio.</span></li>
      </ol>}
      {mode === 'ios-other' && <ol className="fj-steps-list">
        <li><span className="fj-step-n">1</span><span>Toca <b>Compartir</b> <ShareGlyph /> (en Chrome está junto a la barra de direcciones).</span></li>
        <li><span className="fj-step-n">2</span><span>Elige <b>Agregar a inicio</b> <AddGlyph />. Si no aparece, abre esta página en <b>Safari</b> y hazlo desde ahí.</span></li>
      </ol>}
      {mode === 'menu' && <ol className="fj-steps-list">
        <li><span className="fj-step-n">1</span><span>Abre el menú <b>⋮</b> del navegador (arriba a la derecha).</span></li>
        <li><span className="fj-step-n">2</span><span>Elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</span></li>
      </ol>}
      <Button variant="primary" type="button" onClick={onClose}>Entendido</Button>
    </div>
  </Panel>
}

function useInstall() {
  const state = useInstallState()
  const plat = platform()
  const mode = state === 'installed' ? null : installMode({ plat, standalone: isStandalone(), canPrompt: state === 'ready' })
  return mode
}

// Enlace discreto (pantalla de entrada).
export function InstallLink() {
  const mode = useInstall()
  const [open, setOpen] = useState(false)
  if (!mode) return null
  const go = () => (mode === 'prompt' ? promptInstall() : setOpen(true))
  return <>
    <button type="button" className="fj-install-link" onClick={go}><Icon name="download" /> Instala {BRAND} en tu teléfono</button>
    {open && <Steps mode={mode} onClose={() => setOpen(false)} />}
  </>
}

// Aviso que se puede cerrar (dentro de la app, solo en teléfonos).
export function InstallBanner() {
  const mode = useInstall()
  const [hidden, setHidden] = useState(() => wasDismissed())
  const [open, setOpen] = useState(false)
  if (!mode || hidden) return null
  const close = () => { dismiss(); setHidden(true) }
  return <div className="fj-install-banner" role="region" aria-label={`Instalar ${BRAND}`}>
    <img src="icon-192.png" alt="" />
    <div className="fj-item-m"><b>Instala {BRAND}</b><span>Ábrela desde tu pantalla de inicio, como una app.</span></div>
    <Button variant="primary" size="sm" type="button" onClick={() => (mode === 'prompt' ? promptInstall() : setOpen(true))}>Instalar</Button>
    <button type="button" className="fj-icon-btn small" aria-label="Ahora no" onClick={close}><Icon name="xmark" /></button>
    {open && <Steps mode={mode} onClose={() => setOpen(false)} />}
  </div>
}
