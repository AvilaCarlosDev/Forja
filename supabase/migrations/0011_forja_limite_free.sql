-- Forja · 0011 · al vencer Pro, el entrenador ve solo 5 clientes
-- Ejecutar en Supabase → SQL Editor, después de 0010. No borra nada y se puede correr más de una vez.
--
-- El plan vigente ya baja solo a Free cuando pasa plan_expires_at (forja_effective_plan, 0001).
-- Con Free, un entrenador que tenía más de 5 clientes activos sigue vinculado con todos, pero solo
-- ve y atiende a sus 5 más antiguos (por fecha de aceptación); el resto queda oculto en cualquier
-- gimnasio hasta que renueve Pro. No se pierde nada: al renovar vuelven a aparecer todos.

-- ¿El entrenador de este vínculo lo puede ver? Pendientes y terminados no cuentan para el cupo.
create or replace function public.forja_link_visible(p_link uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select l.status <> 'active'
      or public.forja_effective_plan(t) = 'pro'
      or (select count(*) from public.coach_links o
           where o.trainer_id = l.trainer_id and o.status = 'active'
             and (coalesce(o.decided_at, o.requested_at), o.id) < (coalesce(l.decided_at, l.requested_at), l.id)) < 5
    from public.coach_links l join public.profiles t on t.id = l.trainer_id
   where l.id = p_link
$$;

-- ¿Quien llama es el entrenador activo de este cliente y lo tiene dentro de su cupo?
create or replace function public.forja_trainer_sees(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coach_links
                  where client_id = p_client and trainer_id = auth.uid() and status = 'active'
                    and public.forja_link_visible(id))
$$;

-- Medidas, metas y dieta usan estas dos reglas (0005, 0009): ahora respetan el cupo.
create or replace function public.forja_can_read_client(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_client = auth.uid() or public.forja_trainer_sees(p_client)
$$;

create or replace function public.forja_can_write_client(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.forja_active_trainer(p_client) is not null then public.forja_trainer_sees(p_client)
    else p_client = auth.uid()
  end
$$;

-- El entrenador deja de ver el vínculo, el perfil y la foto de los clientes fuera del cupo.
drop policy if exists "vínculos: los míos" on public.coach_links;
create policy "vínculos: los míos" on public.coach_links for select to authenticated
  using (client_id = auth.uid() or (trainer_id = auth.uid() and public.forja_link_visible(id)));

drop policy if exists "perfil: mi entrenador o mi cliente" on public.profiles;
create policy "perfil: mi entrenador o mi cliente" on public.profiles for select to authenticated
  using (exists (select 1 from public.coach_links c
                 where c.status in ('pending', 'active')
                   and ((c.client_id = auth.uid() and c.trainer_id = profiles.id)
                     or (c.trainer_id = auth.uid() and c.client_id = profiles.id and public.forja_link_visible(c.id)))));

drop policy if exists "avatar: entrenadores y vínculos" on storage.objects;
create policy "avatar: entrenadores y vínculos" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    public.forja_is_trainer((storage.foldername(name))[1])
    or exists (select 1 from public.coach_links c where c.status in ('pending', 'active')
               and c.trainer_id = auth.uid() and c.client_id::text = (storage.foldername(name))[1]
               and public.forja_link_visible(c.id))));

-- Cuántos clientes activos tiene ocultos el entrenador que llama (para avisarle que renueve).
create or replace function public.forja_hidden_clients()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.coach_links
   where trainer_id = auth.uid() and status = 'active' and not public.forja_link_visible(id)
$$;

revoke all on function public.forja_link_visible(uuid) from public, anon;
revoke all on function public.forja_trainer_sees(uuid) from public, anon;
revoke all on function public.forja_hidden_clients() from public, anon;
grant execute on function public.forja_link_visible(uuid) to authenticated;
grant execute on function public.forja_trainer_sees(uuid) to authenticated;
grant execute on function public.forja_hidden_clients() to authenticated;
