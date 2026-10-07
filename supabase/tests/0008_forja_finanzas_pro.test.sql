-- Forja · prueba de 0008 · finanzas solo para el plan Pro
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0008. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0008: 8 de 8 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador Free
  c  uuid := gen_random_uuid();  -- su cliente
  l  public.coach_links;
  pay public.payments;
  n  int;
  ok int := 0; total int := 8; fallos text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}');
  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'active') returning * into l;

  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Un entrenador Free no define mensualidades.
  begin perform public.forja_set_link_fee(l.id, 30); fallos := fallos || ' [1 fee en Free]';
  exception when others then ok := ok + 1; end;

  -- 2. Ni registra pagos.
  begin perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date);
    fallos := fallos || ' [2 pago en Free]';
  exception when others then ok := ok + 1; end;

  -- 3. Con Pro vigente sí puede.
  reset role;
  update public.profiles set plan = 'pro', plan_expires_at = now() + interval '30 days' where id = t;
  set local role authenticated;
  perform public.forja_set_link_fee(l.id, 30);
  pay := public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date);
  if pay.trainer_id = t then ok := ok + 1; else fallos := fallos || ' [3 pago en Pro]'; end if;

  -- 4. Si el Pro venció, vuelve a ser Free: no registra.
  reset role;
  update public.profiles set plan_expires_at = now() - interval '1 day' where id = t;
  set local role authenticated;
  begin perform public.forja_register_payment(c, 30, to_char(current_date, 'YYYY-MM'), current_date);
    fallos := fallos || ' [4 pago con Pro vencido]';
  exception when others then ok := ok + 1; end;

  -- 5. Ni borra pagos.
  begin perform public.forja_delete_payment(pay.id); fallos := fallos || ' [5 borrado con Pro vencido]';
  exception when others then ok := ok + 1; end;

  -- 6. Pero sigue viendo su historial.
  select count(*) into n from public.payments where trainer_id = t;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [6 historial]'; end if;

  -- 7. Nadie llama al chequeo interno directamente.
  begin perform public.forja_require_pro(); fallos := fallos || ' [7 require_pro expuesto]';
  exception when others then ok := ok + 1; end;

  -- 8. Las funciones de finanzas ya no se pueden ejecutar sin sesión (anon ni PUBLIC).
  reset role;
  if not has_function_privilege('anon', 'public.forja_register_payment(uuid, numeric, text, date, text)', 'execute')
     and not has_function_privilege('anon', 'public.forja_set_link_fee(uuid, numeric)', 'execute')
     and not has_function_privilege('anon', 'public.forja_delete_payment(uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.forja_register_payment(uuid, numeric, text, date, text)', 'execute')
  then ok := ok + 1; else fallos := fallos || ' [8 permisos]'; end if;

  raise exception 'Forja 0008: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
