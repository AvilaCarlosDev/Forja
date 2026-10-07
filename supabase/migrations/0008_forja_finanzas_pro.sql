-- Forja · 0008 · finanzas solo para el plan Pro
-- Ejecutar en Supabase → SQL Editor, después de 0007. No borra nada y se puede correr más de una vez.
--
-- La app ya esconde Finanzas a los entrenadores Free, pero las funciones de 0007 no lo
-- verificaban: con la clave pública se podían llamar igual. Ahora la base lo exige.
-- Leer los pagos sigue abierto: un entrenador que vuelve a Free conserva su historial.
-- También se quita EXECUTE de PUBLIC, que Postgres da por defecto a toda función nueva.

-- Falla si quien llama no tiene el plan Pro vigente.
create or replace function public.forja_require_pro()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce((select public.forja_effective_plan(p) from public.profiles p where p.id = auth.uid()), 'free') <> 'pro' then
    raise exception 'Finanzas es una función Pro. Pásate a Pro para usarla.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.forja_set_link_fee(p_link uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_require_pro();
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
  perform public.forja_require_pro();
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

create or replace function public.forja_delete_payment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.forja_require_pro();
  delete from public.payments where id = p_id and trainer_id = auth.uid();
  if not found then
    raise exception 'Ese pago no es tuyo' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.forja_require_pro() from public, anon, authenticated;
revoke all on function public.forja_set_link_fee(uuid, numeric) from public, anon, authenticated;
revoke all on function public.forja_register_payment(uuid, numeric, text, date, text) from public, anon, authenticated;
revoke all on function public.forja_delete_payment(uuid) from public, anon, authenticated;
grant execute on function public.forja_set_link_fee(uuid, numeric) to authenticated;
grant execute on function public.forja_register_payment(uuid, numeric, text, date, text) to authenticated;
grant execute on function public.forja_delete_payment(uuid) to authenticated;
