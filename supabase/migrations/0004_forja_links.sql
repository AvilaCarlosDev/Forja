-- Forja · 0004 · vínculo entrenador–cliente y notificaciones
-- Ejecutar en Supabase → SQL Editor, después de 0003. No borra nada y se puede correr más de una vez.
--
-- Cómo funciona:
--   1. El cliente elige un entrenador de su gimnasio → se crea una SOLICITUD (pending) y al
--      entrenador le llega una notificación.
--   2. El entrenador acepta o rechaza. Al aceptar, si el cliente tenía otro entrenador, ese
--      vínculo termina (y al anterior se le avisa). El plan Free admite hasta 5 clientes activos.
--   3. El cliente puede cambiar de entrenador (nueva solicitud; el actual sigue hasta que el
--      nuevo acepte) o quedarse sin entrenador.
-- Las tablas solo se leen; todo cambio pasa por las funciones forja_* de abajo.

create table if not exists public.coach_links (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles (id) on delete cascade,
  trainer_id   uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'cancelled', 'ended')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  ended_at     timestamptz,
  check (client_id <> trainer_id)
);

comment on table public.coach_links is 'Forja: solicitudes y vínculos entre un cliente y su entrenador.';

-- Un cliente tiene como mucho un entrenador activo y una solicitud pendiente a la vez.
create unique index if not exists coach_links_one_active on public.coach_links (client_id) where status = 'active';
create unique index if not exists coach_links_one_pending on public.coach_links (client_id) where status = 'pending';
create index if not exists coach_links_trainer on public.coach_links (trainer_id, status);

alter table public.coach_links enable row level security;

drop policy if exists "vínculos: los míos" on public.coach_links;
create policy "vínculos: los míos" on public.coach_links for select to authenticated
  using (client_id = auth.uid() or trainer_id = auth.uid());

revoke all on public.coach_links from anon, authenticated;
grant select on public.coach_links to authenticated;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('link_request', 'link_accepted', 'link_rejected', 'link_ended', 'link_cancelled')),
  link_id    uuid references public.coach_links (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notificaciones: las mías" on public.notifications;
create policy "notificaciones: las mías" on public.notifications for select to authenticated using (user_id = auth.uid());

drop policy if exists "notificaciones: marcar leídas" on public.notifications;
create policy "notificaciones: marcar leídas" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.forja_notify(p_user uuid, p_kind text, p_link uuid, p_actor uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, link_id, actor_id, actor_name)
  select p_user, p_kind, p_link, p_actor, (select name from public.profiles where id = p_actor)
$$;
revoke all on function public.forja_notify(uuid, text, uuid, uuid) from public, anon, authenticated;

-- Entrenador activo de un cliente (o null). La usan también las métricas (0005).
create or replace function public.forja_active_trainer(p_client uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select trainer_id from public.coach_links where client_id = p_client and status = 'active'
$$;

-- Lista pública de entrenadores: solo nombre, foto y gimnasios. Con p_gym, solo los de ese gimnasio.
create or replace function public.forja_trainers(p_gym uuid default null)
returns table (id uuid, name text, avatar_path text, remote boolean, gyms jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.avatar_path, p.remote,
         coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'branch', g.branch) order by g.name)
                   from public.trainer_gyms tg join public.gyms g on g.id = tg.gym_id
                   where tg.trainer_id = p.id), '[]'::jsonb)
  from public.profiles p
  where p.role = 'trainer' and p.onboarded_at is not null and p.id <> auth.uid()
    and (p_gym is null or exists (select 1 from public.trainer_gyms tg where tg.trainer_id = p.id and tg.gym_id = p_gym))
  order by p.name
$$;
revoke all on function public.forja_trainers(uuid) from public, anon;
grant execute on function public.forja_trainers(uuid) to authenticated;

-- El cliente pide entrenar con alguien.
create or replace function public.forja_request_trainer(p_trainer uuid)
returns public.coach_links
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  t  public.profiles;
  l  public.coach_links;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'client' then
    raise exception 'Solo un cliente puede pedir entrenador' using errcode = '42501';
  end if;
  select * into t from public.profiles where id = p_trainer and role = 'trainer' and onboarded_at is not null;
  if not found then
    raise exception 'Ese entrenador no existe' using errcode = '22023';
  end if;
  -- En un gimnasio, el entrenador tiene que trabajar ahí. A distancia, sirve un entrenador que
  -- ofrezca entrenar a distancia.
  if me.gym_id is not null then
    if not exists (select 1 from public.trainer_gyms where trainer_id = t.id and gym_id = me.gym_id) then
      raise exception 'Ese entrenador no trabaja en tu gimnasio' using errcode = '22023';
    end if;
  elsif not t.remote then
    raise exception 'Ese entrenador no entrena a distancia' using errcode = '22023';
  end if;
  if exists (select 1 from public.coach_links where client_id = me.id and trainer_id = t.id and status = 'active') then
    raise exception 'Ya entrenas con esa persona' using errcode = '22023';
  end if;
  -- Una solicitud pendiente a otro entrenador se reemplaza por esta.
  update public.coach_links set status = 'cancelled', decided_at = now()
   where client_id = me.id and status = 'pending' returning * into l;
  if found then perform public.forja_notify(l.trainer_id, 'link_cancelled', l.id, me.id); end if;

  insert into public.coach_links (client_id, trainer_id) values (me.id, t.id) returning * into l;
  perform public.forja_notify(t.id, 'link_request', l.id, me.id);
  return l;
