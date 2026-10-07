-- Forja · prueba de 0013 · columnas privadas del perfil (CN-003)
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0013. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0013: 8 de 8 pruebas OK
do $$
declare
  t  uuid := gen_random_uuid();  -- entrenador
  c  uuid := gen_random_uuid();  -- cliente con solicitud pendiente
  me public.profiles;
  v  text;
  ok int := 0; total int := 8; fallos text := '';
begin
  perform set_config('request.jwt.claims', '{}', true);
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (t, 't+' || t || '@prueba.forja', '{"name":"Tomás Trainer","sex":"male","role":"trainer"}', '{"provider":"email"}'),
    (c, 'c+' || c || '@prueba.forja', '{"name":"Clara Cliente","sex":"female","role":"client"}', '{"provider":"email"}');
  update public.profiles set is_admin = true, terms_accepted_at = now(), birth_date = '1990-01-01' where id = t;
  update public.profiles set terms_accepted_at = now(), birth_date = '2010-05-05' where id = c;
  insert into public.coach_links (client_id, trainer_id, status) values (c, t, 'pending');

  -- El cliente, con la solicitud pendiente.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Ve lo que la app muestra del entrenador: nombre y plan.
  select name || '/' || plan into v from public.profiles where id = t;
  if v = 'Tomás Trainer/free' then ok := ok + 1; else fallos := fallos || ' [1 públicas: ' || coalesce(v, 'nada') || ']'; end if;

  -- 2. No ve si es administrador.
  begin select is_admin::text into v from public.profiles where id = t; fallos := fallos || ' [2 is_admin]';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- 3. Ni cuándo aceptó los términos.
  begin select terms_accepted_at::text into v from public.profiles where id = t; fallos := fallos || ' [3 terms]';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- 4. select * ya no entrega la fila completa de nadie (tampoco la propia).
  begin select p.* into me from public.profiles p where id = t; fallos := fallos || ' [4 select *]';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- 5. Su propia fila completa le llega por forja_me().
  me := public.forja_me();
  if me.id = c and me.terms_accepted_at is not null and me.is_admin = false and me.birth_date = '2010-05-05'
  then ok := ok + 1; else fallos := fallos || ' [5 forja_me]'; end if;

  -- 6. Y sigue pudiendo editar su perfil.
  update public.profiles set name = 'Clara C.' where id = c;
  if public.forja_me() is not distinct from null then fallos := fallos || ' [6 editar]';
  elsif (public.forja_me()).name = 'Clara C.' then ok := ok + 1; else fallos := fallos || ' [6 editar]'; end if;

  -- 7. El entrenador tampoco ve las columnas privadas de su cliente.
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  begin select is_admin::text into v from public.profiles where id = c; fallos := fallos || ' [7 is_admin cliente]';
  exception when insufficient_privilege then ok := ok + 1; end;

  -- 8. Sin sesión, forja_me() no está disponible.
  reset role;
  set local role anon;
  begin me := public.forja_me(); fallos := fallos || ' [8 anon]';
  exception when insufficient_privilege then ok := ok + 1; end;

  reset role;
  raise exception 'Forja 0013: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
