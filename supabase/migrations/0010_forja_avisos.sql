-- Forja · 0010 · avisos al cliente cuando su entrenador le envía algo
-- Ejecutar en Supabase → SQL Editor, después de 0009. No borra nada y se puede correr más de una vez.
--
-- Cuando el entrenador guarda la dieta del cliente o le carga medidas, al cliente le llega un
-- aviso («Tu coach te envió tu dieta»). routine_assigned queda reservado para las rutinas
-- asignadas (fase 3). Para no llenar la campanita, si ya hay un aviso igual sin leer del mismo
-- entrenador en el día, no se repite.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'link_request', 'link_accepted', 'link_rejected', 'link_ended', 'link_cancelled',
  'diet_updated', 'metrics_added', 'routine_assigned'));

create or replace function public.forja_notify_client(p_client uuid, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() = p_client then return; end if;
  if exists (select 1 from public.notifications
              where user_id = p_client and kind = p_kind and actor_id = auth.uid()
                and read_at is null and created_at >= date_trunc('day', now())) then
    return;
  end if;
  perform public.forja_notify(p_client, p_kind,
    (select id from public.coach_links where client_id = p_client and trainer_id = auth.uid() and status = 'active'),
    auth.uid());
end;
$$;
revoke all on function public.forja_notify_client(uuid, text) from public, anon, authenticated;

create or replace function public.forja_diet_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_notify_client(new.client_id, 'diet_updated');
  return new;
end;
$$;

drop trigger if exists forja_diet_plans_notify on public.diet_plans;
create trigger forja_diet_plans_notify after insert or update on public.diet_plans
  for each row execute function public.forja_diet_notify();

create or replace function public.forja_metrics_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_notify_client(new.client_id, 'metrics_added');
  return new;
end;
$$;

drop trigger if exists forja_body_metrics_notify on public.body_metrics;
create trigger forja_body_metrics_notify after insert on public.body_metrics
  for each row execute function public.forja_metrics_notify();

revoke all on function public.forja_diet_notify() from public, anon, authenticated;
revoke all on function public.forja_metrics_notify() from public, anon, authenticated;
