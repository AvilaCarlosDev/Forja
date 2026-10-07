-- Forja · prueba de 0007 · mensualidad por cliente y pagos
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0007. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0007: 12 de 12 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- el entrenador que cobra
  c  uuid := gen_random_uuid();  -- su cliente
  x  uuid := gen_random_uuid();  -- otro entrenador
  y  uuid := gen_random_uuid();  -- cliente de ese otro entrenador
  l  public.coach_links;
  pay public.payments;
  n  int;
  ok int := 0; total int := 12; fallos text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}'),
    (x, 'x+' || x || '@prueba.forja', '{"name":"Xavi Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (y, 'y+' || y || '@prueba.forja', '{"name":"Yola Cliente","sex":"female","role":"client"}', '{"provider":"email"}');

  -- Finanzas es Pro (0008): los dos entrenadores tienen el plan vigente.
  update public.profiles set plan = 'pro' where id in (t, x);

  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'active') returning * into l;
  insert into public.coach_links (client_id, trainer_id, status) values (y, x, 'active');

  -- Tomás (su entrenador) define la mensualidad de Clara.
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.forja_set_link_fee(l.id, 30);
  if (select monthly_fee from public.coach_links where id = l.id) = 30 then ok := ok + 1;
  else fallos := fallos || ' [1 mensualidad]'; end if;

  -- 2. No se puede poner una mensualidad negativa.
  begin perform public.forja_set_link_fee(l.id, -5); fallos := fallos || ' [2 fee negativa]';
  exception when others then ok := ok + 1; end;

  -- 3. Registra un pago de Clara para el mes en curso.
  pay := public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date, 'efectivo');
  if pay.trainer_id = t and pay.client_id = c and pay.amount = 30 and pay.note = 'efectivo'
     then ok := ok + 1;
  else fallos := fallos || ' [3 registro de pago]'; end if;

  -- 4. El periodo no puede ser posterior a la fecha de pago.
  begin perform public.forja_register_payment(c, 30, to_char(current_date + interval '1 month', 'YYYY-MM'), current_date);
    fallos := fallos || ' [4 periodo futuro]';
  exception when others then ok := ok + 1; end;

  -- 5. La fecha de pago no puede estar en el futuro.
  begin perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date + 1);
    fallos := fallos || ' [5 fecha futura]';
  exception when others then ok := ok + 1; end;

  -- 6. Ni un monto negativo.
  begin perform public.forja_register_payment(c, -1, to_char(current_date, 'YYYY-MM'), current_date);
    fallos := fallos || ' [6 monto negativo]';
  exception when others then ok := ok + 1; end;

  -- 7. El cliente no registra pagos: eso lo hace su entrenador.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date);
    fallos := fallos || ' [7 pagó el cliente]';
  exception when others then ok := ok + 1; end;

  -- 8. El entrenador de otro cliente tampoco registra pagos por la cuenta de Tomás.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date);
    fallos := fallos || ' [8 pagó el intruso]';
  exception when others then ok := ok + 1; end;

  -- 9. Tomás borra el pago que registró por error.
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  perform public.forja_delete_payment(pay.id);
  if not exists (select 1 from public.payments where id = pay.id) then ok := ok + 1;
  else fallos := fallos || ' [9 borrado]'; end if;

  -- 10. Clara no puede borrar pagos (eso lo hace su entrenador).
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.forja_delete_payment(pay.id); fallos := fallos || ' [10 borró el cliente]';
  exception when others then ok := ok + 1; end;

  -- 11. Yola (cliente de otro entrenador) no ve los pagos de Clara.
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date); -- queda registrado, como Tomás
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  select count(*) into n from public.payments where client_id = c;
  if n = 0 then ok := ok + 1;
  else fallos := fallos || ' [11 vio pagos ajenos]'; end if;

  -- 12. Tampoco se puede escribir en la tabla a mano: los pagos solo entran por la función.
  begin
    insert into public.payments (client_id, trainer_id, amount, period)
    values (y, x, 10, to_char(current_date, 'YYYY-MM'));
    fallos := fallos || ' [12 insert directo]';
  exception when others then ok := ok + 1; end;

  reset role;
  raise exception 'Forja 0007: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
