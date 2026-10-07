-- Forja · 0003 · gimnasios de Punto Fijo y dónde entrena cada perfil
-- Ejecutar en Supabase → SQL Editor, después de 0002. No borra nada y se puede correr más de una vez.
--
-- Reglas:
--   * La lista inicial solo trae gimnasios con fuente oficial (docs/research/gimnasios-punto-fijo.md).
--   * "Otro": cualquier usuario agrega un gimnasio que falte, con una red social o una foto del
--     logo para validar que existe. Queda sin verificar (verified = false), se puede usar enseguida
--     y el admin lo revisa.
--   * El cliente tiene un gimnasio (profiles.gym_id) o entrena a distancia (profiles.remote).
--   * El entrenador trabaja en uno o varios gimnasios (trainer_gyms) o solo a distancia.

create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,                                  -- solo los de la lista inicial
  name        text not null check (char_length(trim(name)) between 2 and 80),
  branch      text check (branch is null or char_length(trim(branch)) between 2 and 60),
  city        text not null default 'Punto Fijo',
  state       text not null default 'Falcón',
  address     text check (address is null or char_length(address) <= 160),
  social_url  text check (social_url is null or social_url ~* '^https://[^\s]+\.[a-z]{2,}/[^\s]*$'),
  logo_path   text,
  source_url  text,                                         -- fuente oficial que lo verificó
  verified    boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Un gimnasio propuesto necesita una red social o una foto del logo para poder validarlo.
  constraint gyms_proof check (verified or social_url is not null or logo_path is not null),
  constraint gyms_logo_own check (logo_path is null or created_by is null or logo_path like created_by::text || '/%')
);

comment on table public.gyms is 'Forja: gimnasios. verified = revisado por el admin o con fuente oficial.';

create unique index if not exists gyms_unique_name on public.gyms
  (lower(trim(name)), lower(coalesce(trim(branch), '')), lower(city));

alter table public.gyms enable row level security;

create or replace function public.forja_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

drop policy if exists "gimnasios: leer" on public.gyms;
create policy "gimnasios: leer" on public.gyms for select to authenticated using (true);

drop policy if exists "gimnasios: proponer" on public.gyms;
create policy "gimnasios: proponer" on public.gyms for insert to authenticated
  with check (created_by = auth.uid() and verified = false and slug is null and source_url is null);

drop policy if exists "gimnasios: admin edita" on public.gyms;
create policy "gimnasios: admin edita" on public.gyms for update to authenticated
  using (public.forja_is_admin()) with check (public.forja_is_admin());

drop policy if exists "gimnasios: admin borra" on public.gyms;
create policy "gimnasios: admin borra" on public.gyms for delete to authenticated using (public.forja_is_admin());

revoke all on public.gyms from anon, authenticated;
grant select, insert, update, delete on public.gyms to authenticated;

-- Freno al spam: hasta 5 gimnasios sin verificar propuestos por persona.
create or replace function public.forja_limit_gym_suggestions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and (
    select count(*) from public.gyms where created_by = new.created_by and not verified) >= 5 then
    raise exception 'Ya propusiste 5 gimnasios que aún no se revisan' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists forja_gyms_limit on public.gyms;
create trigger forja_gyms_limit before insert on public.gyms
  for each row execute function public.forja_limit_gym_suggestions();

-- Lista inicial verificada (2026-10-06). Ver docs/research/gimnasios-punto-fijo.md.
insert into public.gyms (slug, name, branch, address, social_url, source_url, verified) values
  ('gold-stars-sambil', 'Gold Stars Gym', 'Sambil Paraguaná', 'Sambil Paraguaná, entrada Terrazas del Sambil',
   'https://www.instagram.com/goldstarsgym/', 'https://goldstarsgym.com/contacto/', true),
  ('gold-stars-las-virtudes', 'Gold Stars Gym', 'Las Virtudes', 'C.C. Las Virtudes',
   'https://www.instagram.com/goldstarsgym/', 'https://goldstarsgym.com/contacto/', true),
  -- Tercera sede: no sale en su web; la confirmó Carlos y aparece como "Gold Stars Gym Cdv" en Yandex Maps.
  ('gold-stars-ciudad-del-viento', 'Gold Stars Gym', 'Ciudad del Viento', 'C.C. Ciudad del Viento',
   'https://www.instagram.com/goldstarsgym/', 'https://www.instagram.com/goldstarsgym/', true),
  ('altitude-punto-fijo', 'Altitude', null, 'C.C. Mediterráneo, Av. Ollarvides',
   'https://www.instagram.com/altitudepf/', 'https://www.instagram.com/altitudepf/', true),
  -- Cuenta oficial verificada; su bio no nombra la ciudad: Punto Fijo lo confirmó Carlos (vive allí).
  ('new-life-training-center', 'New Life Training Center', null, null,
   'https://www.instagram.com/nltc_gym/', 'https://www.instagram.com/nltc_gym/', true)
on conflict (slug) do nothing;

-- Dónde entrena el cliente.
alter table public.profiles add column if not exists gym_id uuid references public.gyms (id) on delete set null;
alter table public.profiles add column if not exists remote boolean not null default false;
grant update (gym_id, remote) on public.profiles to authenticated;

-- Dónde trabaja el entrenador (uno o varios).
create table if not exists public.trainer_gyms (
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  primary key (trainer_id, gym_id)
);

alter table public.trainer_gyms enable row level security;

drop policy if exists "gimnasios del entrenador: leer" on public.trainer_gyms;
create policy "gimnasios del entrenador: leer" on public.trainer_gyms for select to authenticated using (true);

drop policy if exists "gimnasios del entrenador: agregar" on public.trainer_gyms;
create policy "gimnasios del entrenador: agregar" on public.trainer_gyms for insert to authenticated
  with check (trainer_id = auth.uid()
              and exists (select 1 from public.profiles where id = auth.uid() and role = 'trainer'));

drop policy if exists "gimnasios del entrenador: quitar" on public.trainer_gyms;
create policy "gimnasios del entrenador: quitar" on public.trainer_gyms for delete to authenticated
  using (trainer_id = auth.uid());

revoke all on public.trainer_gyms from anon, authenticated;
grant select, insert, delete on public.trainer_gyms to authenticated;

-- El asistente ahora también exige el gimnasio (o entrenar a distancia).
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

-- Logos de gimnasios propuestos: públicos (no son datos personales), cada quien sube a su carpeta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-logos', 'gym-logos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "logo de gimnasio: subir" on storage.objects;
create policy "logo de gimnasio: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'gym-logos' and (storage.foldername(name))[1] = auth.uid()::text);
