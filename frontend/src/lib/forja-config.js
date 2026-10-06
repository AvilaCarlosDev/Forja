// Forja: configuración de build. Las dos variables salen del panel de Supabase
// (Project Settings → API). La clave "anon" es pública por diseño; la "service_role" no se
// pone nunca en el frontend.
const env = import.meta.env || {}
export const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || ''
// Con Supabase configurado, la app pide cuenta con correo en lugar del acceso de openGym.
export const FORJA_AUTH = !!(SUPABASE_URL && SUPABASE_KEY)
// Sin Supabase: enseña las mismas pantallas sin crear nada en ningún servidor (vista previa).
export const FORJA_AUTH_PREVIEW = !FORJA_AUTH && env.VITE_FORJA_AUTH_PREVIEW === '1'
export const FORJA_AUTH_UI = FORJA_AUTH || FORJA_AUTH_PREVIEW
export const LEGAL = {
  terms: 'https://github.com/AvilaCarlosDev/Forja/blob/main/docs/legal/TERMINOS.md',
  privacy: 'https://github.com/AvilaCarlosDev/Forja/blob/main/docs/legal/PRIVACIDAD.md',
}
