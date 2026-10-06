-- Forja · 0001 · perfiles de usuario
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede correr más de una vez.
-- No borra nada. La limpieza de la app anterior está en 0000_revisar_y_limpiar.sql y se
-- ejecuta aparte, a mano, después de revisar qué hay.

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 60),
  sex             text check (sex in ('male', 'female')),
  role            text not null check (role in ('trainer', 'client')),
  -- El plan es del entrenador. Un cliente no tiene plan propio: ve lo que permite el de su coach.
  plan            text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is 'Forja: un perfil por cuenta. Rol, sexo y plan del entrenador.';

-- Al registrarse alguien, su perfil se crea a partir de los datos del formulario.
-- El plan y is_admin nunca se leen del formulario: siempre nacen en free / false.
create or replace function public.forja_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, name, sex, role)
  values (
    new.id,
    left(coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)), 60),
    case when m->>'sex' in ('male', 'female') then m->>'sex' end,
    case when m->>'role' = 'trainer' then 'trainer' else 'client' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists forja_on_auth_user_created on auth.users;
create trigger forja_on_auth_user_created
  after insert on auth.users
  for each row execute function public.forja_handle_new_user();

create or replace function public.forja_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists forja_profiles_touch on public.profiles;
create trigger forja_profiles_touch
  before update on public.profiles
  for each row execute function public.forja_touch_updated_at();

-- Seguridad por fila: cada cuenta ve y edita solo su perfil.
alter table public.profiles enable row level security;

drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Y aun en su propio perfil, solo nombre y sexo. Rol, plan, vencimiento e is_admin
-- no se pueden cambiar desde la app: los cambia el admin con la clave de servicio.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, sex) on public.profiles to authenticated;

-- El plan vigente de un entrenador: pro solo mientras no haya vencido.
create or replace function public.forja_effective_plan(p public.profiles)
returns text language sql stable as $$
  select case when p.plan = 'pro' and (p.plan_expires_at is null or p.plan_expires_at > now()) then 'pro' else 'free' end;
$$;
