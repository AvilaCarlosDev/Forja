-- Forja · prueba de 0012 · rutinas asignadas
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0012. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0012: 10 de 10 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador Free de Clara
  c  uuid := gen_random_uuid();  -- su cliente
  x  uuid := gen_random_uuid();  -- otro entrenador
  ex jsonb := '[{"id":"0025","sets":4,"reps":8,"weight":60},{"id":"0047","sets":3,"reps":10,"weight":20,"note":"bajar lento"}]';
  r  public.assigned_routines;
  n  int;
  ok int := 0; total int := 10; fallos text := '';
begin
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}'),
    (x, 'x+' || x || '@prueba.forja', '{"name":"Xavi Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}');
  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'active');

  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. El entrenador (aunque sea Free) le asigna una rutina para lunes y jueves.
  r := public.forja_set_routine(c, null, '  Empuje  ', '{1,4}', ex, 'Calentar 10 min');
  if r.name = 'Empuje' and r.days = '{1,4}'::smallint[] and jsonb_array_length(r.exercises) = 2 and r.trainer_id = t
  then ok := ok + 1; else fallos := fallos || ' [1 asignar]'; end if;

  -- 2. Y la cambia.
  r := public.forja_set_routine(c, r.id, 'Empuje A', '{1,3,5}', ex, null);
  select count(*) into n from public.assigned_routines where client_id = c;
  if n = 1 and r.name = 'Empuje A' and r.note is null then ok := ok + 1; else fallos := fallos || ' [2 cambiar]'; end if;

  -- 3. Rechaza ejercicios mal formados (sin repeticiones) y rutinas vacías.
  begin perform public.forja_set_routine(c, null, 'Mala', '{}', '[{"id":"0025","sets":3}]', null); fallos := fallos || ' [3a forma]';
  exception when others then
    begin perform public.forja_set_routine(c, null, 'Vacía', '{}', '[]', null); fallos := fallos || ' [3b vacía]';
    exception when others then ok := ok + 1; end;
  end;

  -- 4. Y días inexistentes.
  begin perform public.forja_set_routine(c, null, 'Días', '{7}', ex, null); fallos := fallos || ' [4 días]';
  exception when others then ok := ok + 1; end;

  -- 5. Al cliente le llegó el aviso routine_assigned (una vez en el día mientras no lo lea).
  reset role;
  select count(*) into n from public.notifications where user_id = c and kind = 'routine_assigned' and actor_id = t;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [5 aviso: ' || n || ']'; end if;

  -- 6. El cliente la lee…
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.assigned_routines where client_id = c;
  if n = 1 then ok := ok + 1; else fallos := fallos || ' [6 cliente lee]'; end if;

  -- 7. …pero no la cambia ni se asigna otras.
  begin perform public.forja_set_routine(c, null, 'Mía', '{}', ex, null); fallos := fallos || ' [7 cliente asigna]';
  exception when others then ok := ok + 1; end;

  -- 8. Otro entrenador no la ve ni la borra.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  select count(*) into n from public.assigned_routines where client_id = c;
  begin perform public.forja_delete_routine(r.id); n := n + 100;
  exception when others then null; end;
  if n = 0 then ok := ok + 1; else fallos := fallos || ' [8 intruso]'; end if;

  -- 9. Su entrenador la borra.
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  perform public.forja_delete_routine(r.id);
  if not exists (select 1 from public.assigned_routines where id = r.id) then ok := ok + 1; else fallos := fallos || ' [9 borrar]'; end if;

  -- 10. Nadie escribe la tabla a mano.
  begin insert into public.assigned_routines (client_id, name, exercises) values (c, 'directa', ex); fallos := fallos || ' [10 insert directo]';
  exception when others then ok := ok + 1; end;

  reset role;
  raise exception 'Forja 0012: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
