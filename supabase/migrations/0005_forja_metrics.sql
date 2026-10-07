-- Forja · 0005 · medidas, metas y avances del cliente
-- Ejecutar en Supabase → SQL Editor, después de 0004. No borra nada y se puede correr más de una vez.
--
-- Reglas:
--   * Las medidas son DEL CLIENTE: si cambia de entrenador, todo el historial sigue con él.
--     El entrenador activo lo ve completo (también lo que cargó el anterior); el anterior pierde
--     el acceso en cuanto termina el vínculo. No se copia nada.
--   * Con entrenador, solo el entrenador carga y corrige. El cliente las ve en solo lectura.
--   * Sin entrenador, el cliente carga lo básico él mismo; queda como su punto de partida.
--   * Cada registro guarda quién lo cargó.

-- ¿Puede el usuario actual escribir los datos de este cliente?
create or replace function public.forja_can_write_client(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.forja_active_trainer(p_client) is not null then public.forja_active_trainer(p_client) = auth.uid()
    else p_client = auth.uid()
  end
$$;

create or replace function public.forja_can_read_client(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_client = auth.uid() or public.forja_active_trainer(p_client) = auth.uid()
$$;

create table if not exists public.body_metrics (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.profiles (id) on delete cascade,
  recorded_by    uuid references public.profiles (id) on delete set null,
  measured_on    date not null default current_date check (measured_on <= current_date + 1),
  weight_kg      numeric(5, 2) check (weight_kg between 20 and 400),
  height_cm      numeric(5, 1) check (height_cm between 80 and 250),
  body_fat_pct   numeric(4, 1) check (body_fat_pct between 2 and 75),
  visceral_fat   numeric(4, 1) check (visceral_fat between 1 and 60),
  muscle_mass_kg numeric(5, 2) check (muscle_mass_kg between 5 and 200),
  -- Perímetros en cm: cuello, pecho, cintura, cadera, brazo, muslo, pantorrilla.
  measurements   jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  note           text check (note is null or char_length(note) <= 500),
  created_at     timestamptz not null default now(),
  check (coalesce(weight_kg, height_cm, body_fat_pct, visceral_fat, muscle_mass_kg) is not null
         or measurements <> '{}'::jsonb)
);

create index if not exists body_metrics_client on public.body_metrics (client_id, measured_on desc);

comment on table public.body_metrics is 'Forja: mediciones corporales del cliente. Viajan con él al cambiar de entrenador.';

-- recorded_by lo pone la base, no el formulario.
create or replace function public.forja_set_recorded_by()
returns trigger language plpgsql as $$
begin
  new.recorded_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists forja_body_metrics_by on public.body_metrics;
create trigger forja_body_metrics_by before insert or update on public.body_metrics
  for each row execute function public.forja_set_recorded_by();

alter table public.body_metrics enable row level security;

drop policy if exists "medidas: leer" on public.body_metrics;
create policy "medidas: leer" on public.body_metrics for select to authenticated
  using (public.forja_can_read_client(client_id));

drop policy if exists "medidas: cargar" on public.body_metrics;
create policy "medidas: cargar" on public.body_metrics for insert to authenticated
  with check (public.forja_can_write_client(client_id));

drop policy if exists "medidas: corregir" on public.body_metrics;
create policy "medidas: corregir" on public.body_metrics for update to authenticated
  using (public.forja_can_write_client(client_id)) with check (public.forja_can_write_client(client_id));

drop policy if exists "medidas: borrar" on public.body_metrics;
create policy "medidas: borrar" on public.body_metrics for delete to authenticated
  using (public.forja_can_write_client(client_id));

revoke all on public.body_metrics from anon, authenticated;
grant select, insert, update, delete on public.body_metrics to authenticated;

-- Meta del cliente (una por cliente), con la misma regla: la fija su entrenador si lo tiene.
create table if not exists public.client_goals (
  client_id        uuid primary key references public.profiles (id) on delete cascade,
  goal             text check (goal is null or char_length(goal) <= 300),
  target_weight_kg numeric(5, 2) check (target_weight_kg between 20 and 400),
  target_date      date,
  updated_by       uuid references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);

create or replace function public.forja_touch_goal()
returns trigger language plpgsql as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists forja_client_goals_touch on public.client_goals;
create trigger forja_client_goals_touch before insert or update on public.client_goals
  for each row execute function public.forja_touch_goal();

alter table public.client_goals enable row level security;

drop policy if exists "metas: leer" on public.client_goals;
create policy "metas: leer" on public.client_goals for select to authenticated
  using (public.forja_can_read_client(client_id));

drop policy if exists "metas: fijar" on public.client_goals;
create policy "metas: fijar" on public.client_goals for insert to authenticated
  with check (public.forja_can_write_client(client_id));

drop policy if exists "metas: cambiar" on public.client_goals;
create policy "metas: cambiar" on public.client_goals for update to authenticated
  using (public.forja_can_write_client(client_id)) with check (public.forja_can_write_client(client_id));

revoke all on public.client_goals from anon, authenticated;
grant select, insert, update on public.client_goals to authenticated;
