-- Forja · prueba de 0009 · dieta del cliente (función Pro)
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0009. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0009: 11 de 11 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador de Clara
  c  uuid := gen_random_uuid();  -- su cliente
  x  uuid := gen_random_uuid();  -- otro entrenador Pro
  y  uuid := gen_random_uuid();  -- cliente de ese otro entrenador
  plan jsonb := '[{"name":"Desayuno","time":"07:00","items":[{"food":"huevo","name":"Huevo entero","grams":100,"kcal":143,"protein":12.6,"carbs":0.7,"fat":9.5}]}]';
  d  public.diet_plans;
  n  int;
  ok int := 0; total int := 11; fallos text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}'),
    (x, 'x+' || x || '@prueba.forja', '{"name":"Xavi Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (y, 'y+' || y || '@prueba.forja', '{"name":"Yola Cliente","sex":"female","role":"client"}', '{"provider":"email"}');
  update public.profiles set plan = 'pro' where id = x;
  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'active'), (y, x, 'active');

  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Con plan Free, el entrenador no arma dietas.
  begin perform public.forja_set_diet(c, '{"kcal":1650}', plan, 'agua'); fallos := fallos || ' [1 dieta en Free]';
  exception when others then ok := ok + 1; end;

  -- 2. Con Pro sí: guarda objetivos, comidas y notas.
  reset role;
  update public.profiles set plan = 'pro' where id = t;
  set local role authenticated;
  d := public.forja_set_diet(c, '{"kcal":1650,"protein":120}', plan, '  2 L de agua  ');
  if d.trainer_id = t and (d.targets ->> 'kcal')::int = 1650 and jsonb_array_length(d.meals) = 1 and d.notes = '2 L de agua'
  then ok := ok + 1; else fallos := fallos || ' [2 guardar]'; end if;

  -- 3. Guardar otra vez reemplaza (una dieta por cliente).
  perform public.forja_set_diet(c, '{}', plan || plan, null);
  select count(*) into n from public.diet_plans where client_id = c;
  if n = 1 and (select jsonb_array_length(meals) from public.diet_plans where client_id = c) = 2 then ok := ok + 1;
  else fallos := fallos || ' [3 reemplazar]'; end if;

  -- 4. Rechaza un plan mal formado (alimento sin gramos).
  begin perform public.forja_set_diet(c, '{}', '[{"name":"Cena","items":[{"name":"Arroz","kcal":200}]}]', null);
    fallos := fallos || ' [4 forma]';
  exception when others then ok := ok + 1; end;

  -- 5. Y más de 8 comidas.
  begin perform public.forja_set_diet(c, '{}', (select jsonb_agg(plan -> 0) from generate_series(1, 9)), null);
    fallos := fallos || ' [5 límite]';
  exception when others then ok := ok + 1; end;

  -- 6. Clara lee su dieta.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.diet_plans where client_id = c;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [6 cliente no lee]'; end if;

  -- 7. Pero no la cambia.
  begin perform public.forja_set_diet(c, '{}', plan, null); fallos := fallos || ' [7 cliente edita]';
  exception when others then ok := ok + 1; end;

  -- 8. Ni escribe la tabla a mano.
  begin update public.diet_plans set notes = 'hackeo' where client_id = c;
    if (select notes from public.diet_plans where client_id = c) is distinct from 'hackeo' then ok := ok + 1;
    else fallos := fallos || ' [8 update directo]'; end if;
  exception when others then ok := ok + 1; end;

  -- 9. Otro entrenador Pro no la ve ni la cambia.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from public.diet_plans where client_id = c;
  begin perform public.forja_set_diet(c, '{}', plan, null); n := n + 100;
  exception when others then null; end;
  if n = 0 then ok := ok + 1; else fallos := fallos || ' [9 intruso]'; end if;

  -- 10. Si el Pro de Tomás vence, no edita, pero la dieta sigue ahí para Clara.
  reset role;
  update public.profiles set plan_expires_at = now() - interval '1 day' where id = t;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  begin perform public.forja_delete_diet(c); fallos := fallos || ' [10 borra con Pro vencido]';
  exception when others then
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    if exists (select 1 from public.diet_plans where client_id = c) then ok := ok + 1;
    else fallos := fallos || ' [10 se perdió]'; end if;
  end;

  -- 11. Sin sesión no se ejecuta nada.
  reset role;
  if not has_function_privilege('anon', 'public.forja_set_diet(uuid, jsonb, jsonb, text)', 'execute')
     and not has_function_privilege('anon', 'public.forja_delete_diet(uuid)', 'execute')
     and not has_function_privilege('authenticated', 'public.forja_check_diet(jsonb, jsonb)', 'execute')
     and has_function_privilege('authenticated', 'public.forja_set_diet(uuid, jsonb, jsonb, text)', 'execute')
  then ok := ok + 1; else fallos := fallos || ' [11 permisos]'; end if;

  raise exception 'Forja 0009: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
