-- Forja · prueba de 0003 + 0004 + 0005 · gimnasios, vínculo con el entrenador y medidas
-- Ejecutar en Supabase → SQL Editor DESPUÉS de las migraciones 0003, 0004 y 0005.
--
-- Recorre el caso completo con usuarios de prueba y al final lanza un error A PROPÓSITO con el
-- resumen, para que Postgres deshaga todo y no quede ningún dato de prueba.
-- Resultado esperado:  ERROR: Forja 0005: 24 de 24 pruebas OK
do $$
declare
  t1 uuid := gen_random_uuid();  -- entrenador en Gold Stars Sambil
  t2 uuid := gen_random_uuid();  -- entrenador en Gold Stars Sambil
  t3 uuid := gen_random_uuid();  -- entrenador en Altitude
  c  uuid := gen_random_uuid();  -- cliente en Gold Stars Sambil
  x  uuid := gen_random_uuid();  -- cliente sin entrenador
  ga uuid; gb uuid;
  l  public.coach_links;
  ok int := 0; total int := 24; fallos text := ''; n int; who uuid; extra uuid;
begin
  select id into ga from public.gyms where slug = 'gold-stars-sambil';
  select id into gb from public.gyms where slug = 'altitude-punto-fijo';

  insert into auth.users (id, email, raw_user_meta_data) values
    (t1, 't1+' || t1 || '@prueba.forja', '{"name":"Entrenador Uno","sex":"male","role":"trainer"}'),
    (t2, 't2+' || t2 || '@prueba.forja', '{"name":"Entrenadora Dos","sex":"female","role":"trainer"}'),
    (t3, 't3+' || t3 || '@prueba.forja', '{"name":"Entrenador Tres","sex":"male","role":"trainer"}'),
    (c,  'c+'  || c  || '@prueba.forja', '{"name":"Cliente Ce","sex":"female","role":"client"}'),
    (x,  'x+'  || x  || '@prueba.forja', '{"name":"Cliente Equis","sex":"male","role":"client"}');
  update public.profiles set birth_date = '1990-01-01', onboarded_at = now() where id in (t1, t2, t3, c, x);
  update public.profiles set gym_id = ga where id = c;
  update public.profiles set remote = true where id = x;

  ---------------------------------------------------------------- visitante sin cuenta
  set local role anon;
  -- 1
  begin perform 1 from public.gyms limit 1; fallos := fallos || ' [1 anon lee gimnasios]';
  exception when others then ok := ok + 1; end;
  reset role;

  ---------------------------------------------------------------- cliente C
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 2. Ve la lista inicial verificada.
  select count(*) into n from public.gyms where verified;
  if n >= 3 then ok := ok + 1; else fallos := fallos || ' [2 ve ' || n || ' verificados]'; end if;
  -- 3. "Otro" sin red social ni logo: rechazado.
  begin insert into public.gyms (name, created_by) values ('Gym Sin Prueba', c); fallos := fallos || ' [3 gimnasio sin prueba]';
  exception when others then ok := ok + 1; end;
  -- 4. "Otro" con Instagram: entra sin verificar.
  begin
    insert into public.gyms (name, social_url, created_by) values ('Gym Nuevo PF', 'https://www.instagram.com/gymnuevopf/', c);
    ok := ok + 1;
  exception when others then fallos := fallos || ' [4 ' || sqlerrm || ']'; end;
  -- 5. No puede marcarlo verificado.
  begin insert into public.gyms (name, social_url, created_by, verified) values ('Gym Trampa', 'https://x.com/trampa', c, true);
        fallos := fallos || ' [5 se autoverificó]';
  exception when others then ok := ok + 1; end;
  -- 6. Un cliente no se anota como entrenador de un gimnasio.
  begin insert into public.trainer_gyms values (c, ga); fallos := fallos || ' [6 cliente en trainer_gyms]';
  exception when others then ok := ok + 1; end;
  reset role;

  ---------------------------------------------------------------- entrenadores eligen gimnasios
  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 7. Se anota en su gimnasio, no en nombre de otro.
  begin
    insert into public.trainer_gyms values (t1, ga);
    begin insert into public.trainer_gyms values (t2, ga); fallos := fallos || ' [7 anotó a otro]';
    exception when others then ok := ok + 1; end;
  exception when others then fallos := fallos || ' [7 ' || sqlerrm || ']'; end;
  reset role;
  insert into public.trainer_gyms values (t2, ga), (t3, gb);

  ---------------------------------------------------------------- el cliente busca entrenador
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 8. Solo salen los entrenadores de su gimnasio.
  select count(*) into n from public.forja_trainers(ga) where id in (t1, t2, t3);
  if n = 2 and not exists (select 1 from public.forja_trainers(ga) where id = t3) then ok := ok + 1;
  else fallos := fallos || ' [8 lista con ' || n || ']'; end if;
  -- 9. No puede pedir a uno de otro gimnasio.
  begin perform public.forja_request_trainer(t3); fallos := fallos || ' [9 pidió a otro gimnasio]';
  exception when others then ok := ok + 1; end;
  -- 10. Pide a T1: queda pendiente.
  l := public.forja_request_trainer(t1);
  if l.status = 'pending' then ok := ok + 1; else fallos := fallos || ' [10 ' || l.status || ']'; end if;
  reset role;

  ---------------------------------------------------------------- T1 recibe la solicitud
  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 11. Le llega la notificación y ve el perfil del cliente.
  select count(*) into n from public.notifications where kind = 'link_request' and actor_id = c;
  if n = 1 and exists (select 1 from public.profiles where id = c) then ok := ok + 1;
  else fallos := fallos || ' [11 notificación/perfil]'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', t2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 12. Otro entrenador no puede aceptar por T1.
  begin perform public.forja_respond_link(l.id, true); fallos := fallos || ' [12 T2 aceptó por T1]';
  exception when others then ok := ok + 1; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 13. T1 acepta.
  l := public.forja_respond_link(l.id, true);
  if l.status = 'active' then ok := ok + 1; else fallos := fallos || ' [13 ' || l.status || ']'; end if;
  -- 15. T1 carga las medidas de C.
  begin
    insert into public.body_metrics (client_id, weight_kg, height_cm, body_fat_pct) values (c, 68.5, 165, 27.5);
    select recorded_by into who from public.body_metrics where client_id = c;
    if who = t1 then ok := ok + 1; else fallos := fallos || ' [15 recorded_by]'; end if;
  exception when others then fallos := fallos || ' [15 ' || sqlerrm || ']'; end;
  reset role;

  ---------------------------------------------------------------- C con entrenador: solo lectura
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 14. No carga medidas propias.
  begin insert into public.body_metrics (client_id, weight_kg) values (c, 60); fallos := fallos || ' [14 cliente cargó con entrenador]';
  exception when others then ok := ok + 1; end;
  -- 16. Las ve, pero no las cambia.
  select count(*) into n from public.body_metrics where client_id = c;
  update public.body_metrics set weight_kg = 50 where client_id = c;
  if n = 1 and (select weight_kg from public.body_metrics where client_id = c) = 68.5 then ok := ok + 1;
  else fallos := fallos || ' [16 cliente alteró medidas]'; end if;
  reset role;

  ---------------------------------------------------------------- X sin entrenador
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 17. Carga lo básico él mismo.
  begin insert into public.body_metrics (client_id, weight_kg) values (x, 80); ok := ok + 1;
  exception when others then fallos := fallos || ' [17 ' || sqlerrm || ']'; end;
  -- 18. No ve medidas de otros.
  select count(*) into n from public.body_metrics where client_id = c;
  if n = 0 then ok := ok + 1; else fallos := fallos || ' [18 ve medidas ajenas]'; end if;
  reset role;

  ---------------------------------------------------------------- C cambia a T2
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  l := public.forja_request_trainer(t2);
  reset role;
  -- 19. Mientras T2 no acepta, T1 sigue a cargo y T2 no ve las medidas.
  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.body_metrics where client_id = c;
  reset role;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [19 T1 perdió acceso antes de tiempo]'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', t2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 20. T2 acepta y ve TODO el historial, incluido lo que cargó T1.
  l := public.forja_respond_link(l.id, true);
  select count(*) into n from public.body_metrics where client_id = c;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [20 T2 ve ' || n || ']'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 21. T1 dejó de ver al cliente y recibió el aviso.
  select count(*) into n from public.body_metrics where client_id = c;
  if n = 0 and exists (select 1 from public.notifications where kind = 'link_ended' and actor_id = c)
     and not exists (select 1 from public.profiles where id = c) then ok := ok + 1;
  else fallos := fallos || ' [21 T1 sigue viendo]'; end if;
  reset role;

  ---------------------------------------------------------------- límite del plan Free
  -- T2 ya tiene a C; se le suman 4 clientes activos más (5 en total).
  for i in 1..4 loop
    extra := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data) values (extra, 'e' || i || '+' || extra || '@prueba.forja', '{"role":"client"}');
    insert into public.coach_links (client_id, trainer_id, status) values (extra, t2, 'active');
  end loop;
  extra := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (extra, 'sexto+' || extra || '@prueba.forja', '{"role":"client"}');
  insert into public.coach_links (client_id, trainer_id) values (extra, t2) returning * into l;
  perform set_config('request.jwt.claims', json_build_object('sub', t2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 22. El sexto cliente no entra con plan Free.
  begin perform public.forja_respond_link(l.id, true); fallos := fallos || ' [22 Free aceptó al sexto]';
  exception when others then ok := ok + 1; end;
  reset role;
  -- 23. Con Pro vigente, sí entra.
  update public.profiles set plan = 'pro', plan_expires_at = now() + interval '30 days' where id = t2;
  set local role authenticated;
  begin l := public.forja_respond_link(l.id, true);
    if l.status = 'active' then ok := ok + 1; else fallos := fallos || ' [23 ' || l.status || ']'; end if;
  exception when others then fallos := fallos || ' [23 ' || sqlerrm || ']'; end;
  reset role;

  ---------------------------------------------------------------- C se queda sin entrenador
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 24. "No tengo entrenador": vuelve a cargar lo básico él mismo y conserva su historial.
  perform public.forja_leave_trainer();
  begin
    insert into public.body_metrics (client_id, weight_kg) values (c, 67);
    select count(*) into n from public.body_metrics where client_id = c;
    if n = 2 then ok := ok + 1; else fallos := fallos || ' [24 ve ' || n || ']'; end if;
  exception when others then fallos := fallos || ' [24 ' || sqlerrm || ']'; end;
  reset role;

  raise exception 'Forja 0005: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
