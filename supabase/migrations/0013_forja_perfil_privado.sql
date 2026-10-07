-- Forja · 0013 · la otra parte de un vínculo solo ve las columnas públicas del perfil (CN-003)
-- Ejecutar en Supabase → SQL Editor, después de 0012. No borra nada y se puede correr más de una vez.
--
-- Hasta 0012, quien tenía un vínculo (pendiente o activo) con alguien podía pedir su fila completa
-- de profiles: is_admin, terms_accepted_at, role_chosen y las fechas internas. Las políticas RLS
-- eligen filas, no columnas, así que ahora el permiso de lectura es por columna: solo las que la
-- app muestra de la otra persona (nombre, foto, sexo, rol, plan, nacimiento, gimnasio).
--
-- La fila propia completa se lee con forja_me(). Las funciones security definer no cambian.

revoke select on public.profiles from authenticated;
grant select (id, name, sex, role, plan, plan_expires_at, birth_date, avatar_path, onboarded_at, gym_id, remote)
  on public.profiles to authenticated;

create or replace function public.forja_me()
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke all on function public.forja_me() from public, anon;
grant execute on function public.forja_me() to authenticated;
