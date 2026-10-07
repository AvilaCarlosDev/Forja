-- Forja · 0002 · completar el perfil: fecha de nacimiento, foto y consentimiento del tutor
-- Ejecutar en Supabase → SQL Editor, después de 0001. No borra nada y se puede correr más de una vez.
--
-- Reglas:
--   * Toda cuenta completa su perfil antes de usar la app (onboarded_at).
--   * Los menores de 18 no se bloquean: necesitan el consentimiento de madre, padre o tutor,
--     porque la app guarda medidas corporales y fotos de progreso.
--   * Edad mínima: 13 años (forja_min_age). Por debajo no se puede usar la app.
--   * onboarded_at no lo escribe el usuario: lo pone forja_finish_onboarding() tras comprobarlo todo.

alter table public.profiles add column if not exists birth_date   date;
alter table public.profiles add column if not exists avatar_path  text;
alter table public.profiles add column if not exists onboarded_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_avatar_path_own
    check (avatar_path is null or avatar_path like id::text || '/%');
exception when duplicate_object then null; end $$;

create or replace function public.forja_min_age() returns int language sql immutable as $$ select 13 $$;

create or replace function public.forja_age(d date, today date default current_date)
returns int language sql immutable as $$
  select extract(year from age(today, d))::int
$$;

-- Fecha de nacimiento razonable: no en el futuro, no más de 100 años atrás, edad mínima cumplida.
create or replace function public.forja_check_birth_date()
returns trigger language plpgsql as $$
begin
  if new.birth_date is not null and new.birth_date is distinct from old.birth_date then
    if new.birth_date > current_date then
      raise exception 'La fecha de nacimiento no puede estar en el futuro' using errcode = '22023';
    end if;
    if new.birth_date < current_date - interval '100 years' then
      raise exception 'Revisa la fecha de nacimiento' using errcode = '22023';
    end if;
    if public.forja_age(new.birth_date) < public.forja_min_age() then
      raise exception 'Forja es para mayores de % años', public.forja_min_age() using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists forja_profiles_birth_date on public.profiles;
create trigger forja_profiles_birth_date before update on public.profiles
  for each row execute function public.forja_check_birth_date();

-- Consentimiento de madre, padre o tutor para menores de 18.
create table if not exists public.guardian_consents (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  guardian_name  text not null check (char_length(trim(guardian_name)) between 3 and 80),
  guardian_email text not null check (guardian_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  relationship   text not null check (relationship in ('madre', 'padre', 'tutor')),
  consented_at   timestamptz not null default now()
);

comment on table public.guardian_consents is 'Forja: consentimiento del tutor de un usuario menor de 18 años.';

alter table public.guardian_consents enable row level security;

drop policy if exists "consentimiento propio: leer" on public.guardian_consents;
create policy "consentimiento propio: leer" on public.guardian_consents
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "consentimiento propio: crear" on public.guardian_consents;
create policy "consentimiento propio: crear" on public.guardian_consents
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "consentimiento propio: editar" on public.guardian_consents;
create policy "consentimiento propio: editar" on public.guardian_consents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.guardian_consents from anon, authenticated;
grant select, insert on public.guardian_consents to authenticated;
grant update (guardian_name, guardian_email, relationship, consented_at) on public.guardian_consents to authenticated;

-- El usuario edita sus datos de perfil; plan, rol, is_admin y onboarded_at quedan fuera.
revoke update on public.profiles from authenticated;
grant update (name, sex, birth_date, avatar_path) on public.profiles to authenticated;

-- Último paso del asistente: comprueba que el perfil esté completo y lo marca como listo.
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
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = p.id returning * into p;
  return p;
end;
$$;

revoke all on function public.forja_finish_onboarding() from public, anon;
grant execute on function public.forja_finish_onboarding() to authenticated;

-- Fotos de perfil: carpeta privada, una por usuario (<uid>/avatar.webp), hasta 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "avatar propio: leer" on storage.objects;
create policy "avatar propio: leer" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar propio: subir" on storage.objects;
create policy "avatar propio: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar propio: reemplazar" on storage.objects;
create policy "avatar propio: reemplazar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar propio: borrar" on storage.objects;
create policy "avatar propio: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
