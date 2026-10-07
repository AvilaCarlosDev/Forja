-- Forja · prueba de 0010 · avisos al cliente
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0010. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0010: 6 de 6 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador Pro
  c  uuid := gen_random_uuid();  -- su cliente
  s  uuid := gen_random_uuid();  -- alguien sin entrenador
  plan jsonb := '[{"name":"Desayuno","time":"07:00","items":[]}]';
  n  int;
  ok int := 0; total int := 6; fallos text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}'),
    (s, 's+' || s || '@prueba.forja', '{"name":"Sola Cliente","sex":"female","role":"client"}', '{"provider":"email"}');
  update public.profiles set plan = 'pro' where id = t;
  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'active');

  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Guardar la dieta avisa al cliente, a nombre del entrenador.
  perform public.forja_set_diet(c, '{}', plan, null);
  reset role;
  select count(*) into n from public.notifications where user_id = c and kind = 'diet_updated' and actor_id = t and actor_name = 'Tomás Trainer';
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [1 aviso dieta]'; end if;

  -- 2. Volver a guardarla el mismo día, sin que la haya leído, no repite el aviso.
  set local role authenticated;
  perform public.forja_set_diet(c, '{}', plan, 'agua');
  reset role;
  select count(*) into n from public.notifications where user_id = c and kind = 'diet_updated';
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [2 repetido]'; end if;

  -- 3. Si ya lo leyó, el cambio siguiente sí avisa.
  update public.notifications set read_at = now() where user_id = c and kind = 'diet_updated';
  set local role authenticated;
  perform public.forja_set_diet(c, '{}', plan, 'agua y fruta');
  reset role;
  select count(*) into n from public.notifications where user_id = c and kind = 'diet_updated';
  if n = 2 then ok := ok + 1; else fallos := fallos || ' [3 tras leer]'; end if;

  -- 4. Cargarle medidas también avisa.
  set local role authenticated;
  insert into public.body_metrics (client_id, weight_kg) values (c, 70);
  reset role;
  select count(*) into n from public.notifications where user_id = c and kind = 'metrics_added' and actor_id = t;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [4 aviso medidas]'; end if;

  -- 5. Quien carga sus propias medidas no se avisa a sí mismo.
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.body_metrics (client_id, weight_kg) values (s, 60);
  reset role;
  select count(*) into n from public.notifications where user_id = s;
  if n = 0 then ok := ok + 1; else fallos := fallos || ' [5 autoaviso]'; end if;

  -- 6. Los avisos no se pueden crear a mano.
  set local role authenticated;
  begin perform public.forja_notify_client(c, 'diet_updated'); fallos := fallos || ' [6 llamada directa]';
  exception when others then ok := ok + 1; end;
  reset role;

  raise exception 'Forja 0010: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
