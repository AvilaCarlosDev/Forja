-- Forja · 0009 · dieta del cliente (función Pro)
-- Ejecutar en Supabase → SQL Editor, después de 0008. No borra nada y se puede correr más de una vez.
--
-- Una dieta por cliente: comidas del día con sus alimentos, objetivos diarios y notas. La arma
-- y la cambia solo su entrenador activo con plan Pro; el cliente la lee. Si el entrenador vuelve
-- a Free la dieta no se borra (la app la muestra otra vez al renovar). Al cambiar de entrenador,
-- el nuevo la ve y puede reemplazarla.
--
-- meals: [{ name, time, items: [{ food, name, grams, kcal, protein, carbs, fat }] }]
-- targets: { kcal, protein, carbs, fat } (cada uno opcional)

create table if not exists public.diet_plans (
  client_id  uuid primary key references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id) on delete set null,
  targets    jsonb not null default '{}'::jsonb check (jsonb_typeof(targets) = 'object'),
  meals      jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
  notes      text check (notes is null or char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

comment on table public.diet_plans is 'Forja: dieta del cliente que arma su entrenador Pro (comidas, alimentos y objetivos).';

alter table public.diet_plans enable row level security;

drop policy if exists "dieta: leer" on public.diet_plans;
create policy "dieta: leer" on public.diet_plans for select to authenticated
  using (public.forja_can_read_client(client_id));

-- Nadie escribe la tabla directo: solo por las funciones de abajo.
revoke all on public.diet_plans from anon, authenticated;
grant select on public.diet_plans to authenticated;

-- Que el plan tenga la forma y los límites de la app (8 comidas, 25 alimentos por comida).
create or replace function public.forja_check_diet(p_targets jsonb, p_meals jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare
  m jsonb; it jsonb; k text;
begin
  if p_targets is null or jsonb_typeof(p_targets) <> 'object' then
    raise exception 'Objetivos inválidos' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_targets) loop
    if k not in ('kcal', 'protein', 'carbs', 'fat') or jsonb_typeof(p_targets -> k) <> 'number'
       or (p_targets ->> k)::numeric <= 0 or (p_targets ->> k)::numeric > 10000 then
      raise exception 'Objetivo inválido: %', k using errcode = '22023';
    end if;
  end loop;
  if p_meals is null or jsonb_typeof(p_meals) <> 'array' or jsonb_array_length(p_meals) > 8 then
    raise exception 'La dieta admite hasta 8 comidas' using errcode = '22023';
  end if;
  for m in select * from jsonb_array_elements(p_meals) loop
    if jsonb_typeof(m) <> 'object' or coalesce(jsonb_typeof(m -> 'items'), '') <> 'array' or jsonb_array_length(m -> 'items') > 25
       or char_length(coalesce(m ->> 'name', '')) not between 1 and 80 then
      raise exception 'Comida inválida (nombre y hasta 25 alimentos)' using errcode = '22023';
    end if;
    for it in select * from jsonb_array_elements(m -> 'items') loop
      if jsonb_typeof(it) <> 'object' or char_length(coalesce(it ->> 'name', '')) not between 1 and 80
         or coalesce(jsonb_typeof(it -> 'grams'), '') <> 'number' or (it ->> 'grams')::numeric < 0 or (it ->> 'grams')::numeric > 3000
         or coalesce(jsonb_typeof(it -> 'kcal'), '') <> 'number' or (it ->> 'kcal')::numeric < 0 or (it ->> 'kcal')::numeric > 10000 then
        raise exception 'Alimento inválido' using errcode = '22023';
      end if;
    end loop;
  end loop;
end;
$$;

-- El entrenador Pro guarda (crea o reemplaza) la dieta de uno de sus clientes.
create or replace function public.forja_set_diet(p_client uuid, p_targets jsonb, p_meals jsonb, p_notes text default null)
returns public.diet_plans language plpgsql security definer set search_path = public as $$
declare
  d public.diet_plans;
begin
  perform public.forja_require_pro();
  if public.forja_active_trainer(p_client) is distinct from auth.uid() then
    raise exception 'Ese cliente no está vinculado a ti' using errcode = '42501';
  end if;
  perform public.forja_check_diet(p_targets, p_meals);
  if char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'Las notas admiten hasta 1000 caracteres' using errcode = '22023';
  end if;
  insert into public.diet_plans (client_id, trainer_id, targets, meals, notes, updated_at)
  values (p_client, auth.uid(), p_targets, p_meals, nullif(trim(p_notes), ''), now())
  on conflict (client_id) do update
    set trainer_id = excluded.trainer_id, targets = excluded.targets, meals = excluded.meals,
        notes = excluded.notes, updated_at = now()
  returning * into d;
  return d;
end;
$$;

-- El entrenador Pro borra la dieta de uno de sus clientes.
create or replace function public.forja_delete_diet(p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_require_pro();
  if public.forja_active_trainer(p_client) is distinct from auth.uid() then
    raise exception 'Ese cliente no está vinculado a ti' using errcode = '42501';
  end if;
  delete from public.diet_plans where client_id = p_client;
end;
$$;

revoke all on function public.forja_check_diet(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.forja_set_diet(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.forja_delete_diet(uuid) from public, anon, authenticated;
grant execute on function public.forja_set_diet(uuid, jsonb, jsonb, text) to authenticated;
grant execute on function public.forja_delete_diet(uuid) to authenticated;
