-- Forja · 0007 · finanzas: mensualidad por cliente y pagos (Pro)
-- Ejecutar en Supabase → SQL Editor, después de 0006. No borra nada y se puede correr más de una vez.
--
-- El entrenador Pro define una mensualidad por cliente y registra los pagos que cobra por
-- fuera (sin pasarela: el cobro es manual). El cliente solo ve el estado de su propia
-- mensualidad; los montos y el historial son del entrenador y su cliente.

alter table public.coach_links
  add column if not exists monthly_fee numeric(10, 2) check (monthly_fee is null or monthly_fee >= 0);

comment on column public.coach_links.monthly_fee is
  'Forja: lo que el entrenador cobra al cliente por mes (null = sin monto definido).';

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(10, 2) not null check (amount >= 0),
  period     text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  paid_at    date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.payments is
  'Forja: pagos que el entrenador registra por sus clientes (cobro manual, sin pasarela).';

create index if not exists payments_trainer on public.payments (trainer_id, period desc);
create index if not exists payments_client on public.payments (client_id, period desc);

alter table public.payments enable row level security;

drop policy if exists "pagos: los míos" on public.payments;
create policy "pagos: los míos" on public.payments for select to authenticated
  using (client_id = auth.uid() or trainer_id = auth.uid());

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

-- El entrenador define la mensualidad de uno de sus clientes.
create or replace function public.forja_set_link_fee(p_link uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_fee is not null and p_fee < 0 then
    raise exception 'La mensualidad no puede ser negativa' using errcode = '22023';
  end if;
  update public.coach_links set monthly_fee = p_fee
   where id = p_link and trainer_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Ese vínculo no es tuyo' using errcode = '42501';
  end if;
end;
$$;

-- El entrenador registra un pago de un cliente. El cobro ocurre por fuera; esto solo lo anota.
create or replace function public.forja_register_payment(
  p_client  uuid,
  p_amount  numeric,
  p_period  text,
  p_paid_at date default current_date,
  p_note    text default null
)
returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  l public.coach_links;
  p public.payments;
begin
  select * into l from public.coach_links
   where client_id = p_client and trainer_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Ese cliente no está vinculado a ti' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'El monto no puede ser negativo' using errcode = '22023';
  end if;
  if p_period is null or p_period !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Periodo inválido: usa AAAA-MM' using errcode = '22023';
  end if;
  if p_paid_at is null or p_paid_at > current_date then
    raise exception 'La fecha de pago no puede estar en el futuro' using errcode = '22023';
  end if;
  if p_period > to_char(p_paid_at, 'YYYY-MM') then
    raise exception 'El periodo no puede ser posterior a la fecha de pago' using errcode = '22023';
  end if;
  insert into public.payments (client_id, trainer_id, amount, period, paid_at, note)
  values (p_client, auth.uid(), p_amount, p_period, p_paid_at, nullif(trim(p_note), ''))
  returning * into p;
  return p;
end;
$$;

-- El entrenador corrige un pago registrado por error.
create or replace function public.forja_delete_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.payments where id = p_id and trainer_id = auth.uid();
  if not found then
    raise exception 'Ese pago no es tuyo' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.forja_set_link_fee(uuid, numeric) from anon, authenticated;
revoke all on function public.forja_register_payment(uuid, numeric, text, date, text) from anon, authenticated;
revoke all on function public.forja_delete_payment(uuid) from anon, authenticated;
grant execute on function public.forja_set_link_fee(uuid, numeric) to authenticated;
grant execute on function public.forja_register_payment(uuid, numeric, text, date, text) to authenticated;
grant execute on function public.forja_delete_payment(uuid) to authenticated;