end;
$$;

-- El entrenador acepta o rechaza.
create or replace function public.forja_respond_link(p_link uuid, p_accept boolean)
returns public.coach_links
language plpgsql security definer set search_path = public as $$
declare
  me  public.profiles;
  l   public.coach_links;
  old public.coach_links;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into l from public.coach_links where id = p_link for update;
  if not found or l.trainer_id <> auth.uid() then
    raise exception 'Esa solicitud no es tuya' using errcode = '42501';
  end if;
  if l.status <> 'pending' then
    raise exception 'Esa solicitud ya no está pendiente' using errcode = '22023';
  end if;
  if not p_accept then
    update public.coach_links set status = 'rejected', decided_at = now() where id = l.id returning * into l;
    perform public.forja_notify(l.client_id, 'link_rejected', l.id, me.id);
    return l;
  end if;
  if public.forja_effective_plan(me) = 'free'
     and (select count(*) from public.coach_links where trainer_id = me.id and status = 'active') >= 5 then
    raise exception 'Llegaste al límite de 5 clientes del plan Free. Pásate a Pro para aceptar más.' using errcode = '22023';
  end if;
  -- Si el cliente tenía otro entrenador, ese vínculo termina aquí.
  update public.coach_links set status = 'ended', ended_at = now()
   where client_id = l.client_id and status = 'active' returning * into old;
  if found then perform public.forja_notify(old.trainer_id, 'link_ended', old.id, l.client_id); end if;

  update public.coach_links set status = 'active', decided_at = now() where id = l.id returning * into l;
  perform public.forja_notify(l.client_id, 'link_accepted', l.id, me.id);
  return l;
end;
$$;

-- El cliente se queda sin entrenador ("No tengo entrenador") o retira su solicitud.
create or replace function public.forja_leave_trainer()
returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.coach_links;
begin
  for l in update public.coach_links set status = 'ended', ended_at = now()
            where client_id = auth.uid() and status = 'active' returning * loop
    perform public.forja_notify(l.trainer_id, 'link_ended', l.id, auth.uid());
  end loop;
  for l in update public.coach_links set status = 'cancelled', decided_at = now()
            where client_id = auth.uid() and status = 'pending' returning * loop
    perform public.forja_notify(l.trainer_id, 'link_cancelled', l.id, auth.uid());
  end loop;
end;
$$;

revoke all on function public.forja_request_trainer(uuid) from public, anon;
revoke all on function public.forja_respond_link(uuid, boolean) from public, anon;
revoke all on function public.forja_leave_trainer() from public, anon;
grant execute on function public.forja_request_trainer(uuid) to authenticated;
grant execute on function public.forja_respond_link(uuid, boolean) to authenticated;
grant execute on function public.forja_leave_trainer() to authenticated;

-- Cada lado de un vínculo (pendiente o activo) ve el perfil del otro: nombre, foto, edad...
drop policy if exists "perfil: mi entrenador o mi cliente" on public.profiles;
create policy "perfil: mi entrenador o mi cliente" on public.profiles for select to authenticated
  using (exists (select 1 from public.coach_links c
                 where c.status in ('pending', 'active')
                   and ((c.client_id = auth.uid() and c.trainer_id = profiles.id)
                     or (c.trainer_id = auth.uid() and c.client_id = profiles.id))));

create or replace function public.forja_is_trainer(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id::text = p_id and role = 'trainer')
$$;

-- Fotos de perfil: las de entrenadores las ve cualquiera con cuenta (salen en la lista);
-- las de clientes, su entrenador (pendiente o activo).
drop policy if exists "avatar: entrenadores y vínculos" on storage.objects;
create policy "avatar: entrenadores y vínculos" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    public.forja_is_trainer((storage.foldername(name))[1])
    or exists (select 1 from public.coach_links c where c.status in ('pending', 'active')
               and c.trainer_id = auth.uid() and c.client_id::text = (storage.foldername(name))[1])));
