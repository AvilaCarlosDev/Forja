-- Forja · prueba de 0011 · al vencer Pro, el entrenador ve solo 5 clientes
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0011. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0011: 9 de 9 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador con 7 clientes
  cs uuid[] := array[]::uuid[];
  c  uuid;
  n  int;
  ok int := 0; total int := 9; fallos text := '';
begin
  -- Sin sesión mientras se arma la escena (otra prueba pudo dejar la suya en esta conexión).
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}');
  update public.profiles set plan = 'pro', plan_expires_at = now() + interval '10 days' where id = t;
  for i in 1..7 loop
    c := gen_random_uuid(); cs := cs || c;
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
      (c, 'c' || i || '+' || c || '@prueba.forja', ('{"name":"Cliente ' || i || '","sex":"female","role":"client"}')::jsonb, '{"provider":"email"}');
    -- aceptados en orden: el 1 es el más antiguo
    insert into public.coach_links (client_id, trainer_id, status, requested_at, decided_at)
    values (c, t, 'active', now() - make_interval(days => 100 - i), now() - make_interval(days => 100 - i));
    insert into public.body_metrics (client_id, weight_kg) values (c, 60 + i);
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Con Pro ve a los 7.
  select count(*) into n from public.coach_links where trainer_id = t and status = 'active';
  if n = 7 and public.forja_hidden_clients() = 0 then ok := ok + 1; else fallos := fallos || ' [1 pro ve 7: ' || n || ']'; end if;

  -- Se le vence Pro: la cuenta pasa sola a Free.
  reset role;
  update public.profiles set plan_expires_at = now() - interval '1 minute' where id = t;
  set local role authenticated;

  -- 2. Ahora ve solo 5 vínculos, y sabe que tiene 2 ocultos.
  select count(*) into n from public.coach_links where trainer_id = t and status = 'active';
  if n = 5 and public.forja_hidden_clients() = 2 then ok := ok + 1; else fallos := fallos || ' [2 free ve: ' || n || ']'; end if;

  -- 3. Son los 5 más antiguos.
  if not exists (select 1 from public.coach_links where client_id in (cs[6], cs[7]))
     and (select count(*) from public.coach_links where client_id = any(cs[1:5])) = 5
  then ok := ok + 1; else fallos := fallos || ' [3 cuáles]'; end if;

  -- 4. No ve el perfil ni las medidas de un cliente oculto.
  if not exists (select 1 from public.profiles where id = cs[6]) and not exists (select 1 from public.body_metrics where client_id = cs[6])
  then ok := ok + 1; else fallos := fallos || ' [4 ve oculto]'; end if;

  -- 5. Sí los de uno visible.
  if exists (select 1 from public.profiles where id = cs[1]) and exists (select 1 from public.body_metrics where client_id = cs[1])
  then ok := ok + 1; else fallos := fallos || ' [5 visible]'; end if;

  -- 6. No le carga medidas a un cliente oculto.
  begin insert into public.body_metrics (client_id, weight_kg) values (cs[7], 70); fallos := fallos || ' [6 escribe oculto]';
  exception when others then ok := ok + 1; end;

  -- 7. Cambiar de gimnasio no cambia nada: el cupo es por entrenador, no por gimnasio.
  reset role;
  update public.profiles set gym_id = (select id from public.gyms limit 1) where id = any(cs);
  set local role authenticated;
  select count(*) into n from public.coach_links where trainer_id = t and status = 'active';
  if n = 5 then ok := ok + 1; else fallos := fallos || ' [7 gimnasio]'; end if;

  -- 8. El cliente oculto sigue viendo su vínculo y sus medidas: no pierde nada.
  perform set_config('request.jwt.claims', json_build_object('sub', cs[7], 'role', 'authenticated')::text, true);
  if exists (select 1 from public.coach_links where client_id = cs[7] and status = 'active')
     and exists (select 1 from public.body_metrics where client_id = cs[7])
  then ok := ok + 1; else fallos := fallos || ' [8 cliente oculto]'; end if;

  -- 9. Al renovar Pro vuelven a aparecer los 7.
  reset role;
  update public.profiles set plan_expires_at = now() + interval '30 days' where id = t;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  select count(*) into n from public.coach_links where trainer_id = t and status = 'active';
  if n = 7 then ok := ok + 1; else fallos := fallos || ' [9 renovar]'; end if;

  reset role;
  raise exception 'Forja 0011: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
