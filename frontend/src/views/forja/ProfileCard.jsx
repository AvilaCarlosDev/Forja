// Forja: tarjeta de perfil en el inicio. Foto, nombre, rol y plan; el entrenador ve el gimnasio
// donde está y cuántos clientes tiene, el cliente su gimnasio y su coach. Tocarla lleva a
// Clientes o a Mi coach.
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { api } from '../../lib/forja-api.js'
import { useForjaProfile } from '../../lib/forja-session.js'
import { effectivePlan, gymLabel, linkSummary } from '../../lib/forja-coach.js'
import { Avatar } from './Avatar.jsx'
import { GymLogo, gymLogoSrc, useLoad } from './parts.jsx'
import '../../forja.css'

const savedGym = () => { try { return localStorage.getItem('forja_coach_gym') } catch { return null } }

export default function ProfileCard() {
  const nav = useNavigate()
  const { row } = useForjaProfile()
  const trainer = row?.role === 'trainer'
  const links = useLoad(() => (row ? api().myLinks() : []), [row?.id])
  const gyms = useLoad(async () => {
    if (!row) return []
    const ids = trainer ? await api().myTrainerGyms() : row.gym_id ? [row.gym_id] : []
    return ids.length ? api().gymsByIds(ids) : []
  }, [row?.id, row?.gym_id, trainer])
  if (!row) return null
  const list = gyms.data || []
  const gym = (trainer && list.find(g => g.id === savedGym())) || list[0]
  const all = links.data || []
  const clients = all.filter(l => l.trainer_id === row.id && l.status === 'active').length
  const { active } = trainer ? {} : linkSummary(all, row.id)
  const pro = effectivePlan(row) === 'pro'
  const role = trainer ? `Entrenador · plan ${pro ? 'Pro' : 'Free'}` : active ? `Cliente de ${active.trainer?.name || 'tu coach'}` : 'Cliente'
  const where = gym ? gymLabel(gym) : row.remote ? 'Entrena a distancia' : trainer ? 'Sin gimnasio elegido' : 'Sin gimnasio'
  return <button type="button" className="fj-profile-card" onClick={() => nav(trainer ? '/clientes' : '/mi-coach')}
    aria-label={`${row.name}: ${role}. Abrir ${trainer ? 'Clientes' : 'Mi coach'}`}>
    <Avatar path={row.avatar_path} name={row.name} size={56} />
    <span className="fj-item-m">
      <b>{row.name}</b>
      <span>{role}</span>
      <span className="fj-profile-card-gym">
        {gymLogoSrc(gym) && <GymLogo gym={gym} size={20} />}{where}
        {trainer && links.data && <> · {clients} {clients === 1 ? 'cliente' : 'clientes'}</>}
      </span>
    </span>
    {trainer && pro && <span className="fj-badge">Pro</span>}
    <Icon name="chevronRight" />
  </button>
}
