-- Forja · 0006 · entrar con Google (y más adelante Apple): elegir el rol después
-- Ejecutar en Supabase → SQL Editor, después de 0005. No borra nada y se puede correr más de una vez.
--
-- Con correo y contraseña, el formulario de registro manda el rol (Personal Trainer o Cliente) y
-- la aceptación de los términos. Con Google o Apple no hay formulario: la cuenta nace como cliente
-- y con role_chosen = false, y el asistente pregunta el rol una sola vez, antes de terminar el perfil.

alter table public.profiles add column if not exists role_chosen boolean not null default false;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- Las cuentas que ya existen se registraron con el formulario: ya eligieron rol y aceptaron.
update public.profiles set role_chosen = true, terms_accepted_at = coalesce(terms_accepted_at, created_at)
 where not role_chosen and created_at < now() - interval '1 second'
   and id in (select id from auth.users where coalesce(raw_app_meta_data->>'provider', 'email') = 'email');

-- Alta de una cuenta: el nombre puede venir de Google ("full_name"/"name"); el rol solo cuenta como
-- elegido si vino del formulario de registro.
create or replace function public.forja_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen boolean := coalesce(m->>'role' in ('trainer', 'client'), false);
begin
  insert into public.profiles (id, name, sex, role, role_chosen, terms_accepted_at)
  values (
    new.id,
    left(coalesce(nullif(trim(m->>'name'), ''), nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1)), 60),
    case when m->>'sex' in ('male', 'female') then m->>'sex' end,
    case when m->>'role' = 'trainer' then 'trainer' else 'client' end,
    chosen,
    case when chosen then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El asistente fija el rol y la aceptación de los términos. Solo mientras el perfil no esté
-- terminado: después, el rol ya no se cambia desde la app.
create or replace function public.forja_choose_role(p_role text, p_accept boolean)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'No hay sesión' using errcode = '42501';
  end if;
  if p.onboarded_at is not null then
    raise exception 'Tu perfil ya está completo: el tipo de cuenta no se cambia desde aquí' using errcode = '22023';
  end if;
  if p_role not in ('trainer', 'client') then
    raise exception 'Elige Personal Trainer o Cliente' using errcode = '22023';
  end if;
  if p_accept is not true then
    raise exception 'Debes aceptar los términos y la política de privacidad' using errcode = '22023';
  end if;
  -- Un entrenador que pasa a cliente deja de figurar en sus gimnasios.
  if p_role = 'client' then delete from public.trainer_gyms where trainer_id = p.id; end if;
  update public.profiles set role = p_role, role_chosen = true, terms_accepted_at = now()
   where id = p.id returning * into p;
  return p;
end;
$$;

revoke all on function public.forja_choose_role(text, boolean) from public, anon;
grant execute on function public.forja_choose_role(text, boolean) to authenticated;

-- Terminar el perfil ahora exige también el rol elegido.
create or replace function public.forja_finish_onboarding()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then
    raise exception 'No hay sesión' using errcode = '42501';
  end if;
  if not p.role_chosen then
    raise exception 'Elige si eres Personal Trainer o Cliente' using errcode = '22023';
  end if;
  if p.birth_date is null then
    raise exception 'Falta la fecha de nacimiento' using errcode = '22023';
  end if;
  if p.sex is null then
    raise exception 'Falta el sexo' using errcode = '22023';
  end if;
  if public.forja_age(p.birth_date) < 18
     and not exists (select 1 from public.guardian_consents where user_id = p.id) then
    raise exception 'Falta el consentimiento de tu madre, padre o tutor' using errcode = '22023';
  end if;
  if p.role = 'client' and p.gym_id is null and not p.remote then
    raise exception 'Elige tu gimnasio o marca que entrenas a distancia' using errcode = '22023';
  end if;
  if p.role = 'trainer' and not p.remote
     and not exists (select 1 from public.trainer_gyms where trainer_id = p.id) then
    raise exception 'Elige al menos un gimnasio donde trabajas o marca que entrenas a distancia' using errcode = '22023';
  end if;
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = p.id returning * into p;
  return p;
end;
$$;
