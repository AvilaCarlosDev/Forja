-- Forja · 0012 · rutinas que el entrenador asigna a su cliente
-- Ejecutar en Supabase → SQL Editor, después de 0011. No borra nada y se puede correr más de una vez.
--
-- El entrenador activo (Free o Pro, dentro de su cupo de 0011) arma rutinas para su cliente:
-- nombre, días de la semana y ejercicios del catálogo con series, repeticiones y peso. El cliente
-- las lee y las entrena tal cual; no las cambia. Al asignar o cambiar una, al cliente le llega
-- el aviso routine_assigned (0010).
--
-- exercises: [{ id: '0025', sets: 4, reps: 8, weight: 60, note: 'bajar lento' }]
-- days: días de la semana, 0 = domingo … 6 = sábado

create table if not exists public.assigned_routines (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id) on delete set null,
  name       text not null check (char_length(name) between 1 and 60),
  days       smallint[] not null default '{}' check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  exercises  jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array'),
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assigned_routines_client on public.assigned_routines (client_id, created_at);

comment on table public.assigned_routines is 'Forja: rutinas que el entrenador asigna a su cliente (catálogo, series, repeticiones y peso).';

alter table public.assigned_routines enable row level security;

drop policy if exists "rutinas asignadas: leer" on public.assigned_routines;
create policy "rutinas asignadas: leer" on public.assigned_routines for select to authenticated
  using (public.forja_can_read_client(client_id));

revoke all on public.assigned_routines from anon, authenticated;
grant select on public.assigned_routines to authenticated;

-- Forma y límites: hasta 15 ejercicios, cada uno con un id del catálogo y números razonables.
create or replace function public.forja_check_routine(p_exercises jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare e jsonb;
begin
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array'
     or jsonb_array_length(p_exercises) not between 1 and 15 then
    raise exception 'La rutina lleva entre 1 y 15 ejercicios' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(e) <> 'object' or coalesce(e ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,40}$'
       or coalesce(jsonb_typeof(e -> 'sets'), '') <> 'number' or (e ->> 'sets')::numeric not between 1 and 20
       or coalesce(jsonb_typeof(e -> 'reps'), '') <> 'number' or (e ->> 'reps')::numeric not between 1 and 100
       or (e ? 'weight' and (coalesce(jsonb_typeof(e -> 'weight'), '') <> 'number' or (e ->> 'weight')::numeric not between 0 and 1000))
       or char_length(coalesce(e ->> 'note', '')) > 200 then
      raise exception 'Ejercicio inválido en la rutina' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- El entrenador crea (p_id nulo) o cambia una rutina de su cliente.
create or replace function public.forja_set_routine(p_client uuid, p_id uuid, p_name text, p_days smallint[], p_exercises jsonb, p_note text default null)
returns public.assigned_routines language plpgsql security definer set search_path = public as $$
declare r public.assigned_routines;
begin
  if not public.forja_trainer_sees(p_client) then
    raise exception 'Ese cliente no está vinculado a ti' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Ponle un nombre a la rutina (hasta 60 caracteres)' using errcode = '22023';
  end if;
  if p_days is null or not (p_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]) then
    raise exception 'Días inválidos' using errcode = '22023';
  end if;
  perform public.forja_check_routine(p_exercises);
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'La nota admite hasta 500 caracteres' using errcode = '22023';
  end if;
  if p_id is null then
    if (select count(*) from public.assigned_routines where client_id = p_client) >= 14 then
      raise exception 'El cliente ya tiene 14 rutinas' using errcode = '22023';
    end if;
    insert into public.assigned_routines (client_id, trainer_id, name, days, exercises, note)
    values (p_client, auth.uid(), trim(p_name), p_days, p_exercises, nullif(trim(p_note), ''))
    returning * into r;
  else
    update public.assigned_routines
       set trainer_id = auth.uid(), name = trim(p_name), days = p_days, exercises = p_exercises,
           note = nullif(trim(p_note), ''), updated_at = now()
     where id = p_id and client_id = p_client
    returning * into r;
    if not found then raise exception 'Esa rutina no es de este cliente' using errcode = '42501'; end if;
  end if;
  return r;
end;
$$;

create or replace function public.forja_delete_routine(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select client_id into c from public.assigned_routines where id = p_id;
  if c is null or not public.forja_trainer_sees(c) then
    raise exception 'Esa rutina no es de un cliente tuyo' using errcode = '42501';
  end if;
  delete from public.assigned_routines where id = p_id;
end;
$$;

-- Aviso al cliente cuando le asignan o le cambian una rutina.
create or replace function public.forja_routine_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_notify_client(new.client_id, 'routine_assigned');
  return new;
end;
$$;

drop trigger if exists forja_assigned_routines_notify on public.assigned_routines;
create trigger forja_assigned_routines_notify after insert or update on public.assigned_routines
  for each row execute function public.forja_routine_notify();

revoke all on function public.forja_check_routine(jsonb) from public, anon, authenticated;
revoke all on function public.forja_set_routine(uuid, uuid, text, smallint[], jsonb, text) from public, anon, authenticated;
revoke all on function public.forja_delete_routine(uuid) from public, anon, authenticated;
revoke all on function public.forja_routine_notify() from public, anon, authenticated;
grant execute on function public.forja_set_routine(uuid, uuid, text, smallint[], jsonb, text) to authenticated;
grant execute on function public.forja_delete_routine(uuid) to authenticated;
